"""Print an image file — auto-resizes and converts to 1-bit B&W."""

import sys
import time
from escpos.printer import File
from PIL import Image

PRINT_WIDTH = 384  # safe pixel width for XP-80T


def print_image(path):
    img = Image.open(path).convert("RGB")

    # Resize to printer width, preserve aspect ratio
    ratio = PRINT_WIDTH / img.width
    img = img.resize((PRINT_WIDTH, int(img.height * ratio)), Image.LANCZOS)

    # Convert to 1-bit B&W via threshold
    img = img.convert("L").point(lambda x: 0 if x < 128 else 255, "1")

    p = File("/dev/usb/lp0")
    p.image(img, impl="bitImageRaster")
    p.text("\n\n\n")
    time.sleep(0.5)
    p.cut()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python 04_image.py <image_path>")
        sys.exit(1)
    print_image(sys.argv[1])
