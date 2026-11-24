"""Extract game-ready PNGs from the design sheets in assets/.

The sheets are reference art (labels, cards, shadows, speed lines), not export
art. This script finds the five drawings of each action, removes the card
background, drops detached decoration, and writes one horizontal strip per fish
and action into game/art/. It also cuts three parallax bands out of the
environment sheet.

Run from the repository root:

    python scripts/build_art.py

The output is committed, so the game does not need Pillow at runtime.
"""
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "game" / "art"

# Action rows in the animation sheets. Only states level 1 uses are exported;
# the push and pickup rows need prop art that does not exist yet.
# Action rows in each sheet. Only states level 1 uses are exported; the push and
# pickup rows need prop art that does not exist yet. The sheets were laid out
# separately, so C's cards sit about 50 px higher than A's and B's.
AB_ROWS = {"idle": (150, 300), "run": (300, 470), "jump": (470, 660)}
FISH_ROWS = {
    "A": AB_ROWS,
    "B": AB_ROWS,
    "C": {"idle": (80, 250), "run": (280, 450), "jump": (465, 650)},
}
FISH = {
    "A": "fish_A_5frame_animations.png",
    "B": "fish_B_5frame_animations.png",
    "C": "fish_C_5frame_animations.png",
}
# Inner rectangles of the three style-sheet bands (far, mid, foreground).
BANDS = {
    "far": (1008, 238, 1496, 284),
    "mid": (1008, 310, 1496, 364),
    "near": (1008, 390, 1496, 452),
}
# Single-illustration props that level 1 can actually use.
PROPS = {
    "door_closed": (350, 120, 530, 300),
    "door_open": (520, 120, 700, 300),
}


def components(mask):
    """Label 4-connected groups of True cells; returns lists of (x, y, w, h, area)."""
    height, width = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    boxes = []
    for start in range(height * width):
        y0, x0 = divmod(start, width)
        if not mask[y0, x0] or seen[y0, x0]:
            continue
        queue = deque([(x0, y0)])
        seen[y0, x0] = True
        minx = maxx = x0
        miny = maxy = y0
        area = 0
        while queue:
            x, y = queue.popleft()
            area += 1
            minx, maxx = min(minx, x), max(maxx, x)
            miny, maxy = min(miny, y), max(maxy, y)
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= nx < width and 0 <= ny < height and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    queue.append((nx, ny))
        boxes.append((minx, miny, maxx - minx + 1, maxy - miny + 1, area, (x0, y0)))
    return boxes


def frame_boxes(sheet, row):
    """Find the five drawings in one action row by their ink outline."""
    arr = np.asarray(sheet.crop((0, row[0], sheet.width, row[1])).convert("RGB")).astype(int)
    saturated = (arr.max(axis=2) - arr.min(axis=2)) > 55
    dark = arr.max(axis=2) < 110
    ink = saturated | dark
    boxes = [b for b in components(ink) if b[0] >= 252 and b[2] > 40 and b[3] > 40 and b[4] > 1500]
    boxes.sort(key=lambda b: b[4], reverse=True)
    boxes = boxes[:5]
    if len(boxes) != 5:
        raise SystemExit(f"expected 5 drawings in row {row}, found {len(boxes)}")
    boxes.sort(key=lambda b: b[0])
    return [(x, y + row[0], w, h) for x, y, w, h, _, _ in boxes]


def cut_frame(sheet, box):
    """Crop one drawing and return RGBA with the card background removed."""
    x, y, w, h = box
    margin = 8
    card = sheet.crop((x - margin, y - margin, x + w + margin, y + h + margin)).convert("RGB")
    pixels = np.asarray(card).astype(int)
    sat = pixels.max(axis=2) - pixels.min(axis=2)
    val = pixels.max(axis=2)
    # Ink is anything that is colourful or properly dark. The page, the card
    # border and the soft grey ground shadow are none of those.
    ink = (sat > 26) | (val < 160)
    height, width = ink.shape
    # Everything reachable from the border is page or shadow; whatever is left
    # over is the fish, plus enclosed white areas (eyes, vest, highlights).
    outside = np.zeros_like(ink)
    queue = deque()
    for x in range(width):
        for y in (0, height - 1):
            if not ink[y, x] and not outside[y, x]:
                outside[y, x] = True
                queue.append((x, y))
    for y in range(height):
        for x in (0, width - 1):
            if not ink[y, x] and not outside[y, x]:
                outside[y, x] = True
                queue.append((x, y))
    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < width and 0 <= ny < height and not ink[ny, nx] and not outside[ny, nx]:
                outside[ny, nx] = True
                queue.append((nx, ny))

    alpha_np = np.where(outside, 0, 255).astype(np.uint8)
    alpha = Image.fromarray(alpha_np)
    # Keep the fish itself; the sheet's loose sparkles and speed ticks are much
    # smaller detached islands and would otherwise float beside the sprite.
    groups = components(alpha_np > 0)
    if groups:
        biggest = max(g[4] for g in groups)
        keep = np.zeros_like(alpha_np)
        for gx, gy, gw, gh, area, seed in groups:
            if area >= biggest * 0.08:
                queue = deque([seed])
                keep[seed[1], seed[0]] = 255
                while queue:
                    x, y = queue.popleft()
                    for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                        if 0 <= nx < width and 0 <= ny < height and alpha_np[ny, nx] and not keep[ny, nx]:
                            keep[ny, nx] = 255
                            queue.append((nx, ny))
        alpha_np = keep
    # Soften the cut edge; 0.5 px is invisible once the sprite is drawn at
    # roughly a third of this size.
    alpha = Image.fromarray(alpha_np).filter(ImageFilter.GaussianBlur(0.5))
    frame = card.convert("RGBA")
    frame.putalpha(alpha)
    return frame.crop(frame.getbbox())


def build_strip(sheet, fish, action):
    frames = [cut_frame(sheet, b) for b in frame_boxes(sheet, FISH_ROWS[fish][action])]
    cell_w = max(f.width for f in frames)
    cell_h = max(f.height for f in frames)
    strip = Image.new("RGBA", (cell_w * 5, cell_h), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        strip.alpha_composite(frame, (i * cell_w + (cell_w - frame.width) // 2, cell_h - frame.height))
    return strip


def page_alpha(image, tolerance=12):
    """Alpha for a crop on a plain page: border-connected near-white is removed."""
    pixels = np.asarray(image.convert("RGB")).astype(int)
    bg = pixels[0, 0]
    near_bg = np.abs(pixels - bg).max(axis=2) <= tolerance
    height, width = near_bg.shape
    outside = np.zeros_like(near_bg)
    queue = deque()
    for x in range(width):
        for y in (0, height - 1):
            if near_bg[y, x] and not outside[y, x]:
                outside[y, x] = True
                queue.append((x, y))
    for y in range(height):
        for x in (0, width - 1):
            if near_bg[y, x] and not outside[y, x]:
                outside[y, x] = True
                queue.append((x, y))
    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < width and 0 <= ny < height and near_bg[ny, nx] and not outside[ny, nx]:
                outside[ny, nx] = True
                queue.append((nx, ny))
    return np.where(outside, 0, 255).astype(np.uint8)


def build_bands():
    sheet = Image.open(ROOT / "assets" / "environment" / "game_environment_bilingual.png").convert("RGB")
    for name, box in BANDS.items():
        band = sheet.crop(box).convert("RGBA")
        alpha = page_alpha(band).astype(float)
        # Fade the top and bottom edges so the band melts into the water instead
        # of ending on a hard horizontal line.
        fade = 6
        for i in range(fade):
            alpha[i, :] *= i / fade
            alpha[-1 - i, :] *= i / fade
        band.putalpha(Image.fromarray(alpha.astype(np.uint8)))
        band.save(OUT / f"bg_{name}.png", optimize=True)
        print("bg", name, band.size)


def build_props():
    sheet = Image.open(ROOT / "assets" / "environment" / "game_environment_bilingual.png").convert("RGB")
    for name, region in PROPS.items():
        x0, y0, x1, y1 = region
        arr = np.asarray(sheet.crop(region)).astype(int)
        ink = ((arr.max(axis=2) - arr.min(axis=2)) > 26) | (arr.max(axis=2) < 160)
        boxes = [b for b in components(ink) if b[2] > 40 and b[3] > 40]
        if not boxes:
            raise SystemExit(f"no drawing found for {name}")
        x, y, w, h, _, _ = max(boxes, key=lambda b: b[4])
        frame = cut_frame(sheet, (x + x0, y + y0, w, h))
        frame.save(OUT / f"{name}.png", optimize=True)
        print(name, frame.size)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for fish, name in FISH.items():
        sheet = Image.open(ROOT / "assets" / "characters" / "animations" / name).convert("RGB")
        for action in FISH_ROWS[fish]:
            strip = build_strip(sheet, fish, action)
            strip.save(OUT / f"fish_{fish}_{action}.png", optimize=True)
            print(f"fish_{fish}_{action}", strip.size)
    build_bands()
    build_props()


if __name__ == "__main__":
    main()
