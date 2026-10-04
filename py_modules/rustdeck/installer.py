# Install the RustDesk build from this plugin's GitHub releases as a systemd-sysext.
import asyncio
import glob
import hashlib
import json
import os
import shutil
import ssl
import tempfile
import time
import urllib.request
from dataclasses import asdict, dataclass
from typing import Callable

from . import paths, util
from .util import run

_API = f"https://api.github.com/repos/{paths.RELEASE_REPO}/releases?per_page=30"
_UA = "decky-rustdeck"
# Decky's loader is frozen and may not find a CA bundle on its own.
_CA_FILE = "/etc/ssl/certs/ca-certificates.crt"


@dataclass
class Release:
    tag: str
    deb_url: str
    sha_url: str | None
    size: int
    published: str


def _ssl_context() -> ssl.SSLContext:
    if os.path.exists(_CA_FILE):
        return ssl.create_default_context(cafile=_CA_FILE)
    return ssl.create_default_context()


def _open(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": _UA, "Accept": "application/vnd.github+json"})
    return urllib.request.urlopen(req, timeout=30, context=_ssl_context())


def _get_json(url: str):
    with _open(url) as r:
        return json.load(r)


def _get_text(url: str) -> str:
    with _open(url) as r:
        return r.read().decode()


async def latest_release() -> Release | None:
    best: Release | None = None
    for rel in await asyncio.to_thread(_get_json, _API):
        if rel.get("draft") or not rel.get("tag_name", "").startswith(paths.RELEASE_TAG_PREFIX):
            continue
        assets = {a["name"]: a for a in rel.get("assets", [])}
        deb = next(
            (a for n, a in assets.items() if n.startswith(paths.RELEASE_ASSET_PREFIX) and n.endswith(".deb")),
            None,
        )
        if deb is None:
            continue
        sha = assets.get(deb["name"] + ".sha256")
        candidate = Release(
            tag=rel["tag_name"],
            deb_url=deb["browser_download_url"],
            sha_url=sha["browser_download_url"] if sha else None,
            size=int(deb.get("size") or 0),
            published=rel.get("published_at") or "",
        )
        if best is None or candidate.published > best.published:
            best = candidate
    return best


def installed() -> dict | None:
    try:
        with open(paths.INSTALLED_JSON) as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def _download(url: str, dest: str, progress: dict) -> str:
    sha = hashlib.sha256()
    with _open(url) as r, open(dest, "wb") as f:
        progress["total"] = int(r.headers.get("Content-Length") or progress.get("total") or 0)
        while chunk := r.read(1 << 16):
            f.write(chunk)
            sha.update(chunk)
            progress["done"] += len(chunk)
    return sha.hexdigest()


async def _unpack(deb: str, root: str) -> None:
    """A .deb is an ar archive; bsdtar reads it and the data.tar.* inside."""
    outer = os.path.join(os.path.dirname(root), "deb")
    os.makedirs(outer)
    os.makedirs(root)
    res = await run("bsdtar", "-xf", deb, "-C", outer, timeout=120)
    if not res.ok:
        raise RuntimeError(f"cannot unpack the deb: {res.err.strip()}")
    data = glob.glob(os.path.join(outer, "data.tar*"))
    if not data:
        raise RuntimeError("the deb has no data.tar")
    res = await run("bsdtar", "-xf", data[0], "-C", root, timeout=300)
    if not res.ok:
        raise RuntimeError(f"cannot unpack data.tar: {res.err.strip()}")


def _shape_extension(root: str) -> None:
    """Make an unpacked deb a sysext: the binary symlink its postinst would create, and a release
    file accepting any OS (`ID=_any`), so SteamOS updates do not reject the extension."""
    os.makedirs(os.path.join(root, "usr/bin"), exist_ok=True)
    link = os.path.join(root, "usr/bin/rustdesk")
    if os.path.lexists(link):
        os.remove(link)
    os.symlink("/usr/share/rustdesk/rustdesk", link)
    rel_dir = os.path.join(root, "usr/lib/extension-release.d")
    os.makedirs(rel_dir, exist_ok=True)
    with open(os.path.join(rel_dir, f"extension-release.{paths.EXT_NAME}"), "w") as f:
        f.write("ID=_any\n")


def _link_extension() -> None:
    if os.path.lexists(paths.EXT_LINK):
        os.remove(paths.EXT_LINK)
    os.makedirs(os.path.dirname(paths.EXT_LINK), exist_ok=True)
    os.symlink(paths.EXT_DIR, paths.EXT_LINK)


async def install(rel: Release, on_progress: Callable[[int, int], object] | None = None) -> None:
    """Download, verify and switch to `rel`. The caller stops the service first: the old payload
    is unmerged from /usr while its files are replaced."""
    os.makedirs(paths.STORE, mode=0o755, exist_ok=True)
    os.chmod(paths.STORE, 0o755)
    staging = tempfile.mkdtemp(prefix=".staging-", dir=paths.STORE)
    try:
        deb = os.path.join(staging, "rustdesk.deb")
        progress = {"done": 0, "total": rel.size}
        task = asyncio.create_task(asyncio.to_thread(_download, rel.deb_url, deb, progress))
        while not task.done():
            if on_progress:
                await on_progress(progress["done"], progress["total"])
            await asyncio.wait({task}, timeout=0.5)
        digest = task.result()
        if rel.sha_url:
            expected = (await asyncio.to_thread(_get_text, rel.sha_url)).split()[0].lower()
            if digest != expected:
                raise RuntimeError(f"checksum mismatch: {digest} != {expected}")
        else:
            util.log.warning("release %s has no checksum file", rel.tag)

        root = os.path.join(staging, "root")
        await _unpack(deb, root)
        _shape_extension(root)

        await run("systemd-sysext", "unmerge", timeout=60)
        if os.path.isdir(paths.EXT_DIR):
            shutil.rmtree(paths.EXT_DIR)
        os.rename(root, paths.EXT_DIR)
        _link_extension()
        res = await run("systemd-sysext", "merge", timeout=60)
        if not res.ok:
            raise RuntimeError(f"systemd-sysext merge failed: {res.err.strip()}")
        await run("systemctl", "daemon-reload")
        with open(paths.INSTALLED_JSON, "w") as f:
            json.dump({**asdict(rel), "installed_at": int(time.time())}, f)
        util.log.info("installed RustDesk %s", rel.tag)
    finally:
        shutil.rmtree(staging, ignore_errors=True)


async def ensure_merged() -> bool:
    """After a reboot the extension is not merged (systemd-sysext.service is not enabled on
    SteamOS); merge it again if the payload is there."""
    if os.path.exists(paths.RUSTDESK):
        return True
    if not os.path.isdir(paths.EXT_DIR):
        return False
    _link_extension()
    await run("systemd-sysext", "refresh", timeout=60)
    return os.path.exists(paths.RUSTDESK)


async def uninstall() -> None:
    await run("systemd-sysext", "unmerge", timeout=60)
    if os.path.lexists(paths.EXT_LINK):
        os.remove(paths.EXT_LINK)
    shutil.rmtree(paths.STORE, ignore_errors=True)
    # Put back any other extension that was merged.
    await run("systemd-sysext", "refresh", timeout=60)
    await run("systemctl", "daemon-reload")
