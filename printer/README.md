# Thermal Printer Setup Guide

This document covers thermal receipt printer setup for use with the **exchange-terminal** apps and the **[printd](https://github.com/HansF/printd)** ESC/POS service.

---

## Compatible Printer Models

Any ESC/POS-compatible receipt printer should work. Commonly tested models:

| Brand    | Model                    | Connection               |
| -------- | ------------------------ | ------------------------ |
| Epson    | TM-T20II, TM-T82, TM-m30 | USB, Ethernet, USB-OBD   |
| Star     | TSP143III, TSP100IV      | USB, Ethernet, Bluetooth |
| Rongta   | RP326U, RP80USB          | USB                      |
| Bixolon  | SRP-350III               | USB                      |
| Xprinter | XP-58, XP-80             | USB                      |
| Aures    | AU-580                   | USB                      |

**Key requirement**: The printer must support ESC/POS command language (nearly all receipt printers do).

---

## Connection Methods

### USB (direct)

The simplest setup for local / kiosk deployments.

1. Plug the printer into a USB port on the host machine.
2. Linux will enumerate it as `/dev/usb/lp0` (or `/dev/lp0`).
3. Verify:
   ```bash
   ls -l /dev/usb/lp0
   # Expected output: crw-rw---- 1 root lp ... /dev/usb/lp0
   ```
4. Set ownership so the printd container can access it:
   ```bash
   chmod 666 /dev/usb/lp0
   ```

> **Tip**: For persistent permissions, add a udev rule:
>
> ```
> # /etc/udev/rules.d/99-usb-printer.rules
> SUBSYSTEM=="usb", ATTRS{idVendor}=="XXXX", ATTRS{idProduct}=="XXXX", MODE="0666", GROUP="lp"
> ```

### USB-OBD (OBD-II cable)

Some Epson printers (TM-T20II, TM-T88) ship with an OBD-II-to-USB cable. The OS sees it as a standard USB serial device (`/dev/ttyACM0` or `/dev/ttyUSB0`). Printd supports this via the `serial` connector.

### Ethernet (network)

1. Connect the printer to the LAN via Ethernet.
2. Assign a static IP (via DHCP reservation or manual config on the printer).
3. Configure printd to use the `network` connector:
   ```env
   PRINTD_PRINTER_KIND=network
   PRINTD_DEVICE=192.168.1.100:9100
   ```

### Bluetooth

Bluetooth printers work on Linux with BlueZ. Pair the printer, then printd can use the resulting `/dev/rfcomm0` serial device.

---

## printd Daemon Setup

[printd](https://github.com/HansF/printd) is a standalone HTTP service that handles ESC/POS formatting, image pipeline (threshold, lightening, density), and hardware communication.

### Installation

```bash
git clone https://github.com/HansF/printd ~/Projects/printd
cd ~/Projects/printd
```

### Configuration

Copy and edit the environment file:

```bash
cp .env.example .env
```

Key variables:

| Variable              | Default        | Description                                                                                 |
| --------------------- | -------------- | ------------------------------------------------------------------------------------------- |
| `PRINTD_API_KEY`      | _(empty)_      | Bearer token for authenticated access. Must match `PRINT_SERVICE_KEY` in exchange-terminal. |
| `PRINTD_DEVICE`       | `/dev/usb/lp0` | Printer device path (USB) or `host:port` (network).                                         |
| `PRINTD_PRINTER_KIND` | `usb`          | Connector type: `usb`, `network`, `serial`, or `dummy`.                                     |
| `PRINTD_LISTEN_PORT`  | `8080`         | HTTP API port.                                                                              |

### Running with Docker

```bash
docker compose up -d
```

Or manually:

```bash
npm install
npm run start
```

### Dummy Mode (no printer hardware)

For testing and development without a physical printer:

```env
PRINTD_PRINTER_KIND=dummy
```

The dummy connector prints to stdout (base64-encoded ESC/POS commands) so you can verify the pipeline end-to-end.

---

## Cut Alignment & Feed Timing

### Cut Operations

The printd service supports two cut modes:

| Mode        | Endpoint                               | Use case                           |
| ----------- | -------------------------------------- | ---------------------------------- |
| Full cut    | `POST /cut` (default)                  | End of ticket / end-of-day         |
| Partial cut | `POST /cut` with `{ "partial": true }` | Continue printing on the same roll |

**Important**: Always use full cuts (`partial: false`) for receipt-style tickets. Partial cuts are for multi-section tickets where more content follows immediately.

### Feed Operations

```bash
POST /feed
{ "lines": 3 }
```

Feed N blank lines without cutting. Useful for:

- Adding whitespace between sections on a receipt
- Positioning the next ticket at a convenient tear point
- Clearing the print head after a long ticket

**Recommended feed values**:

| Scenario                         | Lines |
| -------------------------------- | ----- |
| Between ticket sections          | 2–3   |
| After a long ticket (before cut) | 3–5   |
| End of day summary               | 4–6   |
| Empty receipt (testing)          | 3     |

### Timing

Thermal printers have a mechanical delay between receiving data and actual printing:

- **Print speed**: ~200–250 mm/s for most models
- **Cut time**: ~1–2 seconds for full cut, ~0.5s for partial cut
- **Feed time**: ~40 ms per line

**Practical advice**:

1. **Wait between print and cut**: The exchange-terminal app automatically waits ~500ms after printing before cutting. Do not rush this — cutting mid-print produces garbled output.

2. **Batch printing**: If printing multiple tickets, feed 3 lines between each and cut after the last one.

3. **Long tickets**: For end-of-day summaries (often 200+ lines), add 5–6 lines of feed before the cut so the receipt lands at a convenient position.

---

## Paper Size Requirements

The exchange-terminal apps are designed for **80 mm wide** thermal receipt paper (standard POS receipt size).

| Dimension     | Value    | Notes                                                  |
| ------------- | -------- | ------------------------------------------------------ |
| Width         | 80 mm    | Standard thermal receipt width                         |
| Image width   | 570 px   | Configured in print client; maps to ~72 mm at 203 DPI  |
| Print area    | ~72 mm   | ~4 mm margin on each side (gripper area)               |
| Roll diameter | ≤ 83 mm  | Check printer spec; some small printers accept ≤ 50 mm |
| Core diameter | 12–25 mm | Standard core; adapters available for smaller cores    |

### Paper Quality

- **Use thermal receipt paper** (not plain paper). Thermal paper is coated with a chemical that darkens when heated.
- **Avoid glossy photo paper** on thermal printers — it will damage the print head.
- **Use standard brightness** (not "high brightness" unless needed). Standard brightness is less prone to ghosting.
- **Acid-free paper** recommended for archival-quality receipts.

---

## Troubleshooting

### Printer not detected

```bash
# Check if USB device is visible
ls /dev/usb/lp* /dev/lp* /dev/ttyACM* /dev/ttyUSB*

# Check kernel messages
dmesg | tail -20

# For network printers, test connectivity
nc -zv 192.168.1.100 9100
```

### Nothing prints / blank output

1. **Check printd status**:

   ```bash
   curl http://localhost:8080/healthz
   curl http://localhost:8080/status
   ```

2. **Verify printer has paper** and is not in error state (check the physical error LED).

3. **Test with dummy mode** to isolate whether the issue is hardware or software:
   ```env
   PRINTD_PRINTER_KIND=dummy
   ```
   If dummy mode works but real hardware doesn't, check device permissions or network settings.

### Faint / light prints

The printd image pipeline includes automatic lightening adjustment, but you can tweak:

```env
# Increase darkness (0.0–1.0, default ~0.7)
PRINTD_DARKNESS=0.8
```

### Garbled / corrupted output

- Check the **USB cable** quality (long cheap cables cause signal degradation).
- For **network printers**, ensure the printer and server are on the same subnet with no firewall blocking port 9100.
- Verify the **ESC/POS command set** — some Star printers use StarPRNT commands (not ESC/POS) and require a different connector.

### Cut doesn't work

- Check that the printer's **cut mechanism is engaged** (some printers have a physical switch).
- Verify the printer firmware supports cut commands (most do, but very old models may not).
- Try the cut endpoint directly:
  ```bash
  curl -X POST http://localhost:8080/cut -H 'Content-Type: application/json'
  ```

### Audio crackling during print

This is normal — thermal printers make mechanical noise during cutting and paper feeding. If it's excessively loud, the cut mechanism may be worn and need replacement.

### Docker permissions

If running printd in Docker with USB access:

```yaml
# docker-compose.yml snippet
services:
  printd:
    volumes:
      - /dev/bus/usb:/dev/bus/usb:ro
```

Ensure the Docker runtime user has access:

```bash
ls -l /dev/bus/usb/$(ls /dev/bus/usb/ | head -1)/$(ls /dev/bus/usb/$(ls /dev/bus/usb/ | head -1) | head -1)
```

---

## Quick Reference

```
# Health check
curl http://localhost:8080/healthz

# Printer status
curl http://localhost:8080/status

# Print a test ticket
curl -X POST http://localhost:8080/print \
  -H 'Content-Type: application/json' \
  -d '{"image": "data:image/png;base64,...", "cut": true}'

# Feed 3 lines
curl -X POST http://localhost:8080/feed \
  -H 'Content-Type: application/json' \
  -d '{"lines": 3}'

# Full cut
curl -X POST http://localhost:8080/cut \
  -H 'Content-Type: application/json' \
  -d '{}'

# Partial cut
curl -X POST http://localhost:8080/cut \
  -H 'Content-Type: application/json' \
  -d '{"partial": true}'
```
