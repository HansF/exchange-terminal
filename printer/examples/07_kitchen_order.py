"""Kitchen order ticket — large text, bold, easy to read across the kitchen."""

from escpos.printer import File
from datetime import datetime

p = File("/dev/usb/lp0")

order = {
    "number": 42,
    "table":  7,
    "time":   datetime.now().strftime("%H:%M"),
    "items": [
        ("BURGER",        "no onion"),
        ("FRIES",         "large"),
        ("VEGGIE WRAP",   "extra sauce"),
        ("SPARKLING",     ""),
    ],
}

# Header
p.set(align="center", bold=True, height=2, width=2)
p.text(f"ORDER #{order['number']}\n")
p.set(height=1, width=1)
p.text(f"Table {order['table']}  —  {order['time']}\n")
p.text("=" * 24 + "\n")

# Items
for item, note in order["items"]:
    p.set(align="left", bold=True, height=2, width=1)
    p.text(f"* {item}\n")
    if note:
        p.set(bold=False, height=1)
        p.text(f"  >> {note}\n")

p.set(bold=False, height=1, width=1)
p.text("=" * 24 + "\n")
p.text("\n\n\n")
p.cut()
