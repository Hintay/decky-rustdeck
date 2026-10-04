# RustDesk's own CLI. Settings changes need root and an installed (under /usr) binary.
import asyncio

from . import paths
from .util import run

SERVER_OPTIONS = ("custom-rendezvous-server", "relay-server", "api-server", "key")

# Each CLI call starts a full RustDesk process, so only a few run at once.
_CLI_SLOTS = asyncio.Semaphore(4)

# Options the settings page may change. "approve-mode" is left out on purpose: click-to-accept
# needs RustDesk's connection window, which gamescope never shows, so a session would hang.
EDITABLE_OPTIONS = SERVER_OPTIONS + (
    "verification-method",
    "temporary-password-length",
    "whitelist",
    "enable-keyboard",
    "enable-clipboard",
    "enable-file-transfer",
    "enable-audio",
    "enable-remote-restart",
    "enable-record-session",
    "enable-lan-discovery",
    "direct-server",
)


def option_off_by_default(name: str) -> bool:
    """Mirror of hbb_common's `option2bool`: these are on only when set to "Y"."""
    return name.startswith("allow-") or name in ("direct-server", "force-always-relay", "stop-service")


async def get_id() -> str | None:
    res = await run(paths.RUSTDESK, "--get-id", timeout=15)
    out = res.out.strip()
    return out if res.ok and out.isdigit() else None


async def get_option(name: str) -> str:
    async with _CLI_SLOTS:
        res = await run(paths.RUSTDESK, "--option", name, timeout=15)
    return res.out.strip() if res.ok else ""


async def get_options(names) -> dict[str, str]:
    """Several options through the CLI, for when no --server answers over IPC."""
    names = list(names)
    return dict(zip(names, await asyncio.gather(*(get_option(n) for n in names))))


async def set_option(name: str, value: str) -> bool:
    return (await run(paths.RUSTDESK, "--option", name, value, timeout=15)).ok


async def apply_config(config: str) -> bool:
    """Apply a server configuration string as exported by RustDesk (host, relay, api, key)."""
    return (await run(paths.RUSTDESK, "--config", config, timeout=15)).ok
