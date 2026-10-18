"""Validate selected images without importing MLX or starting the inference service."""
import json
from pathlib import Path
import sys
import warnings
from PIL import Image, ImageOps


def normalize(source, output, kind):
    Image.MAX_IMAGE_PIXELS = 32_000_000
    with warnings.catch_warnings():
        warnings.simplefilter('error', Image.DecompressionBombWarning)
        with Image.open(source) as image:
            if image.format not in ('PNG', 'JPEG', 'WEBP'): raise ValueError('请选择 PNG、JPEG 或 WebP 图片')
            if image.width * image.height > 32_000_000 or max(image.size) > 8192:
                raise ValueError('图片应不超过8192像素边长及3200万像素')
            if getattr(image, 'n_frames', 1) != 1: raise ValueError('请选择单帧图片')
            image = ImageOps.exif_transpose(image)
            if image.mode == 'RGBA' or 'transparency' in image.info:
                rgba = image.convert('RGBA')
                background = Image.new('RGBA', image.size, (0, 0, 0, 255) if kind == 'mask' else (255, 255, 255, 255))
                image = Image.alpha_composite(background, rgba)
            image = image.convert('L' if kind == 'mask' else 'RGB')
            image.save(output, format='PNG')
            if Path(output).stat().st_size > 64 * 1024 ** 2:
                raise ValueError('转换后的 PNG 超过64MB，请缩小图片后重试')
            return dict(width=image.width, height=image.height)


if __name__ == '__main__':
    try:
        print(json.dumps(normalize(Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3])))
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
