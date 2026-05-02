"""Print barcodes — EAN13, CODE128, and QR side by side."""

from escpos.printer import File

p = File("/dev/usb/lp0")

p.set(align="center", bold=True)
p.text("BARCODES\n")
p.text("-" * 32 + "\n")

# EAN-13 (13 digits)
p.set(align="center")
p.text("EAN-13\n")
p.barcode("5901234123457", "EAN13", height=64, width=2, pos="BELOW")
p.text("\n")

# CODE128 (alphanumeric)
p.text("CODE128\n")
p.barcode("XP80T-2024", "CODE128", height=64, width=2, pos="BELOW")
p.text("\n")

p.text("\n\n")
p.cut()
