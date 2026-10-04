# gamescope forced composition: while set, every frame is composited onto the primary KMS plane,
# which is the only plane the DRM capture reads (overlays such as the Quick Access Menu and
# hardware-scaled low resolution games are otherwise missing or rejected).
from .util import deck_user, run

_ATOM = "GAMESCOPE_COMPOSITE_FORCE"


async def _xprop(*args: str):
    user = deck_user()
    return await run(
        "runuser", "-u", user.pw_name, "--",
        "env", "DISPLAY=:0", f"XDG_RUNTIME_DIR=/run/user/{user.pw_uid}",
        "xprop", "-root", *args,
        timeout=10,
    )


async def set_forced(on: bool) -> bool:
    if on:
        return (await _xprop("-f", _ATOM, "32c", "-set", _ATOM, "1")).ok
    return (await _xprop("-remove", _ATOM)).ok


async def is_forced() -> bool:
    res = await _xprop(_ATOM)
    return res.ok and res.out.strip().endswith("= 1")
