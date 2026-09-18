"""Generate the PWA / desktop icons without any image library (pure-Python PNG writer).

    python3 scripts/make-icons.py

Draws the brand mark (teal sphere on the dark panel colour) at 192, 512 and 1024 px.
The Tauri bundle icons are derived from icon-1024.png with `pnpm tauri icon` (see docs/PACKAGING.md).
"""

from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "public" / "icons"
BG = (0x12, 0x15, 0x1A)
TEAL = (0x4F, 0xB3, 0xBF)
HIGHLIGHT = (0x9B, 0xE3, 0xEA)
DEEP = (0x2B, 0x6F, 0x77)


def png(width: int, height: int, rows: list[bytes]) -> bytes:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + r for r in rows)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


def lerp(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    t = max(0.0, min(1.0, t))
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))  # type: ignore[return-value]


def render(size: int) -> bytes:
    rows: list[bytes] = []
    cx = cy = size / 2
    r = size * 0.34
    lx, ly = size * 0.38, size * 0.36  # highlight centre
    for y in range(size):
        row = bytearray()
        for x in range(size):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if d <= r:
                edge = min(1.0, (r - d) / max(1.0, size * 0.01))  # anti-aliased rim
                t = min(1.0, math.hypot(x - lx, y - ly) / (r * 1.6))
                colour = lerp(HIGHLIGHT, TEAL, t * 1.3)
                colour = lerp(colour, DEEP, max(0.0, (d / r) ** 3 - 0.35))
                colour = lerp(BG, colour, edge)
            else:
                colour = BG
            row += bytes(colour)
        rows.append(bytes(row))
    return png(size, size, rows)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for size in (192, 512, 1024):
        (OUT / f"icon-{size}.png").write_bytes(render(size))
        print(f"wrote {OUT / f'icon-{size}.png'}")


if __name__ == "__main__":
    main()
