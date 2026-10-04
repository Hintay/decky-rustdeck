# Subprocess helpers for the plugin backend.
import asyncio
import logging
import os
import pwd
from dataclasses import dataclass

log = logging.getLogger("rustdeck")


def set_logger(logger: logging.Logger) -> None:
    global log
    log = logger


def clean_env(extra: dict[str, str] | None = None) -> dict[str, str]:
    """Environment for system binaries.

    Decky's loader is a PyInstaller bundle and exports its own library dir through
    LD_LIBRARY_PATH, which breaks system tools linked against newer libraries.
    """
    env = dict(os.environ)
    orig = env.pop("LD_LIBRARY_PATH_ORIG", None)
    if orig is not None:
        env["LD_LIBRARY_PATH"] = orig
    else:
        env.pop("LD_LIBRARY_PATH", None)
    if extra:
        env.update(extra)
    return env


@dataclass
class Result:
    code: int
    out: str
    err: str

    @property
    def ok(self) -> bool:
        return self.code == 0


async def run(*args: str, timeout: float = 60, env: dict[str, str] | None = None) -> Result:
    """Run a program directly (never through a shell: root's shell on SteamOS is zsh)."""
    proc = await asyncio.create_subprocess_exec(
        *args,
        stdin=asyncio.subprocess.DEVNULL,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=clean_env(env),
    )
    try:
        out, err = await asyncio.wait_for(proc.communicate(), timeout)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        log.warning("timed out after %ss: %s", timeout, " ".join(args))
        return Result(-1, "", "timeout")
    res = Result(proc.returncode or 0, out.decode(errors="replace"), err.decode(errors="replace"))
    if not res.ok:
        log.debug("exit %d: %s: %s", res.code, " ".join(args), res.err.strip()[:300])
    return res


def deck_user() -> pwd.struct_passwd:
    """The desktop user (the plugin itself runs as root)."""
    name = os.environ.get("DECKY_USER") or "deck"
    return pwd.getpwnam(name)
