"""Build web-sized copies of the approved art into docs/assets.

Originals under source/ are read and never written. Frames are resized
in full (no crop). Tiles stay square, so the resize keeps the whole icon.
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "source"
OUT = ROOT / "docs" / "assets"


def save_webp(im: Image.Image, path: Path, quality: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "WEBP", quality=quality, method=6)


def fit_width(im: Image.Image, width: int) -> Image.Image:
    if im.width == width:
        return im
    height = round(im.height * (width / im.width))
    return im.resize((width, height), Image.Resampling.LANCZOS)


def square(im: Image.Image, size: int) -> Image.Image:
    if im.width != im.height:
        raise SystemExit(f"expected a square tile, got {im.size}")
    return im.resize((size, size), Image.Resampling.LANCZOS)


def main() -> None:
    bg = Image.open(SRC / "art" / "slot-bg@2x.png").convert("RGB")
    save_webp(fit_width(bg, 2400), OUT / "bg.webp", 72)

    banner = Image.open(SRC / "banner" / "banner.png").convert("RGB")
    save_webp(fit_width(banner, 1920), OUT / "banner.webp", 76)

    logo = Image.open(SRC / "art" / "logo2-alpha.png").convert("RGBA")
    save_webp(fit_width(logo, 960), OUT / "logo.webp", 82)

    tiles = [
        "wild",
        "scatter",
        "crown",
        "sword",
        "shield",
        "7",
        "A",
        "K",
        "Q",
        "J",
        "10",
    ]
    for name in tiles:
        tile = Image.open(SRC / "art" / "tiles" / f"{name}.png").convert("RGB")
        save_webp(square(tile, 480), OUT / "tiles" / f"{name}.webp", 78)

    icon = square(Image.open(SRC / "art" / "tiles" / "crown.png").convert("RGBA"), 64)
    icon.save(ROOT / "docs" / "favicon.png", "PNG")
    icon.resize((32, 32), Image.Resampling.LANCZOS).save(
        ROOT / "docs" / "favicon.ico", format="ICO", sizes=[(32, 32)]
    )

    for path in sorted(OUT.rglob("*")):
        if path.is_file():
            print(f"{path.relative_to(ROOT)} {path.stat().st_size // 1024}KB")


if __name__ == "__main__":
    main()
