#!/usr/bin/env python3
# Generate the Steam artwork for the RustDesk shortcut from RustDesk's official SVGs in assets/brand
# (res/logo.svg and res/rustdesk-banner.svg in rustdesk/rustdesk), rendered by headless Chrome.
# Usage: scripts/make-artwork.py  (set CHROME if Chrome is not at its usual place; writes assets/artwork/*.png)
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BRAND = ROOT / "assets/brand"
OUT = ROOT / "assets/artwork"
BG = "#101826"
# The banner's wordmark is unfilled (black); Steam shows the logo over dark art, so make it white.
WORDMARK = "#ffffff"
# The banner's viewBox spans the ring (26 units wide) and then the wordmark.
BANNER_VIEWBOX = (66.993, 897.484, 113.652, 26)
WORDMARK_X = 95.5


def chrome() -> str:
    for c in (os.environ.get("CHROME"), "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
              shutil.which("google-chrome"), shutil.which("chromium")):
        if c and Path(c).exists():
            return c
    raise SystemExit("Chrome not found; set CHROME")


def svg(name: str) -> str:
    return re.sub(r"<\?xml[^>]*>", "", (BRAND / name).read_text())


def banner(height: int, part: str = "all") -> str:
    """The banner SVG at `height` px: the ring and wordmark, or only the wordmark."""
    s = svg("rustdesk-banner.svg").replace("<path d=", f'<path fill="{WORDMARK}" d=', 1)
    x, y, w, h = BANNER_VIEWBOX
    if part == "wordmark":
        w, x = x + w - WORDMARK_X, WORDMARK_X
    s = re.sub(r'viewBox="[^"]*"', f'viewBox="{x} {y} {w} {h}" height="{height}" width="{round(height * w / h)}"', s, 1)
    return s


def ring(size: int) -> str:
    # Prefix its gradient ids so they cannot clash with the banner's on the same page.
    s = re.sub(r'(id="|#)([ab])\b', r"\1ring-\2", svg("logo.svg"))
    return re.sub(r'width="26" height="26"', f'width="{size}" height="{size}"', s, 1)


def page(w: int, h: int, body: str, background: str) -> str:
    return f"""<!doctype html><html><body style="margin:0;width:{w}px;height:{h}px;overflow:hidden;
background:{background};display:flex;flex-direction:column;align-items:center;justify-content:center">
{body}</body></html>"""


# A soft glow in RustDesk's colors behind the art, so it does not look like a flat fill.
GLOW = f"radial-gradient(ellipse at 50% 42%, rgba(0,113,255,0.30), rgba(0,191,225,0.06) 55%, transparent 75%), {BG}"

ASSETS = {
    "grid_p": (600, 900, f'{ring(300)}<div style="height:56px"></div>{banner(84, "wordmark")}', GLOW),
    "grid_l": (920, 430, banner(120), GLOW),
    # Steam draws the logo over the hero, so the hero carries no mark of its own.
    "hero": (1920, 620, "", GLOW),
    "logo": (874, 200, banner(200), "transparent"),
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    exe = chrome()
    with tempfile.TemporaryDirectory() as tmp:
        for name, (w, h, body, background) in ASSETS.items():
            html = Path(tmp) / f"{name}.html"
            html.write_text(page(w, h, body, background))
            subprocess.run(
                [exe, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
                 "--default-background-color=00000000", f"--window-size={w},{h}",
                 f"--screenshot={OUT / f'{name}.png'}", html.as_uri()],
                check=True, capture_output=True,
            )
            print(f"assets/artwork/{name}.png {w}x{h}")


if __name__ == "__main__":
    main()
