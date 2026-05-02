"""A realistic receipt with header, line items, totals and footer."""

from escpos.printer import File
from datetime import datetime

COLS = 32  # printable columns at normal width


def divider(p):
    p.set(align="left", bold=False)
    p.text("-" * COLS + "\n")


def row(p, label, value, bold=False):
    """Left-aligned label, right-aligned value on one line."""
    p.set(bold=bold)
    gap = COLS - len(label) - len(value)
    p.text(f"{label}{' ' * max(1, gap)}{value}\n")


p = File("/dev/usb/lp0")

# Header
p.set(align="center", bold=True, height=2, width=2)
p.text("MY SHOP\n")
p.set(align="center", bold=False, height=1, width=1)
p.text("123 Main Street, Brussels\n")
p.text("VAT: BE 0123.456.789\n")
p.text(datetime.now().strftime("%d/%m/%Y  %H:%M") + "\n")
divider(p)

# Items
items = [
    ("Espresso",       1,  2.50),
    ("Croissant",      2,  1.80),
    ("Orange juice",   1,  3.20),
    ("Sparkling water",1,  2.00),
]

for name, qty, price in items:
    total = qty * price
    label = f"{qty}x {name}"
    row(p, label, f"€{total:.2f}")

divider(p)

subtotal = sum(q * pr for _, q, pr in items)
vat      = subtotal * 0.21
total    = subtotal + vat

row(p, "Subtotal",   f"€{subtotal:.2f}")
row(p, "VAT (21%)",  f"€{vat:.2f}")
divider(p)
row(p, "TOTAL",      f"€{total:.2f}", bold=True)
divider(p)

# Payment
row(p, "Cash",       "€15.00")
row(p, "Change",     f"€{15.00 - total:.2f}")

# Footer
p.set(align="center", bold=False)
p.text("\nThank you for your visit!\n")
p.text("www.myshop.be\n")
p.text("\n\n\n")
p.cut()
