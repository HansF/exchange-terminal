# printer/

Thermal printing has been extracted into its own service: **[printd](https://github.com/HansF/printd)**.

The Express server in `../server.cjs` now proxies `POST /api/print` and `POST /api/cut` to the printd HTTP API. Configure the upstream via `.env`:

```env
PRINT_SERVICE_URL=http://localhost:8080
PRINT_SERVICE_KEY=your-printd-bearer-token
```

To run the print service locally:

```bash
git clone https://github.com/HansF/printd ~/Projects/printd
cd ~/Projects/printd
cp .env.example .env  # set PRINTD_API_KEY and PRINTD_DEVICE
docker compose up -d
```

XP-80T quirks (cutter alarm, density, dropped-row mitigation) are documented in [`printd/docs/printers.md`](https://github.com/HansF/printd/blob/main/docs/printers.md).
