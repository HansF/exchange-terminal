#!/usr/bin/env python
"""XP-80T printer configuration and utility tool."""

import sys
import time
import argparse
from escpos.printer import File

DEVICE = "/dev/usb/lp0"

COMMANDS = {
    "beep_off":      b'\x1f\x1b\x1f\xe0\x13\x14\x00\x04\x02\x03',
    "beep_on":       b'\x1f\x1b\x1f\xe0\x13\x14\x01\x04\x02\x03',
    "peel_off":      b'\x1f\x1b\x1f\xbc\x13\x14\x00',
    "peel_on":       b'\x1f\x1b\x1f\xbc\x13\x14\x01',
}

# ESC/POS print density: GS | 05 w (w = 0..8, 4 = default)
DENSITY = {
    "light":   b'\x1d\x7c\x01',
    "normal":  b'\x1d\x7c\x04',
    "dark":    b'\x1d\x7c\x07',
}


def printer():
    return File(DEVICE)


def cmd_beep(args):
    p = printer()
    if args.state == "off":
        p._raw(COMMANDS["beep_off"])
        print("Cutter alarm OFF — power cycle the printer to apply.")
    else:
        p._raw(COMMANDS["beep_on"])
        print("Cutter alarm ON — power cycle the printer to apply.")


def cmd_peel(args):
    p = printer()
    if args.state == "off":
        p._raw(COMMANDS["peel_off"])
        print("Peel mode OFF — power cycle the printer to apply.")
    else:
        p._raw(COMMANDS["peel_on"])
        print("Peel mode ON — power cycle the printer to apply.")


def cmd_density(args):
    p = printer()
    p._raw(DENSITY[args.level])
    print(f"Print density set to '{args.level}'.")


def cmd_buzz(args):
    # ESC B n t — beep n times for t*100ms each
    n = max(1, min(args.times, 9))
    t = max(1, min(args.duration, 9))
    p = printer()
    p._raw(b'\x1b\x42' + bytes([n, t]))
    print(f"Buzzed {n}x for {t*100}ms each.")


def cmd_cut(args):
    p = printer()
    p.text("\n\n\n")
    time.sleep(0.3)
    mode = "PART" if args.partial else "FULL"
    p.cut(mode=mode)
    print(f"{mode} cut done.")


def cmd_feed(args):
    p = printer()
    p.text("\n" * args.lines)
    print(f"Fed {args.lines} lines.")


def cmd_test(args):
    p = printer()
    p.set(align="center", bold=True, height=2, width=2)
    p.text("XP-80T\n")
    p.set(align="center", bold=False, height=1, width=1)
    p.text("python-escpos test\n")
    p.text("-" * 32 + "\n")
    p.set(align="left")
    p.text("Normal text\n")
    p.set(bold=True)
    p.text("Bold text\n")
    p.set(bold=False, underline=1)
    p.text("Underline text\n")
    p.set(underline=0, align="center")
    p.text("\nALIGN CENTER\n")
    p.set(align="right")
    p.text("ALIGN RIGHT\n")
    p.text("-" * 32 + "\n\n\n")
    p.cut()
    print("Test page printed.")


def cmd_image(args):
    from PIL import Image as PILImage
    PRINT_WIDTH = 576
    img = PILImage.open(args.file).convert("RGB")
    ratio = PRINT_WIDTH / img.width
    img = img.resize((PRINT_WIDTH, int(img.height * ratio)), PILImage.LANCZOS)
    img = img.convert("L").point(lambda x: 0 if x < 128 else 255, "1")
    p = printer()
    p.image(img, impl="bitImageRaster")
    p.text("\n\n\n")
    time.sleep(0.5)
    p.cut()
    print(f"Printed {args.file}.")


def main():
    ap = argparse.ArgumentParser(
        prog="xp80t",
        description="XP-80T printer configuration and utility tool"
    )
    sub = ap.add_subparsers(dest="cmd", required=True)

    # beep
    p_beep = sub.add_parser("beep", help="Cutter alarm on/off (needs power cycle)")
    p_beep.add_argument("state", choices=["on", "off"])
    p_beep.set_defaults(func=cmd_beep)

    # peel
    p_peel = sub.add_parser("peel", help="Peel mode on/off (needs power cycle)")
    p_peel.add_argument("state", choices=["on", "off"])
    p_peel.set_defaults(func=cmd_peel)

    # density
    p_den = sub.add_parser("density", help="Print density")
    p_den.add_argument("level", choices=["light", "normal", "dark"])
    p_den.set_defaults(func=cmd_density)

    # buzz
    p_buzz = sub.add_parser("buzz", help="Trigger buzzer manually")
    p_buzz.add_argument("--times", type=int, default=1, help="Number of beeps (1-9)")
    p_buzz.add_argument("--duration", type=int, default=3, help="Duration per beep in 100ms units (1-9)")
    p_buzz.set_defaults(func=cmd_buzz)

    # cut
    p_cut = sub.add_parser("cut", help="Feed and cut paper")
    p_cut.add_argument("--partial", action="store_true", help="Partial cut instead of full")
    p_cut.set_defaults(func=cmd_cut)

    # feed
    p_feed = sub.add_parser("feed", help="Feed paper N lines")
    p_feed.add_argument("lines", type=int, nargs="?", default=3)
    p_feed.set_defaults(func=cmd_feed)

    # test
    p_test = sub.add_parser("test", help="Print a test page")
    p_test.set_defaults(func=cmd_test)

    # image
    p_img = sub.add_parser("image", help="Print an image file (auto B&W convert)")
    p_img.add_argument("file", help="Path to image file")
    p_img.set_defaults(func=cmd_image)

    args = ap.parse_args()
    try:
        args.func(args)
    except FileNotFoundError:
        print(f"Device not found: {DEVICE}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
