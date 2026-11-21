# Server Monitor (Mobile-First PWA)

Standalone, read-only, mobile-first homelab server & Docker container monitoring PWA powered by **Beszel Hub**.

## Features
- **3 Independent Mobile-First Pages**:
  - **Server (`/server`)**: 2x2 Bento KPIs (CPU + Core temp + sparkline, RAM + sparkline, SSD bar, Power & Uptime) and a grouped read-only Docker container table (`AI News Stack`, `Media & Apps`, `Other`) with inline CPU/RAM progress bars, stack filters, search, and tap-to-expand details.
  - **Power & Agents (`/agents`)**: Nokia 6.1 battery status & 24h discharge sparkline (via `news-ai` API), server core temperatures, Load Average, Swap, Wi-Fi RSSI, network interface counters (`wlp2s0`, `tailscale0`), Telegram Watchdog status, and quick links to Beszel & AdGuard.
  - **Settings (`/settings`)**: 4 instant theme presets (`Obsidian Amber` default, `Nordic Paper` light, `Emerald Ops`, `Velvet Coral`), configurable auto-refresh interval (`5s / 10s / 30s / 60s / Off`), `RU / EN` language switch, and PWA install/cache reset.
- **Security by Design**:
  - Read-only architecture: zero `/var/run/docker.sock` mount, zero container restart endpoints.
  - Non-root container (`USER appuser`) with pinned `python:3.12-slim-bookworm`, explicit HTTP timeouts, and `.env` credential isolation.
  - Exposed via Tailscale Serve HTTPS (`https://petroprog.tail703e6c.ts.net:8445`).

## Quick Start
```bash
cp .env.example .env
# Edit .env with your Beszel credentials
docker compose -f compose.yaml up -d --build
```

## Tailscale HTTPS Setup
```bash
tailscale serve --bg --https=8445 http://127.0.0.1:8085
```

## Tests
```bash
pytest
```
