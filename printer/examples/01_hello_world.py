"""Minimal example — print text and cut."""

from escpos.printer import File

p = File("/dev/usb/lp0")

p.text("Hello, World!\n\n\n")
p.cut()
