#!/usr/bin/env python3
"""Generate build/icon.png and build/icon.ico from build/gridlock.png."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / "build"
SOURCE = BUILD / "gridlock.png"
PNG_OUT = BUILD / "icon.png"
ICO_OUT = BUILD / "icon.ico"
ICO_SIZES = (16, 32, 48, 64, 128, 256)


def main() -> None:
    if not SOURCE.is_file():
        raise SystemExit(f"Missing source logo: {SOURCE}")

    BUILD.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE).convert("RGBA")

    master = source.resize((512, 512), Image.Resampling.LANCZOS)
    master.save(PNG_OUT)

    icons = [source.resize((size, size), Image.Resampling.LANCZOS) for size in ICO_SIZES]
    icons[-1].save(
        ICO_OUT,
        format="ICO",
        sizes=[(size, size) for size in ICO_SIZES],
        append_images=icons[:-1],
    )

    print(f"Wrote {PNG_OUT}")
    print(f"Wrote {ICO_OUT}")


if __name__ == "__main__":
    main()
