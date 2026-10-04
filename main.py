import asyncio
import base64
import glob
import hashlib
import json
import os
import shutil
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
}
ARTWORK_DIR = os.path.join(decky.DECKY_PLUGIN_DIR, "assets", "artwork")
ARTWORK = ("grid_p", "grid_l", "hero", "logo")
ICON = "/usr/share/icons/hicolor/256x256/apps/rustdesk.png"
WATCH_INTERVAL = 2.0


class Plugin:
    async def _main(self):
        util.set_logger(decky.logger)
        self.settings = self._load_settings()
        self.ipc = ipc.Ipc(util.deck_user().pw_uid)
        self.lock = asyncio.Lock()
        self.conns = 0
        self.composite_on = False
        self.rustdesk_id: str | None = None

        if await installer.ensure_merged() and self.settings["enabled"]:
            await service.start(self.settings["prefer_portal"])
        self.watcher = asyncio.create_task(self._watch())
        decky.logger.info("RustDeck started")

    async def _unload(self):
        # Keep the service running: reloading the plugin must not drop a remote session.
        self.watcher.cancel()
        await self._set_composite(False)
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

    # ---- background ----

    async def _watch(self):
        while True:
            try:
                await self._tick()
            except asyncio.CancelledError:
                raise
            except Exception:
                decky.logger.exception("watch tick failed")
            await asyncio.sleep(WATCH_INTERVAL)

    async def _tick(self):
        conns = 0
        if await service.is_active():
            try:
                conns = await self.ipc.conn_count()
            except (OSError, asyncio.TimeoutError, ValueError):
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
            decky.logger.info("forced composition %s", "on" if on else "off")

    # ---- status ----

    async def get_status(self) -> dict:
        info = installer.installed()
        active = await service.is_active()
        if active and not self.rustdesk_id:
            self.rustdesk_id = await rustdesk.get_id()
        return {
            "installed": info["tag"] if info and os.path.exists(paths.RUSTDESK) else None,
            "enabled": self.settings["enabled"],
            "active": active,
            "id": self.rustdesk_id if active else None,
            "connections": self.conns,
            "composite": self.composite_on,
            "auto_composite": self.settings["auto_composite"],
            "prefer_portal": self.settings["prefer_portal"],
            "busy": self.lock.locked(),
        }

    async def get_password(self) -> dict:
        """The temporary password and which passwords RustDesk accepts."""
        try:
            temp = await self.ipc.get_config("temporary-password")
            permanent = await self.ipc.get_config("permanent-password-set") == "Y"
        except (OSError, asyncio.TimeoutError, ValueError):
            return {"available": False}
        method = await rustdesk.get_option("verification-method") or "use-both-passwords"
        return {
            "available": True,
            "temporary": temp if method != "use-permanent-password" else None,
            "permanent_set": permanent,
            "method": method,
        }

    async def refresh_password(self) -> dict:
        try:
            await self.ipc.set_config("temporary-password", "")
        except (OSError, asyncio.TimeoutError):
            pass
        await asyncio.sleep(0.3)
        return await self.get_password()

    # ---- service ----

    async def set_enabled(self, enabled: bool) -> dict:
        async with self.lock:
            self.settings["enabled"] = enabled
            self._save_settings()
            if enabled:
                if await installer.ensure_merged():
                    await service.start(self.settings["prefer_portal"])
            else:
                await service.stop()
                self.rustdesk_id = None
        return await self.get_status()

    async def disconnect_all(self) -> None:
        await service.restart_server()

    async def set_auto_composite(self, on: bool) -> dict:
        self.settings["auto_composite"] = on
        self._save_settings()
        await self._tick()
        return await self.get_status()

    async def set_prefer_portal(self, on: bool) -> dict:
        async with self.lock:
            self.settings["prefer_portal"] = on
            self._save_settings()
            if await service.is_active():
                await service.stop()
                await service.start(on)
        return await self.get_status()

    # ---- install ----

    async def check_update(self) -> dict:
        info = installer.installed()
        try:
            rel = await installer.latest_release()
        except Exception as e:
            decky.logger.warning("release lookup failed: %s", e)
            return {"installed": info and info["tag"], "latest": None, "error": str(e)}
        return {"installed": info and info["tag"], "latest": rel and asdict(rel), "error": None}

    async def install_latest(self) -> dict:
        async with self.lock:
            try:
                rel = await installer.latest_release()
                if rel is None:
                    return {"ok": False, "error": "no release found"}
                was_active = await service.is_active()
                if was_active:
                    await service.stop()

                async def progress(done: int, total: int):
                    await decky.emit("install_progress", done, total)

                await installer.install(rel, progress)
                if was_active or self.settings["enabled"]:
                    await service.start(self.settings["prefer_portal"])
                self.rustdesk_id = None
                return {"ok": True, "tag": rel.tag}
            except Exception as e:
                decky.logger.exception("install failed")
                return {"ok": False, "error": str(e)}

    async def uninstall_rustdesk(self) -> dict:
        async with self.lock:
            await service.stop()
            await self._set_composite(False)
            await installer.uninstall()
            self.settings["enabled"] = False
            self._save_settings()
            self.rustdesk_id = None
        return await self.get_status()

    # ---- server ----

    async def get_server(self) -> dict:
        if not os.path.exists(paths.RUSTDESK):
            return {}
        return await rustdesk.get_server()

    async def apply_server_config(self, config: str) -> dict:
        ok = await rustdesk.apply_config(config.strip())
        return {"ok": ok, "server": await rustdesk.get_server() if ok else None}

    # ---- RustDesk settings ----

    async def get_rustdesk_settings(self) -> dict:
        """Raw values of the editable options, plus which of them are off unless set to "Y"."""
        if not os.path.exists(paths.RUSTDESK):
            return {"available": False}
        try:
            opts = await self.ipc.get_options()
            values = {k: opts.get(k, "") for k in rustdesk.EDITABLE_OPTIONS}
            permanent = await self.ipc.get_config("permanent-password-set") == "Y"
        except (OSError, asyncio.TimeoutError, ValueError):
            # No --server (service stopped): ask the CLI one option at a time.
            values = {k: await rustdesk.get_option(k) for k in rustdesk.EDITABLE_OPTIONS}
            permanent = None
        return {
            "available": True,
            "values": values,
            "off_by_default": [k for k in rustdesk.EDITABLE_OPTIONS if rustdesk.option_off_by_default(k)],
            "permanent_set": permanent,
        }

    async def set_rustdesk_option(self, name: str, value: str) -> dict:
        if name not in rustdesk.EDITABLE_OPTIONS:
            return {"ok": False, "error": f"{name} is not editable"}
        ok = await rustdesk.set_option(name, value)
        return {"ok": ok, "value": await rustdesk.get_option(name)}

    async def clear_server(self) -> dict:
        """Back to RustDesk's public servers."""
        for name in rustdesk.SERVER_OPTIONS:
            await rustdesk.set_option(name, "")
        return await rustdesk.get_server()

    async def set_permanent_password(self, password: str) -> dict:
        # Only over IPC: the CLI would put the password on a command line (process list, logs).
        try:
            return {"ok": await self.ipc.set_permanent_password(password)}
        except (OSError, asyncio.TimeoutError, ValueError):
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
