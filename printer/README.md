# xp80t — Xprinter XP-80T Python Toolkit

A Python toolkit for driving the **Xprinter XP-80T** 80mm USB thermal receipt printer on Linux using raw ESC/POS — no CUPS required.

## Hardware

| Spec | Value |
|---|---|
| Print method | Direct thermal |
| Print width | 72 mm |
| Dot density | 576 dots/row |
| Print speed | 200 mm/s |
| Interface | USB / USB + Ethernet |
| Paper width | 79.5 ± 0.5 mm |
| Paper thickness | 0.06–0.08 mm |

## How it works

The printer is exposed by the Linux `usblp` kernel module at `/dev/usb/lp0`. The toolkit writes raw ESC/POS bytes directly to that device node — no CUPS, no driver install needed.

Your user must be in the `lp` group:

```bash
sudo usermod -aG lp $USER
# log out and back in
```

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Usage

```bash
python xp80t.py <command> [options]
```

| Command | Example | Description |
|---|---|---|
| `test` | `python xp80t.py test` | Print a test page with formatting samples |
| `image` | `python xp80t.py image photo.png` | Print any image (auto-converts to B&W) |
| `cut` | `python xp80t.py cut` | Feed and cut paper |
| `cut` | `python xp80t.py cut --partial` | Partial cut |
| `feed` | `python xp80t.py feed 5` | Feed N lines |
| `density` | `python xp80t.py density dark` | Print density: `light` / `normal` / `dark` |
| `beep` | `python xp80t.py beep off` | Disable cutter alarm (see below) |
| `peel` | `python xp80t.py peel on` | Peel mode: beeps until paper is removed |
| `buzz` | `python xp80t.py buzz --times 2 --duration 5` | Trigger buzzer manually |

## Cutter alarm (3 beeps + red LED flash)

The XP-80T ships in **Kitchen Mode** by default. In this mode the printer emits 3 beeps and flashes the red LED after every auto-cut — this is intentional firmware behavior to alert kitchen staff that a receipt is ready. It is **not** an error.

To disable it, run the command once and then power-cycle the printer. The setting is written to NVRAM and survives reboots:

```bash
python xp80t.py beep off
# power cycle the printer
```

To re-enable:

```bash
python xp80t.py beep on
# power cycle the printer
```

### How it works under the hood

The beep behavior is controlled via a proprietary Xprinter NVRAM command outside the standard ESC/POS spec:

```python
# Disable cutter alarm
b'\x1f\x1b\x1f\xe0\x13\x14\x00\x04\x02\x03'

# Enable cutter alarm
b'\x1f\x1b\x1f\xe0\x13\x14\x01\x04\x02\x03'
```

Sent via `printer._raw(cmd)`.

## DIP switches

The XP-80T has physical DIP switches on the underside of the chassis for hardware-level configuration:

| Switch | ON | OFF |
|---|---|---|
| SW-1 | Cutter disabled | Cutter enabled |
| SW-2 | Beeper enabled | Beeper disabled |
| SW-3 | Dark / high density | Normal density |
| SW-6 | Kitchen alarm on cut | Alarm disabled |
| SW-8 | 115200 bps | 9600 bps |

## Printing images

Images are automatically resized to 576px wide and converted to 1-bit black & white before sending. The `bitImageRaster` ESC/POS mode is used for reliable buffer handling.

```bash
python xp80t.py image myfile.png
```

## Cut alignment & feed timing

The cutter blade sits **~18 mm above the print head**. After printing, you must feed paper past the blade before cutting, or the cut lands inside your content.

**Calibrated value:** `3` newlines of feed before `p.cut()` produces an 18 mm gap from the last printed line to the cut — exactly enough to clear the bottom of a typical receipt without leaving extra blank paper.

```python
p.image(img, impl="bitImageRaster")
p.text("\n" * 3)   # ~18 mm — clears the cutter blade
time.sleep(0.5)    # see "Race conditions" below
p.cut()
```

Each newline at the printer's default line height advances the paper roughly **5 mm**. So:

| Newlines | Approx. gap |
|---|---|
| 3 | 18 mm ← correct |
| 5 | 28 mm |
| 7 | 38 mm |

If a future content layout changes the visual cut position, adjust `cmd_image` in `xp80t.py` — don't pad your source images.

### Race conditions on cut

`p.image()` queues a large block of raster data; `p.cut()` is just a few bytes. Both are written to `/dev/usb/lp0` and processed by the printer in order, but the kernel/USB pipeline can briefly hold the cut command in a position where the printer interprets it before the entire image has physically rolled past the head.

Symptoms:
- Cut line appears **inside** the printed image (e.g. above a footer that should have been above the cut)
- Footer reappears as the first content of the next ticket

The fix in `cmd_image` is the explicit `time.sleep(0.5)` between `p.text("\n" * 3)` and `p.cut()`. This gives the printer time to drain its raster buffer before processing the cut command. Removing the sleep brings the bug back.

If you ever see cuts landing inside content again, the first thing to try is a longer sleep (e.g. `1.0`) — not more newlines.

## Using as a library

```python
from escpos.printer import File
from PIL import Image
import time

p = File("/dev/usb/lp0")

# Text
p.set(align="center", bold=True)
p.text("Hello!\n")

# Image
img = Image.open("photo.png").convert("RGB")
img = img.resize((384, int(img.height * 384 / img.width)))
img = img.convert("L").point(lambda x: 0 if x < 128 else 255, "1")
p.image(img, impl="bitImageRaster")

# Cut
p.text("\n\n\n")
time.sleep(0.5)
p.cut()
```

## Examples

Runnable scripts in the [`examples/`](examples/) folder:

| File | Description |
|---|---|
| [`01_hello_world.py`](examples/01_hello_world.py) | Minimal print + cut |
| [`02_text_formatting.py`](examples/02_text_formatting.py) | Alignment, bold, underline, size |
| [`03_receipt.py`](examples/03_receipt.py) | Full receipt with items, VAT, totals |
| [`04_image.py`](examples/04_image.py) | Print any image (auto B&W) |
| [`05_qrcode.py`](examples/05_qrcode.py) | Built-in ESC/POS QR code |
| [`06_barcode.py`](examples/06_barcode.py) | EAN-13 and CODE128 barcodes |
| [`07_kitchen_order.py`](examples/07_kitchen_order.py) | Large-text kitchen order ticket |
| [`08_nvram_config.py`](examples/08_nvram_config.py) | Proprietary NVRAM config commands |

```bash
source .venv/bin/activate
python examples/03_receipt.py
```

## References

- [Xprinter user manual](https://www.xprintertech.com/pos-printer-user-manual)
- [Xprinter drivers](https://www.xprintertech.com/drivers-2)
- [python-escpos](https://python-escpos.readthedocs.io)
