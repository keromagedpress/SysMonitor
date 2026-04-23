# SysMonitor AI

> **Real-Time System Performance Monitor with AI-Driven Anomaly Detection and Interactive 3D Visualizations**
>
> Academic project for *Operating Systems + Computer Graphics* course.

---

## Project Overview

SysMonitor AI is a full-stack, production-ready system monitoring dashboard that combines:

- **Real-time OS-level metrics** — CPU, RAM, Disk I/O, Network throughput, top processes — collected via `psutil` and streamed over WebSocket at 2-second intervals.
- **AI anomaly detection** — an Isolation Forest model trains incrementally on rolling metric data and fires severity-graded alerts when unusual patterns emerge.
- **Interactive 3D visualizations** — each metric's 60-point history is rendered as an animated 3D bar chart using Three.js / React Three Fiber, complete with OrbitControls (drag to rotate, scroll to zoom), per-material lighting, and Bloom post-processing.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (React + TS)                     │
│                                                                 │
│  StatusBar  │  MetricGauge ×4  │  Chart3D ×4  │  AlertPanel   │
│       ↑              ↑               ↑               ↑          │
│       └──────────────┴───────────────┴───────────────┘          │
│                    useWebSocket hook                             │
│                    useMetricsHistory hook                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │  WebSocket  ws://localhost:8000/ws
                           │  REST       http://localhost:8000
┌──────────────────────────▼──────────────────────────────────────┐
│                   FastAPI  (Python 3.11+)                        │
│                                                                 │
│   /ws  WebSocket endpoint   POST /alerts/{id}/acknowledge       │
│   GET  /alerts              GET  /health                        │
│                                                                 │
│   broadcast_loop() ──► MetricsCollector.collect()               │
│                    └──► AnomalyDetector.detect()                │
└────────────┬───────────────────────────┬────────────────────────┘
             │                           │
     ┌───────▼──────┐         ┌──────────▼────────┐
     │    psutil    │         │  scikit-learn      │
     │  (OS APIs)   │         │  IsolationForest   │
     │  /proc/stat  │         │  (contamination    │
     │  /proc/net   │         │   = 0.05)          │
     │  process_iter│         └───────────────────-┘
     └──────────────┘
```

---

## Prerequisites

| Tool | Minimum version |
|------|----------------|
| Python | 3.11+ |
| Node.js | 20+ |
| npm | 10+ |

> **Windows users**: `start.bat` opens each service in its own console window.
> **macOS / Linux users**: `start.sh` runs both in the background within the same terminal.

---

## Quick Start

### Windows
```bat
cd sysmon
start.bat
```

### macOS / Linux
```bash
cd sysmon
chmod +x start.sh
./start.sh
```

Then open **http://localhost:5173** in your browser.

---

## Manual Setup

### Backend

```bash
cd sysmon/backend

# Create and activate virtual environment
python -m venv .venv

# Windows
.venv\Scripts\activate.bat
# macOS / Linux
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend

```bash
cd sysmon/frontend
npm install
npm run dev
```

---

## Feature Documentation

### Real-Time Metrics Stream
Every 2 seconds the backend collects a full system snapshot and broadcasts it over WebSocket to all connected browsers. The payload includes CPU (overall + per-core), RAM, Disk I/O rates, Network throughput, and the top 5 CPU-consuming processes.

### AI Anomaly Detection
The `AnomalyDetector` uses scikit-learn's `IsolationForest`. Once 50 samples are buffered (≈ 100 seconds of operation), it fits the model and starts detecting outliers. Alerts are graded by z-score severity (`low → medium → high → critical`) and streamed to the frontend in the same WebSocket message as the snapshot.

### Interactive 3D Bar Charts
Four charts render rolling 60-point histories as animated 3D bars. Heights lerp smoothly toward target values each animation frame. OrbitControls let the examiner freely rotate, zoom, and pan. Bloom post-processing adds a subtle emissive glow on high-value bars.

### Severity-Graded Alert Panel
All alerts are shown in a scrollable panel with filter buttons (All / Critical / High / Medium / Low). A pulsing red dot appears whenever an unacknowledged critical or high alert exists. Individual alerts and all alerts can be acknowledged with REST calls to the backend.

### Connection Resilience
The WebSocket hook implements exponential backoff (1 s → 2 s → 4 s … max 30 s), so the UI reconnects automatically after backend restarts.

---

## AI Model Explanation

### Algorithm — Isolation Forest
Isolation Forest detects anomalies by building random trees that isolate individual data points. Anomalous points (unusual readings) require fewer splits to isolate and are therefore assigned a low anomaly score. `contamination=0.05` means the model expects approximately 5 % of training samples to be anomalies.

### Feature Vector (9 dimensions)
```
[ cpu_overall_percent,
  ram_percent,
  disk_read_mbps,
  disk_write_mbps,
  net_upload_mbps,
  net_download_mbps,
  top_process_cpu_max,
  top_process_memory_max,
  active_process_count ]
```

### Training Lifecycle
1. Each snapshot's feature vector is appended to a `deque(maxlen=500)`.
2. When `len(buffer) >= 50` and `len(buffer) % 50 == 0` (or first train), the model is refit.
3. After fitting, per-feature `(mean, std)` baselines are computed over the buffer.
4. At runtime, each feature's z-score `|value - mean| / std` is compared to 2.5. Features exceeding this trigger an individual `AnomalyAlert`.

### Severity Classification
| Z-score | Severity |
|---------|----------|
| 2.5 – 3.0 | low |
| 3.0 – 4.0 | medium |
| 4.0 – 5.0 | high |
| > 5.0 | critical |

---

## 3D Charts Explanation

### Rendering Pipeline
`Chart3D` wraps a `<Canvas>` from `@react-three/fiber` which initialises a WebGL renderer, scene graph, and RAF-based render loop. Each bar is a `<mesh>` with a `<boxGeometry>` and `<meshStandardMaterial>`.

### Camera & Lighting
- **Camera**: perspective, position `[0, 8, 16]`, FOV 50°.
- **AmbientLight** `intensity=0.4` — global fill.
- **DirectionalLight** `position=[10,10,5]` `intensity=1.2` with shadow maps — primary key light.
- **PointLight** `position=[-10,5,-10]` `color=#4488ff` — cool rim light from behind.

### OrbitControls
`<OrbitControls enableDamping dampingFactor={0.05}>` from `@react-three/drei` gives the examiner full drag-to-rotate, scroll-to-zoom, and right-click-to-pan. Damping creates inertial movement for a premium feel.

### Animation Loop (`useFrame`)
Inside each `<Bar>` component, `useFrame` is called every render tick. The bar's Y scale is linearly interpolated toward its target height at factor `0.08`, giving a smooth, springy response to data changes without external state updates.

### Color Severity Coding
| Ratio (value / maxValue) | Color |
|--------------------------|-------|
| > 0.85 | `#ff4444` (danger red) |
| > 0.65 | `#ffaa00` (warning amber) |
| ≤ 0.65 | `props.color` (metric accent) |

### Post-Processing — Bloom
`<EffectComposer>` and `<Bloom luminanceThreshold={0.6} intensity={0.4}>` from `@react-three/postprocessing` apply a multi-pass luminance-based glow effect over the rendered scene. High-value bars emit enough luminance to exceed the threshold, producing a subtle neon glow.

### Performance
`React.memo` wraps the exported `Chart3D` and all sub-components. Individual bars only update through `useFrame` (imperative Three.js mutations), bypassing React reconciliation entirely for per-frame updates.

---

## OS Course Relevance

| Feature | OS Concept |
|---------|-----------|
| `psutil.cpu_percent(percpu=True)` | Reads `/proc/stat` (Linux) or `PDH` counters (Windows); exposes per-core scheduler utilisation |
| `psutil.virtual_memory()` | Maps to `/proc/meminfo` (Linux) — total, used, buffers, cached, available |
| `psutil.disk_io_counters()` | Wraps `/proc/diskstats` (Linux) — block device read/write byte counters |
| `psutil.net_io_counters()` | Reads `/proc/net/dev` (Linux) — per-interface TX/RX byte counters |
| `psutil.process_iter()` | Iterates `/proc/<PID>/stat` entries (Linux) — exposes PID, name, CPU time, RSS |
| Delta-based rate calculation | Models the kernel's approach to computing I/O throughput between scheduler ticks |
| WebSocket as IPC | Demonstrates inter-process communication: the OS kernel → psutil → FastAPI → browser |

---

## Computer Graphics Course Relevance

| Feature | CG Concept |
|---------|-----------|
| Three.js scene graph | Hierarchical transform tree — parent transforms propagate to children |
| `PerspectiveCamera` | View frustum, FOV, near/far clip planes |
| `meshStandardMaterial` | Physically-based rendering (PBR) — metalness/roughness model |
| `DirectionalLight` + shadow maps | Shadow casting via depth-map rendering pass |
| `PointLight` | Inverse-square falloff, RGB spectral colour contribution |
| `useFrame` lerp | Per-frame imperative geometry mutation — core real-time animation pattern |
| `EffectComposer` + `Bloom` | Multi-pass post-processing pipeline: scene render → luminance threshold → Gaussian blur → additive blend |
| `OrbitControls` | Spherical coordinate camera rig — azimuth/elevation angles with damping |

---

## Running Tests

```bash
cd sysmon/backend
source .venv/bin/activate   # or .venv\Scripts\activate.bat on Windows
pytest tests/ -v
```

Expected output:
```
tests/test_collector.py::test_collect_returns_snapshot         PASSED
tests/test_collector.py::test_collect_twice_has_network_delta  PASSED
tests/test_collector.py::test_collect_top_processes_bounded    PASSED
tests/test_collector.py::test_collect_ram_consistency          PASSED
tests/test_anomaly.py::test_no_alert_before_training           PASSED
tests/test_anomaly.py::test_trains_after_min_samples           PASSED
tests/test_anomaly.py::test_spike_generates_alert              PASSED
tests/test_anomaly.py::test_alert_has_required_fields          PASSED
tests/test_anomaly.py::test_normal_operations_no_false_positives PASSED
```

---

## Troubleshooting

### Port already in use
```bash
# Find process on port 8000
netstat -ano | findstr :8000   # Windows
lsof -i :8000                  # macOS/Linux

# Kill by PID
taskkill /PID <PID> /F         # Windows
kill -9 <PID>                  # macOS/Linux
```

### psutil permission errors (Linux)
Some `/proc` entries require elevated privileges. Run with `sudo` or add your user to the `proc` group:
```bash
sudo usermod -aG proc $USER
```

### psutil on macOS — `AccessDenied` for system processes
Expected behaviour. The collector gracefully skips inaccessible processes. No action needed.

### `npm install` fails with EACCES
```bash
# Fix npm permissions
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH
```

### TypeScript compile errors
```bash
cd frontend
npx tsc --noEmit
```

### Backend module not found (`ModuleNotFoundError: No module named 'collector'`)
The backend must be run from the `backend/` directory so Python resolves sibling modules:
```bash
cd sysmon/backend
uvicorn main:app --reload
```

### WebSocket connection refused
Ensure the backend is running first. Check `http://localhost:8000/health` in a browser.

---

## Configuration

| Setting | File | Variable | Default |
|---------|------|----------|---------|
| Metric collection interval | `backend/main.py` | `UPDATE_INTERVAL_SECONDS` | `2.0` |
| Isolation Forest contamination | `backend/anomaly.py` | `IsolationForest(contamination=...)` | `0.05` |
| Min samples before training | `backend/anomaly.py` | `self.min_samples` | `50` |
| Retrain frequency | `backend/anomaly.py` | `len(buffer) % 50 == 0` | every 50 snapshots |
| Feature buffer size | `backend/anomaly.py` | `deque(maxlen=500)` | `500` |
| Alert history (backend) | `backend/main.py` | `deque(maxlen=200)` | `200` |
| Alert history (frontend) | `frontend/src/hooks/useWebSocket.ts` | `MAX_ALERTS` | `200` |
| Chart history points | `frontend/src/App.tsx` | `useMetricsHistory(60)` | `60` |
| WebSocket URL | `.env` / browser | `VITE_WS_URL` | `ws://localhost:8000/ws` |
| API URL | `.env` / browser | `VITE_API_URL` | `http://localhost:8000` |

---

## Environment Variables (optional)

Create `sysmon/frontend/.env.local` to override defaults:

```env
VITE_WS_URL=ws://my-server:8000/ws
VITE_API_URL=http://my-server:8000
```

---

*Built with FastAPI · psutil · scikit-learn · React · TypeScript · Three.js · @react-three/fiber*
