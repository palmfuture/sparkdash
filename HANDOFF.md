# HANDOFF.md

**Date**: July 15, 2026  
**Project**: sparkDash — Multi-DGX Spark Monitoring Dashboard  
**Last update**: Theme design exploration — 8 visual mockups created

---

## What Was Built

A web dashboard to monitor multiple NVIDIA DGX Spark (GB10) units from a single UI. Monitors GPU, CPU, RAM, storage, network, unified memory, and LLM throughput.

### Completed Features

- **Multi-Spark support**: Add/remove Sparks from the UI at runtime
- **Real-time metrics**: GPU, CPU, RAM, storage, network, unified memory
- **LLM monitoring**: Auto-detect vLLM/llama.cpp/sglang, live tok/s sparklines (vLLM Prometheus labels supported)
- **Remote collection**: SSH into remote Sparks for metrics (key or password)
- **Dark/Light themes**: Persisted to localStorage
- **Storage settings**: Toggle individual storage devices on/off (round-trip fixed)
- **Docker deployment**: ARM64-optimized for DGX Spark GB10; local metrics via host namespaces (`nsenter`)

---

## Architecture

```
Browser ←→ WebSocket (/ws) ←→ SparkMonitor ←→ SystemCollector + LlmProbe
Browser ←→ REST (/api/*)   ←→ SparkRegistry (sparks.json) + SparkMonitor
```

**Principle:** one Spark model, N instances. Adding a Spark is a config change, not a code change.

### Key Files

| File | Purpose |
|------|---------|
| `server/index.js` | Express + WebSocket entrypoint, all API routes |
| `server/config.js` | Constants, env vars, DGX Spark specs, `HOST_PATHS` |
| `server/sparks/SparkRegistry.js` | CRUD for sparks.json; passwords memory-only |
| `server/sparks/SparkMonitor.js` | Per-Spark: collectors + poll loops + liveness |
| `server/collectors/SystemCollector.js` | GPU, CPU, RAM, storage, network, unified memory |
| `server/collectors/LlmProbe.js` | LLM backend detection + tok/s |
| `server/collectors/ssh.js` | SSH via `execFile` (key + `sshpass -e`) |
| `src/App.tsx` | React shell |
| `src/hooks/useSnapshot.ts` | WebSocket hook (guards CONNECTING) |
| `src/api/types.ts` | TypeScript interfaces |
| `src/api/client.ts` | REST helpers + ephemeral test |
| `src/components/SparkPage/` | Per-Spark panels (null-safe) |
| `src/components/ui/Panel.tsx` | Panel primitive (uses CSS classes `panel`, `panel-accent`, `panel-title`) |
| `src/components/ui/MetricBar.tsx` | Progress bar (uses Tailwind `bg-accent`, `bg-danger`, `bg-warning`, `bg-success`) |
| `src/components/ui/icons.tsx` | All inline SVG icons (stroke-based, `currentColor`) |
| `src/index.css` | **All theme tokens** — CSS custom properties + Tailwind v4 `@theme` extension |
| `src/components/ThemeSwitch.tsx` | Dark/light toggle via `data-theme` attribute on `<html>` |
| `config/sparks.json` | Persistent Spark registry (**no passwords**) |
| `config/gpu-memory.json` | GPU memory from host (cron) |
| `docs/GROK_BUGS.md` | Full code review findings (mostly fixed) |
| `CODEBASE.md` | Stable agent-oriented overview |

---

## Session: Theme Design Exploration (2026-07-15)

### Context

The user felt the current color scheme (near-black base, neutral grays, muted teal-green accent `#2d9d78`) looked like "AI slop" — generic template output. They requested a complete visual overhaul and asked for mockups to choose from.

### What Was Created

8 static HTML mockups in `mockups/`, each self-contained with dark/light theme toggle:

| # | File | Design Direction | Key Visual Features |
|---|------|-----------------|---------------------|
| 1 | `option-a-warm-industrial.html` | Amber/copper accent, warm charcoals | Workshop instrument panel feel. `#d4934a` accent. |
| 2 | `option-b-cool-steel.html` | Blue-gray base, crisp blue accent | Engineering tool / Thinkpad energy. `#5b8fd9` accent. |
| 3 | `option-c-muted-lavender.html` | Warm off-black, desaturated violet | Unusual, understated. `#8b7cb8` accent. |
| 4 | `01-crt-terminal.html` | Green phosphor monochrome | CRT scanlines, glow effects, all-mono font, zero rounded corners. No accent color — pure `#33ff55`. |
| 5 | `02-glassmorphism.html` | Frosted glass panels | Animated gradient background, `backdrop-filter: blur(20px)`, floating blobs, gradient progress bars. |
| 6 | `03-brutalist.html` | High contrast, blocky, raw | Zero rounded corners, 2px borders, `6px 6px 0` box shadows, bold uppercase everything, red accent. |
| 7 | `04-neon-cyberpunk.html` | Cyan/magenta/yellow neon glow | Grid background, scanlines, `text-shadow` glow effects, glowing progress bars. Very vibrant. |
| 8 | `05-minimal-monochrome.html` | Pure grayscale editorial | No accent color at all. Thin hairline borders, generous whitespace, refined typography. |

### How the Theme System Works

The current theming system is clean and well-isolated. To apply a chosen direction:

1. **`src/index.css`** — Replace the CSS custom property values in `:root, [data-theme="dark"]` and `[data-theme="light"]` blocks. Also update the `@theme` extension block if adding/removing tokens.

2. **`src/components/ui/MetricBar.tsx`** — The `bandColor()` function uses Tailwind classes `bg-accent`, `bg-danger`, `bg-warning`, `bg-success`. These resolve to CSS custom properties via `@theme`. If a mockup uses different semantic colors (e.g., CRT terminal has no "warning" color — just brightness levels), this function may need updating.

3. **`src/components/ui/Panel.tsx`** — Uses CSS classes `panel`, `panel-accent`, `panel-title`. The accent tick (`panel-accent::before`) uses `var(--color-accent)`. If the chosen design changes panel structure (e.g., glassmorphism removes the accent tick, brutalist uses a solid color block instead), this component needs structural changes.

4. **`src/components/ThemeSwitch.tsx`** — Already works with `data-theme` attribute. No changes needed unless adding a third theme.

5. **Component files** (`GpuPanel.tsx`, `StoragePanel.tsx`, etc.) — Use Tailwind utility classes like `text-muted`, `text-text`, `text-accent`, `bg-surface`, `border-border`, `bg-surface-elevated`. These all resolve to CSS custom properties. **No per-component color overrides exist** — the theme system is fully centralized.

### What Changes Depending on the Chosen Direction

**Simple (color palette swap only):**
- Options A, B, C — just replace hex values in `src/index.css`. Everything else works as-is.

**Medium (structural CSS changes):**
- Option 5 (Minimal Monochrome) — remove accent color, adjust border widths, spacing. No component structural changes needed.

**Complex (component structural changes):**
- Option 4 (CRT Terminal) — needs `border-radius: 0` globally, monospace font everywhere, scanline overlay, glow effects. The `Panel` component's accent tick should be removed. Progress bars need different styling.
- Option 6 (Brutalist) — needs `border-radius: 0` globally, thick borders, bold uppercase labels, `box-shadow` on cards. The `Panel` accent tick should become a solid color block.
- Option 5 (Glassmorphism) — needs `backdrop-filter` on panels, gradient background, possibly different panel component structure (no accent tick, different hover states).

**Most complex (new visual language):**
- Option 7 (Neon Cyberpunk) — grid background, scanlines, glow effects, multiple accent colors (cyan primary, magenta secondary, green success, yellow warning). The `bandColor()` function in `MetricBar.tsx` needs updating to use neon-specific colors. Panel borders need glow. May need new CSS for `text-shadow` glow utilities.

### Current Theme Tokens (to replace)

```css
/* Dark theme (current) */
--color-base: #0a0a0a;
--color-surface: #111111;
--color-surface-elevated: #181818;
--color-surface-hover: #1f1f1f;
--color-border: #262626;
--color-border-strong: #333333;
--color-text: #ededed;
--color-text-strong: #ffffff;
--color-muted: #8a8a8a;
--color-muted-strong: #b0b0b0;
--color-accent: #2d9d78;
--color-accent-hover: #36b58c;
--color-accent-soft: rgba(45, 157, 120, 0.14);
--color-danger: #e54d4d;
--color-warning: #e5a34d;
--color-success: #2d9d60;
--color-grid: rgba(255, 255, 255, 0.04);
--shadow-card: 0 1px 2px rgba(0, 0, 0, 0.4), 0 0 0 1px var(--color-border);
```

---

## Current State

### What's Working

- ✅ GPU temperature, usage, power (local Docker via host `nsenter` + optional lib mount)
- ✅ Unified memory (GPU + CPU) with OOM risk
- ✅ RAM usage (`HOST_PATHS.PROC` mapping)
- ✅ Storage detection with I/O speeds; settings re-enable works
- ✅ Network with per-interface speeds (host netns in Docker)
- ✅ LLM detection (vLLM labeled metrics, llama.cpp, sglang); availability unsticks after failures
- ✅ Online status from real liveness (local `/proc` or SSH), not "poll didn't throw"
- ✅ Add/remove Sparks; ephemeral Test Connection (no registry flash)
- ✅ Dark/Light themes
- ✅ Docker deployment (port 5555)

### Known Issues / Limitations

1. **GPU memory on GB10**: `nvidia-smi` memory fields often `[N/A]`. Prefer `config/gpu-memory.json` (host cron); compute-apps via host ns is a fallback.
2. **SSH passwords are memory-only**: After server restart, re-enter password-auth Sparks (or use key auth). Prefer rotating any password that was ever stored in cleartext in `sparks.json`.
3. **No API auth**: Dashboard binds `0.0.0.0:5555` with no authentication — LAN trust model.
4. **No tests**: No test framework configured.
5. **Hardware summary hardcoded**: `SparkMonitor._getHardwareSummary()` returns static DGX Spark specs.
6. **LLM benchmark stub**: `POST /api/sparks/:id/llm/bench` is not implemented.
7. **Password re-entry UX**: There is no "Edit Spark" password form yet for existing Sparks after restart — may need PATCH with `ssh.password` or re-add.

### Registered Sparks (example)

- `spark-1` — local (`isLocal: true`), key auth  
- `spark2` — remote, password auth (**password not on disk**; re-enter after restart)

---

## How to Run

### Development (live reload)

```bash
cd /mnt/admin/sparkDash

# Option A: Local
npm run dev

# Option B: Docker (source-mounted, privileged for nsenter)
docker compose -f docker-compose.dev.yml up --build
```

- Frontend: `http://localhost:5173` (Vite hot reload)
- API: `http://localhost:5555`

### Production

```bash
# Option A: Local
npm run build && npm start

# Option B: Docker
docker compose up --build -d
```

- Dashboard: `http://localhost:5555` (or `http://<host-lan-ip>:5555`)

**After code changes that touch Dockerfile packages (`util-linux`) or volume mounts, rebuild:**  
`docker compose up --build -d`

---

## Docker Configuration

### Requirements for local metrics inside the container

| Mount / flag | Why |
|--------------|-----|
| `/proc` → `/host/proc:ro` | Host meminfo/stat + **namespace files** for `nsenter` |
| `/sys` → `/host/sys:ro` | hwmon, block I/O, net link speed |
| `/` → `/host/root:ro` | `statfs` for host mounts |
| `privileged: true` | `nsenter` into host mount/pid/net namespaces |
| `nvidia-smi` + `libnvidia-ml.so.1` | Fallback if nsenter path fails |
| `./config` | `sparks.json`, `gpu-memory.json` |
| `util-linux` in image | Provides `nsenter` |

Local collectors use:

- `nsenter --mount=/host/proc/1/ns/mnt --pid=...` for `nvidia-smi` / `lsblk`
- `nsenter --net=/host/proc/1/ns/net` for `/proc/net/dev` and `route`

### docker-compose.yml (Production)

- Mounts `./server` for code changes without full image rebuild (still rebuild when Dockerfile/deps change)
- Port 5555 (LAN-accessible on 0.0.0.0)

### docker-compose.dev.yml (Development)

- Mounts entire source + `node_modules` volume
- Exposes 5173 (Vite) + 5555 (API)
- `privileged: true` + same host binds as prod

---

## SSH Password Security

| Rule | Detail |
|------|--------|
| Disk | Never write `ssh.password` to `sparks.json` |
| API | Never return password; may set `ssh.hasPassword: true` |
| Runtime | Kept in `SparkRegistry` in-memory map for SSH collectors |
| Add Spark | Password required when auth is `pass`; stored only in memory on save |
| Restart | Password-auth Sparks need password re-supplied (PATCH/add) |

Prefer **key auth** (`auth: "key"`, `BatchMode=yes`) for production.

---

## GPU Memory Workaround

GB10 often does not report GPU memory via `nvidia-smi --query-gpu=memory.used`. Host compute-apps / cron file remains the reliable path.

### Solution

1. `config/gpu-memory.sh` runs on host every minute via cron  
2. Writes GPU memory to `config/gpu-memory.json`  
3. Docker reads this file (config directory is mounted)  
4. Collectors also try host-ns `nvidia-smi --query-compute-apps=...` as fallback  

### Cron Job

```bash
# Already set up:
* * * * * /mnt/admin/sparkDash/config/gpu-memory.sh
```

### Manual Run

```bash
/mnt/admin/sparkDash/config/gpu-memory.sh
cat /mnt/admin/sparkDash/config/gpu-memory.json
```

---

## API Reference

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/sparks` | List Sparks (**no passwords**) |
| POST | `/api/sparks` | Add a Spark (starts monitor) |
| POST | `/api/sparks/test` | Ephemeral SSH + LLM test (body config, **no persist**) |
| PATCH | `/api/sparks/:id` | Update a Spark (restarts monitor; `id` immutable) |
| DELETE | `/api/sparks/:id` | Remove a Spark |
| GET | `/api/sparks/:id/metrics` | One-shot metrics snapshot |
| POST | `/api/sparks/:id/test` | Test registered Spark SSH + LLM |
| PUT | `/api/sparks/:id/disabled-devices` | Update disabled storage devices |
| POST | `/api/sparks/:id/llm/bench` | Stub — not implemented |
| WS | `/ws` | Real-time metrics stream (every 2s) |

---

## Environment Variables

```bash
PORT=5555
LLM_PORT=8888
POLL_INTERVAL_GPU=2000
POLL_INTERVAL_CPU=2000
POLL_INTERVAL_NETWORK=2000
POLL_INTERVAL_STORAGE=5000
POLL_INTERVAL_LLM=2000
POLL_INTERVAL_BANDWIDTH=1000
HOST_PROC_PATH=/host/proc
HOST_SYS_PATH=/host/sys
HOST_ROOT_PATH=/host/root
SPARKS_JSON_PATH=           # optional override for sparks.json path
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 8, TypeScript, Tailwind CSS v4 |
| Backend | Express 5, WebSocket (ws), Node.js 22 (plain ESM JS) |
| Platform | ARM64, NVIDIA DGX Spark GB10 |
| Deployment | Docker (multi-stage, arm64) |

---

## Adding a New Spark

1. Open dashboard at `http://<host-ip>:5555`  
2. Click **"+ Add"** tab  
3. Enter Name, LAN IP, SSH User, SSH Auth (key/password)  
4. Click **"Test Connection"** — uses `POST /api/sparks/test` (no temporary registry entry)  
5. Click **"Save"** — `ssh.host` is set from LAN IP if empty  

Password auth: re-enter password after every server restart.

---

## Troubleshooting

### Storage shows "No mounted disks"

- Inside container, collectors use host-ns `lsblk` then `statfs` under `/host/root`.  
- Verify binds: `/host/proc`, `/host/root` present and `privileged: true`.  
- Host check: `lsblk -P -no NAME,SIZE,MOUNTPOINT,FSTYPE`

### GPU is 0°C / 0% in Docker

- Rebuild image (needs `util-linux` / `nsenter`).  
- Confirm privileged + `/host/proc/1/ns/mnt` exists.  
- Manual: `nsenter --mount=/host/proc/1/ns/mnt -- nvidia-smi`  
- Lib fallback: mount `libnvidia-ml.so.1` as in compose.

### Network only shows `eth0` (container bridge)

- Host netns path broken — need `nsenter --net=/host/proc/1/ns/net cat /proc/net/dev`.  
- Expect host ifaces like `enP*`, `enp*`, etc.

### GPU memory shows 0 MB

- Check cron: `crontab -l`  
- File: `cat /mnt/admin/sparkDash/config/gpu-memory.json`  
- Manual: `/mnt/admin/sparkDash/config/gpu-memory.sh`

### LLM shows "No model loaded" or tok/s stuck at 0

- `curl http://<spark-ip>:8888/v1/models`  
- For vLLM: `curl -s http://<spark-ip>:8888/metrics | grep generation_tokens`  
- After server stops, availability should flip false within a few poll failures.

### Remote Spark SSH fails after restart (password auth)

- Password is not on disk. Re-send via Add/PATCH with `ssh.password`, or switch to key auth.  
- `which sshpass` in container; image includes `sshpass`.

### Online green but metrics look dead

- Online is **host reachability**, not "all metrics healthy."  
- GPU/storage/network can still fail independently (check server logs).

---

## Future Improvements

- [ ] **Apply chosen theme** — once the user picks a direction from the 8 mockups, replace values in `src/index.css` and make any structural component changes needed.
- [ ] Edit-Spark UI to re-supply password after restart (or encrypted secret store)
- [ ] Implement LLM benchmark endpoint
- [ ] Dynamic hardware detection (replace hardcoded summary)
- [ ] Test framework
- [ ] Optional API auth / bind controls for non-trusted LANs
- [ ] Network I/O history charts
- [ ] Alerting for OOM risk / high temperature
- [ ] Multiple LLM ports per Spark
- [ ] Spark grouping / tags

---

## Agent / Next Session Notes

1. Read **`CODEBASE.md`** first, then this file.  
2. Architecture: one model, N monitors — no per-Spark-number code.  
3. Local Docker metrics depend on **host namespace entry**; don't "fix" GPU by only mounting the `nvidia-smi` binary.  
4. Never put SSH passwords back into `sparks.json` or API JSON responses.  
5. Remaining nits from `docs/GROK_BUGS.md` (lower priority): hardcoded hardware summary, bench stub, no API auth, some inline `style` width bars.
6. **Theme work is pending user choice** — 8 mockups live in `mockups/`. The user needs to pick one before implementation begins. Once picked:
   - **Simple swap** (options A/B/C): only edit `src/index.css` hex values.
   - **Structural changes** (options 4-8): also edit `src/components/ui/Panel.tsx`, `MetricBar.tsx`, and possibly `src/index.css` for new CSS classes (scanlines, glow, glass effects, etc.).
   - After CSS changes, run `npm run dev` to verify with Vite hot reload.
