# The root `rustdesk --service`, run as a transient systemd unit: it survives plugin loader
# restarts, and goes away with a reboot, after which the plugin starts it again if enabled.
from . import paths, util
from .util import run

# Anchored on the binary path: an unanchored "rustdesk --" also matches unrelated command
# lines, such as an ssh session that merely mentions it.
_PROCESS_PATTERN = "^(" + "|".join(paths.RUSTDESK_EXES) + ") --"
_SERVER_PATTERN = "^" + paths.RUSTDESK_EXES[1] + " --server"


async def is_active() -> bool:
    return (await run("systemctl", "is-active", "--quiet", paths.SERVICE_UNIT)).ok


async def start(prefer_portal: bool = False) -> bool:
    if await is_active():
        return True
    await run("systemctl", "reset-failed", paths.SERVICE_UNIT)
    args = [
        "systemd-run",
        f"--unit={paths.SERVICE_UNIT}",
        "--description=RustDesk (RustDeck)",
        "-p", "Restart=on-failure",
        "-p", "RestartSec=3",
        "-p", "KillMode=mixed",
        "-p", "TimeoutStopSec=15",
        "-p", "LimitNOFILE=100000",
        "-p", "After=systemd-user-sessions.service",
        # Same as the unit file the deb ships.
        "--setenv=PULSE_LATENCY_MSEC=60",
        "--setenv=PIPEWIRE_LATENCY=1024/48000",
    ]
    if prefer_portal:
        args.append("--setenv=RUSTDESK_GAMESCOPE_PREFER_PORTAL=1")
    args += [paths.RUSTDESK, "--service"]
    res = await run(*args)
    if not res.ok:
        util.log.error("failed to start %s: %s", paths.SERVICE_UNIT, res.err.strip())
    return res.ok


async def stop() -> None:
    await run("systemctl", "stop", paths.SERVICE_UNIT, timeout=30)
    await run("systemctl", "reset-failed", paths.SERVICE_UNIT)
    # The per-session --server children run under sudo and may outlive the unit's cgroup.
    await run("pkill", "-f", _PROCESS_PATTERN)


async def restart_server() -> None:
    """Kill the per-session --server; the service starts a new one, dropping every connection."""
    await run("pkill", "-f", _SERVER_PATTERN)
