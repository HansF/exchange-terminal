"""Text formatting: alignment, bold, underline, size."""

from escpos.printer import File

p = File("/dev/usb/lp0")

# Alignment
p.set(align="center", bold=True, height=2, width=2)
p.text("MY SHOP\n")
p.set(align="center", bold=False, height=1, width=1)
p.text("123 Main Street\n")
p.text("tel: 0123 456 789\n")
p.text("-" * 32 + "\n")

# Left-aligned body
p.set(align="left")
p.text("Normal text\n")

p.set(bold=True)
p.text("Bold text\n")

p.set(bold=False, underline=1)
p.text("Underlined text\n")

p.set(underline=0, height=2)
p.text("Double height\n")

p.set(height=1, width=2)
p.text("Double wide\n")

p.set(width=1)
p.text("-" * 32 + "\n")

# Right-aligned total
p.set(align="right", bold=True)
p.text("TOTAL: €12.50\n")

p.set(align="left", bold=False)
p.text("\n\n\n")
p.cut()
