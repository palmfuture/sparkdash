# sparkDash — Multi-DGX Spark Monitoring Dashboard

A web dashboard to monitor and manage multiple NVIDIA DGX Spark (GB10) units from a single UI.

## Features

- **Multi-Spark support**: Monitor multiple DGX Spark units from one dashboard
- **Real-time metrics**: GPU, CPU, RAM, storage, network, unified memory, LLM throughput
- **LLM monitoring**: Auto-detect vLLM, llama.cpp, sglang backends; live tok/s sparklines
- **Remote collection**: SSH into remote Sparks for hardware metrics
- **Dark/Light themes**: Neutral gray/black dark theme + clean light theme
- **Docker deployment**: ARM64-optimized container for DGX Spark GB10

## Quick Start

```bash
# Install dependencies
npm install

# Development (client + server concurrently)
npm run dev

# Build frontend only
npm run build

# Production server
npm start
```

## Docker

```bash
# Build and run
docker compose up --build

# The dashboard is available at http://<host-ip>:5555
# Accessible from any device on your LAN
```

### Docker Bind Mounts

The container mounts host filesystem for local Spark metrics:
- `/proc` → `/host/proc` (read-only)
- `/sys` → `/host/sys` (read-only)
- `/` → `/host/root` (read-only)

### Persistent Config

`config/sparks.json` is mounted as a volume so your Spark registry survives container recreation.

## Architecture

```
┌─────────────────────────── Docker container (sparkDash) ───────────────────────────┐
│                                                                                     │
│  Express server (server/)                                                           │
│  ├─ config/sparks.json        ← Spark registry (read/write via API)                 │
│  ├─ SparkRegistry             ← loads + persists Sparks; emits change events         │
│  ├─ SparkMonitor (per Spark)  ← owns one collector + one LLM probe + rate state     │
│  │   ├─ SystemCollector        ← hw metrics: local sysfs/proc OR remote SSH         │
│  │   └─ LlmProbe               ← HTTP :8888, backend autodetect                    │
│  ├─ REST /api/...                                                                  │
│  └─ WebSocket (per client)    ← pushes { sparks: [ {id, name, status, metrics}… ] } │
│                                                                                     │
│  Vite-served React SPA (src/)                                                       │
│  └─ Top tabs: [Spark 1] [Spark 2] [+]  → page per Spark                             │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Tech Stack

- **Frontend**: React + Vite + TypeScript + Tailwind CSS v4
- **Backend**: Express v5 + WebSocket (ws)
- **Deployment**: Docker (arm64 — DGX Spark GB10 platform)
- **Port**: 5555 (LAN-accessible on 0.0.0.0)

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/sparks` | List all Sparks |
| POST | `/api/sparks` | Add a Spark |
| PATCH | `/api/sparks/:id` | Update a Spark |
| DELETE | `/api/sparks/:id` | Remove a Spark |
| GET | `/api/sparks/:id/metrics` | Get metrics snapshot |
| POST | `/api/sparks/:id/test` | Test SSH + LLM connectivity |
| WS | `/ws` | Real-time metrics stream |

## Adding a Spark

1. Click **"+ Add"** tab in the header
2. Enter Spark details:
   - **Name**: Display label
   - **LAN IP**: Required for SSH + LLM HTTP
   - **CX7 IP**: Optional second NIC
   - **SSH User**: Default `zurih`
   - **SSH Auth**: Key or password
3. Click **"Test Connection"** to verify reachability
4. Click **"Save"** — new tab appears with live metrics

## Configuration

### Environment Variables (`.env`)

```bash
PORT=5555                    # Dashboard port
LLM_PORT=8888                # LLM server port
POLL_INTERVAL_GPU=2000       # GPU poll interval (ms)
POLL_INTERVAL_CPU=2000       # CPU poll interval (ms)
POLL_INTERVAL_NETWORK=2000   # Network poll interval (ms)
POLL_INTERVAL_STORAGE=5000   # Storage poll interval (ms)
POLL_INTERVAL_LLM=2000       # LLM poll interval (ms)
POLL_INTERVAL_BANDWIDTH=1000 # Memory bandwidth poll interval (ms)
```

### Spark Registry (`config/sparks.json`)

```json
{
  "sparks": [
    {
      "id": "spark-1",
      "name": "Spark 1 (local)",
      "lanIp": "192.168.1.151",
      "cx7Ip": "10.0.0.1",
      "isLocal": true,
      "ssh": {
        "host": "192.168.1.151",
        "user": "zurih",
        "auth": "key"
      }
    }
  ]
}
```

## Monitored Metrics

### GPU
- Temperature (°C)
- Utilization (%)
- Power draw / limit (W)
- VRAM used / total (MB)
- Unified memory split (CPU vs GPU)
- Memory bandwidth (GB/s)

### CPU
- Usage (%)
- Temperature (°C)
- Power draw / TDP (W)

### RAM
- Used / total (MB)
- Percentage

### Storage
- Per-mount usage bars
- Read/write throughput (MB/s)

### Network
- Primary interface detection
- Per-interface upload/download speeds
- Auto-scaled units (B/s → KB/s → MB/s → GB/s)

### LLM
- Backend auto-detection (vLLM / llama.cpp / sglang)
- Model ID
- Context length
- Live generation tok/s + prefill tok/s
- Rolling sparklines
- Run benchmark button

## Theming

Two themes switchable from the header:
- **Dark**: Gray/black backgrounds (no blue tint), muted green accent
- **Light**: Clean paper neutrals, same accent

Theme persists to localStorage across reloads.

## License

ISC