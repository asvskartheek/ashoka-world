# Per-cell colour delta grid (render minus reference), rows top to bottom.
# usage: python3 tools/color_grid.py reference.png render.png
import sys
import numpy as np
from PIL import Image
def cells(path, grid=4):
    img = Image.open(path).convert("RGB").resize((256, 192))
    rgb = np.asarray(img).astype(float) / 255.0
    hsv = np.asarray(img.convert("HSV")).astype(float) / 255.0
    h, w = hsv.shape[:2]
    S = np.zeros((grid, grid)); V = np.zeros((grid, grid)); RB = np.zeros((grid, grid))
    for y in range(grid):
        for x in range(grid):
            sl = (slice(y * h // grid, (y + 1) * h // grid), slice(x * w // grid, (x + 1) * w // grid))
            S[y, x] = hsv[sl][..., 1].mean(); V[y, x] = hsv[sl][..., 2].mean()
            RB[y, x] = (rgb[sl][..., 0] - rgb[sl][..., 2]).mean()  # warmth
    return S, V, RB
a, b = cells(sys.argv[1]), cells(sys.argv[2])
for name, i in (("sat", 0), ("bright", 1), ("warmth R-B", 2)):
    d = b[i] - a[i]
    print(f"{name} delta (mean {d.mean():+.3f})")
    for row in d: print("   " + " ".join(f"{v:+.2f}" for v in row))
