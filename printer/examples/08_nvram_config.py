"""
Xprinter proprietary NVRAM configuration commands.

These commands write settings to the printer's non-volatile memory.
Changes persist across power cycles. Always power-cycle the printer
after sending these commands.
"""

from escpos.printer import File

COMMANDS = {
    # Cutter alarm: 3 beeps + red LED flash after every auto-cut (Kitchen Mode)
    "beep_off":  b'\x1f\x1b\x1f\xe0\x13\x14\x00\x04\x02\x03',
    "beep_on":   b'\x1f\x1b\x1f\xe0\x13\x14\x01\x04\x02\x03',

    # Peel mode: printer beeps repeatedly until the printed paper is removed
    "peel_off":  b'\x1f\x1b\x1f\xbc\x13\x14\x00',
    "peel_on":   b'\x1f\x1b\x1f\xbc\x13\x14\x01',
}


def apply(command_key):
    p = File("/dev/usb/lp0")
    p._raw(COMMANDS[command_key])
    print(f"Sent: {command_key} — power cycle the printer to apply.")


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        print(f"Usage: python 08_nvram_config.py <command>")
        print(f"Commands: {', '.join(COMMANDS)}")
        sys.exit(1)
    apply(sys.argv[1])
