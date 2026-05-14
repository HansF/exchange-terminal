# Exchange Terminal

> A small suite of paper-receipt apps that print to a thermal printer.
> Tickets for offerings & demands, fortunes from an oracle, focus-session timers, AI caricatures, and image stencils — all rendered in the browser, all delivered as crisp 1-bit receipts.

![React](https://img.shields.io/badge/React-19-149eca)
![Vite](https://img.shields.io/badge/Vite-6-646cff)
![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)

The actual ESC/POS plumbing lives in a separate, reusable service: **[printd](https://github.com/HansF/printd)** — an HTTP API for ESC/POS thermal receipt printers that this app talks to. Printer-side concerns (USB / network / serial connectors, image pipeline, density handling) are documented there.

---

## What's inside

Five apps under one launcher (`src/pages/Home.tsx`):

| App                   | What it does                                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Exchange Terminal** | Generates printable offering / demand / mutual-aid tickets in four visual themes (Standard, Mystical, DIY Punk, Terminal).                 |
| **Fortune**           | An "oracle" — draws a random prophecy and prints it as a receipt.                                                                          |
| **Todo**              | A focus-session timer with paper artefacts: prints a daily header at start, a session summary on each completion, and an end-of-day recap. |
| **StencilCam**        | Snaps a photo, asks Gemini for a flattering black-and-white caricature, thresholds it, and prints the result.                              |
| **Threshold Stencil** | Upload an image, dial in a threshold, export or print it as a 1-bit stencil.                                                               |

Templated receipt views use [`src/lib/print.ts`](src/lib/print.ts) to capture DOM with `html2canvas` at exactly **570 px** wide, threshold to 1-bit on the client, and send the PNG through the typed printd wrapper in [`src/lib/printd.ts`](src/lib/printd.ts). StencilCam and Threshold Stencil generate their own thresholded PNGs and use the same print client.

---

## Architecture

```
┌─────────────────┐  POST /api/print     ┌──────────────────┐  POST /print     ┌────────────┐
│  Vite React app │ ───────────────────▶ │  Node Express    │ ───────────────▶ │   printd   │ ──▶ /dev/usb/lp0
│  (browser)      │   (same-origin)      │  server.cjs      │   bearer auth    │  FastAPI   │
└─────────────────┘                      └──────────────────┘                  └────────────┘
                                          ↑
                                          │ /api/sessions, /api/day, /api/caricature
                                          ▼
                                          better-sqlite3 + Gemini API
```

`server.cjs` does three things:

1. **Storage** for the Todo app — a tiny persistent `data/todo.db` (sqlite) holding sessions and day logs.
2. **Gemini proxy** for StencilCam — keeps the API key server-side.
3. **printd proxy** — relays `/api/print`, `/api/cut`, `/api/feed`, `/api/status`, `/api/healthz` to the printd service so the bearer token never reaches the browser.

If you want to run the webapp without a real printer, point printd at the dummy connector (`PRINTD_PRINTER_KIND=dummy`).

---

## Quickstart

### Prerequisites

- Node.js 20+
- A running [printd](https://github.com/HansF/printd) instance (USB / network / serial ESC/POS printer, or `dummy` for testing without hardware)
- A Gemini API key (optional — needed only for StencilCam)

### Run it

```bash
git clone https://github.com/HansF/exchange-terminal
cd exchange-terminal
npm install
cp .env.example .env   # edit values, see below
npm run dev:full       # vite + express, side by side
```

Then open http://localhost:3000.

The Express API listens on http://localhost:3001. Vite proxies `/api/*` to it during development.

### Environment variables

```env
# Gemini (StencilCam — optional)
GEMINI_API_KEY=…
GEMINI_IMAGE_MODEL=gemini-2.5-flash-image

# printd — the print service (https://github.com/HansF/printd)
PRINT_SERVICE_URL=http://localhost:8080
PRINT_SERVICE_KEY=changeme
```

Bring up printd with the matching key:

```bash
git clone https://github.com/HansF/printd ~/Projects/printd
cd ~/Projects/printd
cp .env.example .env
# set PRINTD_API_KEY=changeme and PRINTD_DEVICE=/dev/usb/lp0
docker compose up -d
```

---

## Scripts

```bash
npm run dev          # vite dev server only (no API, no printing)
npm run server       # express API only (requires printd reachable)
npm run dev:full     # both, side by side via concurrently
npm run build        # production build → dist/
npm run preview      # serve the production build locally
npm run test:e2e:install  # one-time: download the headless Chromium for tests
npm run test:e2e          # run Playwright E2E tests (mocks printd + Gemini)
npm run lint         # tsc --noEmit
```

---

## Print client

```ts
import { printd } from './lib/printd';

await printd.health(); // liveness probe
await printd.status(); // printer config + last error
await printd.print(pngDataUrl, { cut: true }); // print a PNG
await printd.feed(3);
await printd.cut();
```

For templated tickets, prefer the high-level helper:

```ts
import { printTicket } from './lib/print';
await printTicket(ticketRef.current!, { cut: true });
```

It captures the DOM element to a 570 px-wide 1-bit PNG and sends it through the same client.

Image-pipeline trade-offs (template lightening, dropped-row mitigation) are documented in printd's [`docs/printers.md`](https://github.com/HansF/printd/blob/main/docs/printers.md).

---

## Deployment

Run the Express API behind a reverse proxy (Caddy/nginx) and serve the Vite build as a static site. printd should run on the same machine (or the same LAN) as the printer; everything else can live anywhere.

Keep `data/todo.db` on persistent storage if you want Todo history to survive restarts or deployments. The database is created automatically on first server start.

For Raspberry Pi / kiosk setups, see printd's [`docs/deployment.md`](https://github.com/HansF/printd/blob/main/docs/deployment.md).

---

## Related

- **[printd](https://github.com/HansF/printd)** — the ESC/POS HTTP API this app drives. Standalone, USB / network / serial, OpenAPI docs at `/docs`, Docker-ready.
