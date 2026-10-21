#!/usr/bin/env python3
"""Objective image QA metrics for Qwen Studio. Pure local Pillow + numpy."""
import json
import sys

import numpy as np
from PIL import Image, ImageFilter


def main(path: str) -> int:
    im = Image.open(path).convert("RGB")
    w, h = im.size
    arr = np.asarray(im, dtype=np.float32) / 255.0
    gray = (0.299 * arr[..., 0] + 0.587 * arr[..., 1] + 0.114 * arr[..., 2])
    # Laplacian edge response (texture/detail proxy).
    lap = np.abs(4 * gray[1:-1, 1:-1] - gray[:-2, 1:-1] - gray[2:, 1:-1] - gray[1:-1, :-2] - gray[1:-1, 2:])
    # High-frequency residual (grain / over-sharpen proxy).
    blur = np.asarray(Image.fromarray((gray * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2)), dtype=np.float32) / 255.0
    grain = np.abs(gray - blur)
    hsv = np.asarray(im.convert("HSV"), dtype=np.float32) / 255.0
    sat = hsv[..., 1]
    ycbcr = np.asarray(im.convert("YCbCr"), dtype=np.float32)
    y, cb, cr = ycbcr[..., 0], ycbcr[..., 1], ycbcr[..., 2]
    skin = (y > 40) & (cb >= 77) & (cb <= 127) & (cr >= 133) & (cr <= 173)
    metrics = {
        "width": w,
        "height": h,
        "megapixels": round(w * h / 1e6, 3),
        "brightness_mean": round(float(gray.mean()), 4),
        "brightness_std": round(float(gray.std()), 4),
        "edge_std": round(float(lap.std() * 100), 3),
        "grain_std": round(float(grain.std() * 100), 3),
        "saturation_mean": round(float(sat.mean()), 4),
        "saturation_std": round(float(sat.std()), 4),
        "skin_ratio": round(float(skin.mean()), 4),
        "highlight_ratio": round(float((gray > 0.97).mean()), 4),
        "shadow_ratio": round(float((gray < 0.03).mean()), 4),
    }
    flags = []
    if metrics["edge_std"] < 1.0:
        flags.append("soft-focus")
    if metrics["grain_std"] > 3.0:
        flags.append("heavy-grain")
    if metrics["grain_std"] > 3.0 and metrics["edge_std"] > 4.5:
        flags.append("texture-overload")
    if metrics["saturation_mean"] < 0.12:
        flags.append("low-saturation")
    if metrics["highlight_ratio"] > 0.12:
        flags.append("clipped-highlights")
    print(json.dumps({"metrics": metrics, "flags": flags}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: score_image.py IMAGE", file=sys.stderr)
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
