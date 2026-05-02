"""Print a QR code using the printer's built-in ESC/POS QR support."""

from escpos.printer import File

p = File("/dev/usb/lp0")

p.set(align="center", bold=True)
p.text("Scan me\n")
p.set(align="center")
p.qr("https://github.com/HansF/xp80t", size=6)
p.text("\ngithub.com/HansF/xp80t\n")
p.text("\n\n\n")
p.cut()
