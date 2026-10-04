import asyncio
import base64
import contextlib
import glob
import hashlib
import json
import os
import shutil
import time
from dataclasses import asdict

import decky  # type: ignore

from rustdeck import composite, installer, ipc, paths, rustdesk, service, util

SETTINGS_FILE = os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "settings.json")
DEFAULTS = {
    # Run the RustDesk service, and start it again after a reboot.
    "enabled": False,
    # Force gamescope composition while someone is connected (see composite.py).
    "auto_composite": True,
    # Capture through gamescope's ScreenCast portal instead of DRM (experimental).
    "prefer_portal": False,
    # Steam shortcut used to open RustDesk's own window, and "appid:artwork hash" last applied to it.
    "shortcut_appid": None,
    "shortcut_artwork": None,
    # Whether the plugin left gamescope's forced composition on; a run killed mid-session cannot
    # turn it off, so the next run does.
    "composite_forced": False,
}
ARTWORK_DIR = os.path.join(decky.DECKY_PLUGIN_DIR, "assets", "artwork")
ARTWORK = ("grid_p", "grid_l", "hero", "logo")
ICON = "/usr/share/icons/hicolor/256x256/apps/rustdesk.png"
# How often the watcher looks at the service and its connections. Both checks are cheap (a stat
# and a local socket round trip); the frontend is told about changes instead of polling.
ACTIVE_INTERVAL = 1.0
IDLE_INTERVAL = 3.0
# How often to ask for the ID while the service is up but has not reported it yet.
ID_RETRY = 10.0
IPC_ERRORS = (OSError, asyncio.TimeoutError, ValueError)
UNLOAD_TIMEOUT = 3.0


class Plugin:
    async def _main(self):
        util.set_logger(decky.logger)
        self.settings = self._load_settings()
        self.ipc = ipc.Ipc(util.deck_user().pw_uid)
        self.lock = asyncio.Lock()
        self.tick_lock = asyncio.Lock()
        self.wake = asyncio.Event()
        self.active = False
        self.conns = 0
        # Start from what the last run left, so the first tick turns a leftover off.
        self.composite_on = self.settings["composite_forced"]
        self.rustdesk_id: str | None = None
        self.id_checked_at = 0.0
        self.installed_tag = self._read_installed()
        self.published: dict | None = None

        if await installer.ensure_merged() and self.settings["enabled"]:
            await service.start(self.settings["prefer_portal"])
        self.installed_tag = self._read_installed()
        self.watcher = asyncio.create_task(self._watch())
        decky.logger.info("RustDeck started")

    async def _unload(self):
        # Keep the service running: reloading the plugin must not drop a remote session.
        self.watcher.cancel()
        # Decky waits for this before it stops the plugin, so it must not hang. Should it be cut
        # short, the persisted flag lets the next run turn composition off instead.
        try:
            await asyncio.wait_for(self._set_composite(False), UNLOAD_TIMEOUT)
        except asyncio.TimeoutError:
            decky.logger.warning("could not turn forced composition off while unloading")
        decky.logger.info("RustDeck unloaded")

    async def _uninstall(self):
        await service.stop()
        await self._set_composite(False)
        await installer.uninstall()
        decky.logger.info("RustDeck uninstalled RustDesk")

    # ---- settings ----

    def _load_settings(self) -> dict:
        try:
            with open(SETTINGS_FILE) as f:
                return {**DEFAULTS, **json.load(f)}
        except (OSError, ValueError):
            return dict(DEFAULTS)

    def _save_settings(self) -> None:
        os.makedirs(os.path.dirname(SETTINGS_FILE), exist_ok=True)
        with open(SETTINGS_FILE, "w") as f:
            json.dump(self.settings, f, indent=2)

    @staticmethod
    def _read_installed() -> str | None:
        info = installer.installed()
        return info["tag"] if info and os.path.exists(paths.RUSTDESK) else None

    # ---- background ----

    async def _watch(self):
        while True:
            try:
                await self._refresh()
            except asyncio.CancelledError:
                raise
            except Exception:
                decky.logger.exception("watch tick failed")
            interval = ACTIVE_INTERVAL if self.active else IDLE_INTERVAL
            self.wake.clear()
            with contextlib.suppress(asyncio.TimeoutError):
                await asyncio.wait_for(self.wake.wait(), interval)

    async def _refresh(self) -> dict:
        """Look at the service now and tell the frontend if anything changed."""
        async with self.tick_lock:
            await self._tick()
        return await self._publish()

    async def _tick(self):
        self.active = await service.is_active()
        conns = 0
        if self.active:
            if not self.rustdesk_id and time.monotonic() - self.id_checked_at > ID_RETRY:
                self.id_checked_at = time.monotonic()
                self.rustdesk_id = await rustdesk.get_id()
            try:
                conns = await self.ipc.conn_count()
            except IPC_ERRORS:
                conns = 0  # the --server is (re)starting
        self.conns = conns
        want = (
            conns > 0
            and self.settings["auto_composite"]
            and not self.settings["prefer_portal"]
        )
        await self._set_composite(want)

    async def _set_composite(self, on: bool):
        # Only undo what the plugin set: a user may force composition from Steam's developer menu.
        if on == self.composite_on:
            return
        if await composite.set_forced(on):
            self.composite_on = on
            self.settings["composite_forced"] = on
            self._save_settings()
            decky.logger.info("forced composition %s", "on" if on else "off")

    def _status(self) -> dict:
        return {
            "installed": self.installed_tag,
            "enabled": self.settings["enabled"],
            "active": self.active,
            "id": self.rustdesk_id if self.active else None,
            "connections": self.conns,
            "composite": self.composite_on,
            "auto_composite": self.settings["auto_composite"],
            "prefer_portal": self.settings["prefer_portal"],
            "busy": self.lock.locked(),
        }

    async def _publish(self) -> dict:
        status = self._status()
        if status != self.published:
            self.published = status
            await decky.emit("status", status)
        return status

    @contextlib.asynccontextmanager
    async def _busy(self):
        """Hold the lock for a long operation, with the frontend shown it is busy meanwhile."""
        try:
            async with self.lock:
                await self._publish()
                yield
        finally:
            self.installed_tag = self._read_installed()
            await self._refresh()

    # ---- status ----

    async def get_status(self) -> dict:
        # Kept current by the watcher; changes are also pushed as "status" events.
        return self._status()

    async def get_password(self) -> dict:
        """The temporary password and which passwords RustDesk accepts."""
        try:
            temp = await self.ipc.get_config("temporary-password")
            permanent = await self.ipc.get_config("permanent-password-set") == "Y"
            method = (await self.ipc.get_options()).get("verification-method") or "use-both-passwords"
        except IPC_ERRORS:
            return {"available": False}
        return {
            "available": True,
            "temporary": temp if method != "use-permanent-password" else None,
            "permanent_set": permanent,
            "method": method,
        }

    async def refresh_password(self) -> dict:
        with contextlib.suppress(OSError, asyncio.TimeoutError):
            await self.ipc.set_config("temporary-password", "")
        await asyncio.sleep(0.3)
        return await self.get_password()

    # ---- service ----

    async def set_enabled(self, enabled: bool) -> dict:
        async with self._busy():
            self.settings["enabled"] = enabled
            self._save_settings()
            if enabled:
                if await installer.ensure_merged():
                    await service.start(self.settings["prefer_portal"])
            else:
                await service.stop()
                self.rustdesk_id = None
        return self._status()

    async def disconnect_all(self) -> None:
        await service.restart_server()
        self.wake.set()

    async def set_auto_composite(self, on: bool) -> dict:
        self.settings["auto_composite"] = on
        self._save_settings()
        return await self._refresh()

    async def set_prefer_portal(self, on: bool) -> dict:
        async with self._busy():
            self.settings["prefer_portal"] = on
            self._save_settings()
            if await service.is_active():
                await service.stop()
                await service.start(on)
        return self._status()

    # ---- install ----

    async def check_update(self) -> dict:
        try:
            rel = await installer.latest_release()
        except Exception as e:
            decky.logger.warning("release lookup failed: %s", e)
            return {"installed": self.installed_tag, "latest": None, "error": str(e)}
        return {"installed": self.installed_tag, "latest": rel and asdict(rel), "error": None}

    async def install_latest(self) -> dict:
        async with self._busy():
            try:
                rel = await installer.latest_release()
                if rel is None:
                    return {"ok": False, "error": "no release found"}
                was_active = await service.is_active()
                if was_active:
                    await service.stop()

                async def progress(done: int, total: int):
                    await decky.emit("install_progress", done, total)

                try:
                    await installer.install(rel, progress)
                finally:
                    # Also after a failed update, which keeps the previous build.
                    if was_active or self.settings["enabled"]:
                        await service.start(self.settings["prefer_portal"])
                self.rustdesk_id = None
                return {"ok": True, "tag": rel.tag}
            except Exception as e:
                decky.logger.exception("install failed")
                return {"ok": False, "error": str(e)}

    async def uninstall_rustdesk(self) -> dict:
        async with self._busy():
            await service.stop()
            await self._set_composite(False)
            await installer.uninstall()
            self.settings["enabled"] = False
            self._save_settings()
            self.rustdesk_id = None
        return self._status()

    # ---- RustDesk options ----

    async def _options(self, names) -> dict[str, str]:
        """Options from the running --server in one request, else from the CLI."""
        try:
            opts = await self.ipc.get_options()
            return {k: opts.get(k, "") for k in names}
        except IPC_ERRORS:
            return await rustdesk.get_options(names)

    async def get_server(self) -> dict:
        if not os.path.exists(paths.RUSTDESK):
            return {}
        return await self._options(rustdesk.SERVER_OPTIONS)

    async def apply_server_config(self, config: str) -> dict:
        if self.lock.locked():
            return {"ok": False, "server": None, "error": "busy"}
        ok = await rustdesk.apply_config(config.strip())
        return {"ok": ok, "server": await self.get_server() if ok else None}

    async def get_rustdesk_settings(self) -> dict:
        """Raw values of the editable options, plus which of them are off unless set to "Y"."""
        if not os.path.exists(paths.RUSTDESK):
            return {"available": False}
        values = await self._options(rustdesk.EDITABLE_OPTIONS)
        try:
            permanent = await self.ipc.get_config("permanent-password-set") == "Y"
        except IPC_ERRORS:
            permanent = None  # only the running --server knows
        return {
            "available": True,
            "values": values,
            "off_by_default": [k for k in rustdesk.EDITABLE_OPTIONS if rustdesk.option_off_by_default(k)],
            "permanent_set": permanent,
        }

    async def set_rustdesk_option(self, name: str, value: str) -> dict:
        if name not in rustdesk.EDITABLE_OPTIONS:
            return {"ok": False, "error": f"{name} is not editable"}
        if self.lock.locked():
            return {"ok": False, "error": "busy"}
        ok = await rustdesk.set_option(name, value)
        return {"ok": ok, "value": await rustdesk.get_option(name)}

    async def clear_server(self) -> dict:
        """Back to RustDesk's public servers."""
        if not self.lock.locked():
            for name in rustdesk.SERVER_OPTIONS:
                await rustdesk.set_option(name, "")
        return await self.get_server()

    async def set_permanent_password(self, password: str) -> dict:
        # Only over IPC: the CLI would put the password on a command line (process list, logs).
        try:
            return {"ok": await self.ipc.set_permanent_password(password)}
        except IPC_ERRORS:
            return {"ok": False, "error": "service not running"}

    # ---- RustDesk window ----

    def _artwork_stamp(self) -> str | None:
        """Which shortcut got which artwork, so changed artwork is applied again."""
        appid = self.settings["shortcut_appid"]
        if appid is None:
            return None
        digest = hashlib.sha256()
        for path in [os.path.join(ARTWORK_DIR, f"{name}.png") for name in ARTWORK] + [ICON]:
            if os.path.exists(path):
                with open(path, "rb") as f:
                    digest.update(f.read())
        return f"{appid}:{digest.hexdigest()[:16]}"

    async def get_shortcut(self) -> dict:
        stamp = self._artwork_stamp()
        return {
            "appid": self.settings["shortcut_appid"],
            "artwork_applied": stamp is not None and self.settings["shortcut_artwork"] == stamp,
        }

    async def set_shortcut(self, appid: int | None) -> None:
        self.settings["shortcut_appid"] = appid
        self._save_settings()

    async def set_artwork_applied(self, appid: int) -> None:
        if appid == self.settings["shortcut_appid"]:
            self.settings["shortcut_artwork"] = self._artwork_stamp()
            self._save_settings()

    async def install_shortcut_icon(self, appid: int) -> str | None:
        """Copy RustDesk's icon next to the shortcut's artwork and return its path. Steam's web
        helper runs in a runtime container with its own /usr, so it cannot read the icon where
        RustDesk installs it."""
        pw = util.deck_user()
        # The grid folder of the Steam user owning the shortcut: the one holding its artwork.
        found = glob.glob(os.path.join(pw.pw_dir, ".local/share/Steam/userdata/*/config/grid", f"{int(appid)}p.png"))
        if not found or not os.path.exists(ICON):
            return None
        dest = os.path.join(os.path.dirname(found[0]), f"{int(appid)}_icon.png")
        shutil.copyfile(ICON, dest)
        os.chown(dest, pw.pw_uid, pw.pw_gid)
        return dest

    async def get_artwork(self) -> dict[str, str]:
        """Base64 PNGs for the shortcut: grid_p, grid_l, hero, logo."""
        art = {}
        for name in ARTWORK:
            with open(os.path.join(ARTWORK_DIR, f"{name}.png"), "rb") as f:
                art[name] = base64.b64encode(f.read()).decode()
        return art
