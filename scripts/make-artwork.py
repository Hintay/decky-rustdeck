#!/usr/bin/env python3
# Generate the Steam artwork for the RustDesk shortcut from RustDesk's icon (a blue ring on white).
# Usage: scripts/make-artwork.py  (needs Pillow; writes assets/artwork/*.png)
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets/rustdesk-icon.png"
OUT = ROOT / "assets/artwork"
BG = (16, 24, 38, 255)


def ring() -> Image.Image:
    """The icon with its white background made transparent, edges un-blended from white."""
    im = Image.open(SRC).convert("RGBA")
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, _ = px[x, y]
            a = 255 - min(r, g, b)
            if a == 0:
                px[x, y] = (0, 0, 0, 0)
                continue
            # c = a*fg + (1-a)*white  =>  fg = (c - (255 - a)) / a
            fg = tuple(max(0, min(255, round((c - (255 - a)) * 255 / a))) for c in (r, g, b))
            px[x, y] = (*fg, a)
    return im.crop(im.getbbox())


def canvas(w: int, h: int, mark: Image.Image, size: int, cx: float, cy: float) -> Image.Image:
    im = Image.new("RGBA", (w, h), BG)
    m = mark.resize((size, size), Image.LANCZOS)
    im.alpha_composite(m, (round(cx * w - size / 2), round(cy * h - size / 2)))
    return im


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    mark = ring()
    canvas(600, 900, mark, 340, 0.5, 0.45).save(OUT / "grid_p.png")
    canvas(920, 430, mark, 260, 0.5, 0.5).save(OUT / "grid_l.png")
    # Steam draws the logo over the hero, so the hero carries no mark of its own.
    Image.new("RGBA", (1920, 620), BG).save(OUT / "hero.png")
    mark.resize((400, 400), Image.LANCZOS).save(OUT / "logo.png")
    for f in sorted(OUT.glob("*.png")):
        print(f.relative_to(ROOT), Image.open(f).size)


if __name__ == "__main__":
    main()
