"""
FastAPI backend — Real-time System Performance Monitor.
Exposes WebSocket for live metrics and REST endpoints for alerts.
"""
import asyncio
import json
import uuid
from collections import deque
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware

from collector import MetricsCollector
from anomaly import AnomalyDetector
from models import AnomalyAlert, SystemSnapshot

# ─────────────────────────────────────────────────────────────────────────────
# Global state
# ─────────────────────────────────────────────────────────────────────────────
collector = MetricsCollector()
detector = AnomalyDetector()
alert_history: deque[AnomalyAlert] = deque(maxlen=200)
acknowledged_ids: set[str] = set()
active_connections: list[WebSocket] = []
UPDATE_INTERVAL_SECONDS: float = 2.0

# Background task handle
_broadcast_task: Optional[asyncio.Task] = None  # type: ignore[type-arg]


# ─────────────────────────────────────────────────────────────────────────────
# Broadcast loop
# ─────────────────────────────────────────────────────────────────────────────
async def broadcast_loop() -> None:
    """Collect metrics every UPDATE_INTERVAL_SECONDS and push to all clients."""
    # Add a small delay at the start of the loop to give the frontend time to initialize
    await asyncio.sleep(1)
    
    while True:
        await asyncio.sleep(UPDATE_INTERVAL_SECONDS)

        # Collect snapshot — never crash the server on failure
        try:
            snapshot: SystemSnapshot = collector.collect()
        except Exception as exc:
            print(f"[collector] Error: {exc}")
            continue

        # Detect anomalies
        try:
            new_alerts = detector.detect(snapshot)
        except Exception as exc:
            print(f"[detector] Error: {exc}")
            new_alerts = []

        # Store alerts
        for alert in new_alerts:
            alert_history.append(alert)

        # Build payload
        payload = {
            "type": "snapshot",
            "data": snapshot.model_dump(),
            "alerts": [a.model_dump() for a in new_alerts],
        }

        # Send to all connected clients
        dead: list[WebSocket] = []
        for ws in list(active_connections):
            try:
                await ws.send_json(payload)
            except Exception as e:
                print(f"[ws] Error sending to a client, marking as dead: {e}")
                dead.append(ws)

        for ws in dead:
            if ws in active_connections:
                active_connections.remove(ws)


# ─────────────────────────────────────────────────────────────────────────────
# Lifespan — start/stop background task
# ─────────────────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global _broadcast_task
    _broadcast_task = asyncio.create_task(broadcast_loop())
    yield
    if _broadcast_task is not None:
        _broadcast_task.cancel()
        try:
            await _broadcast_task
        except asyncio.CancelledError:
            pass


# ─────────────────────────────────────────────────────────────────────────────
# App setup
# ─────────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="SysMonitor AI",
    description="Real-Time System Performance Monitor with AI-driven anomaly detection",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────────────────────
# WebSocket endpoint
# ─────────────────────────────────────────────────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    active_connections.append(websocket)

    # Send recent alert history immediately on connect
    try:
        # Give the frontend a brief moment to be fully ready before sending init payload
        await asyncio.sleep(0.5)
        recent_alerts = list(alert_history)[-50:]
        init_payload = {
            "type": "init",
            "alerts": [a.model_dump() for a in recent_alerts],
        }
        await websocket.send_json(init_payload)
    except Exception as exc:
        print(f"[ws] Failed to send init payload: {exc}")

    try:
        # Keep the connection alive — accept any incoming frame type
        while True:
            msg = await websocket.receive()
            # msg is a dict with key "type" ("websocket.receive" or "websocket.disconnect")
            if msg.get("type") == "websocket.disconnect":
                break
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        print(f"[ws] Unexpected error: {exc}")
    finally:
        if websocket in active_connections:
            active_connections.remove(websocket)


# ─────────────────────────────────────────────────────────────────────────────
# REST endpoints
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str) -> dict:
    acknowledged_ids.add(alert_id)
    for alert in alert_history:
        if alert.id == alert_id:
            alert.acknowledged = True
    return {"success": True}


@app.get("/alerts")
async def get_alerts(
    severity: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
) -> list[dict]:
    results = list(alert_history)
    if severity:
        results = [a for a in results if a.severity == severity]
    return [a.model_dump() for a in results[-limit:]]


@app.get("/health")
async def health_check() -> dict:
    return {
        "status": "ok",
        "trained": detector.is_trained,
        "buffer_size": len(detector.feature_buffer),
        "active_connections": len(active_connections),
        "alert_history_count": len(alert_history),
    }
