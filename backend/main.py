"""
FastAPI Main Application — Central Command & Intelligence Hub.
Strictly implements Handbook Section 8 & Section 4 Data Contracts:
- REST API for vision telemetry, state, alerts, briefings, operator chat, citizen reports
- High-speed WebSocket live broadcasting at 1 Hz + on-change triggers
- Live CCTV MJPEG video stream with YOLOv8 tactical overlay
- Autonomous Agentic AI daemon background execution
- Scenarios S01 - S10 1-click execution endpoints
- Static file serving for command dashboard and mobile citizen portal
"""

import asyncio
import json
import time
import os
import sys
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse, StreamingResponse

# Ensure root in python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.database import (
    init_db, save_citizen_report, get_alerts, update_alert_action,
    get_briefings, save_chat, get_chat, save_alert, get_zones
)
from backend.risk_engine import RiskEngine
from backend.models import (
    VisionIngest, CitizenReport, AlertAction, ChatMessage, WeatherToggle
)
from agent.scheduler import SafetyAgentDaemon

# --- WebSocket Connection Manager ---
class ConnectionManager:
    """Manages active WebSocket connections for live broadcasting."""
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"📡 WebSocket client connected. Active: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        print(f"📡 WebSocket client disconnected. Active: {len(self.active_connections)}")

    async def broadcast(self, data: dict):
        """Broadcast JSON payload to all connected clients."""
        dead = []
        message = json.dumps(data)
        for connection in list(self.active_connections):
            try:
                await connection.send_text(message)
            except Exception:
                dead.append(connection)
        for conn in dead:
            self.disconnect(conn)


# Global instances
manager = ConnectionManager()
risk_engine: Optional[RiskEngine] = None
agent_daemon: Optional[SafetyAgentDaemon] = None
video_streamer = None


# --- Background Tasks ---
async def broadcast_venue_state_periodically():
    """Broadcasts venue state snapshot every second to keep dashboard dials live."""
    while True:
        if risk_engine and manager.active_connections:
            state = risk_engine.get_venue_state()
            state["type"] = "venue_state"
            await manager.broadcast(state)
        await asyncio.sleep(1.0)


# --- App Lifecycle ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    global risk_engine, agent_daemon, video_streamer

    # 1. Initialize SQLite Database
    init_db()

    # 2. Initialize Risk Engine
    risk_engine = RiskEngine()

    # 3. Initialize Agentic AI Decision Daemon
    agent_daemon = SafetyAgentDaemon(risk_engine, manager.broadcast)
    await agent_daemon.start()

    # 4. Initialize & Start Autonomous CCTV Video Streaming Engine
    try:
        from backend.video_streamer import AutonomousVideoStreamer
        video_streamer = AutonomousVideoStreamer(risk_engine)
        video_streamer.start()
    except Exception as e:
        print(f"⚠️ Video streamer init warning: {e}")

    # 5. Start periodic 1 Hz state broadcast
    broadcast_task = asyncio.create_task(broadcast_venue_state_periodically())

    print("🚀 AI Crowd Safety & Decision Support Platform ONLINE!")
    print(f"   Command Dashboard: http://localhost:{os.getenv('BACKEND_PORT', '8000')}/")
    print(f"   Mobile Citizen QR: http://localhost:{os.getenv('BACKEND_PORT', '8000')}/report.html")
    print(f"   Swagger API Docs:  http://localhost:{os.getenv('BACKEND_PORT', '8000')}/docs")

    yield

    # Cleanup
    broadcast_task.cancel()
    if agent_daemon:
        agent_daemon.stop()
    if video_streamer:
        video_streamer.stop()



app = FastAPI(
    title="AI Crowd Intelligence & Decision Support Platform",
    description="Autonomous Multi-Modal Crowd Safety Command Center (7th Semester B.Tech IT)",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Frontend Static Files
frontend_dir = Path(__file__).resolve().parent.parent / "frontend"
if frontend_dir.exists():
    app.mount("/static", StaticFiles(directory=str(frontend_dir)), name="static")


# ============================================================
# REST API ENDPOINTS
# ============================================================

@app.get("/", response_class=HTMLResponse)
async def serve_dashboard():
    """Serves the main Command Center Dashboard."""
    index_path = frontend_dir / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return HTMLResponse("<h1>AI Crowd Safety System</h1><p>Frontend static files loading...</p>")


@app.get("/report.html", response_class=HTMLResponse)
async def serve_citizen_portal():
    """Serves the Mobile QR Citizen Reporting Portal."""
    report_path = frontend_dir / "report.html"
    if report_path.exists():
        return FileResponse(str(report_path))
    return HTMLResponse("<h1>Citizen Report Page</h1>")


# --- Vision Telemetry Ingest ---
@app.post("/api/vision/ingest")
async def ingest_vision(data: VisionIngest):
    """
    POST /api/vision/ingest (Section 4.A Contract)
    Ingests person_count, density, behaviour_flag, sensor_status.
    """
    if not risk_engine:
        raise HTTPException(status_code=503, detail="Risk Engine not initialized")

    state_changed = risk_engine.ingest(
        zone_id=data.zone_id,
        person_count=data.person_count,
        density=data.density,
        behaviour_flag=data.behaviour_flag,
        sensor_status=data.sensor_status,
        timestamp=data.timestamp,
    )

    # Immediately trigger Cognitive Cycle on critical state change (Section 2 FR6)
    if state_changed and agent_daemon:
        asyncio.create_task(agent_daemon.run_cycle(force=True, trigger="state_change"))

    zone_state = risk_engine.get_zone_state(data.zone_id)
    return {"status": "ok", "zone_state": zone_state}


# --- Venue State Snapshot ---
@app.get("/api/state")
async def get_state():
    """GET /api/state (Section 4.B Contract)"""
    if not risk_engine:
        raise HTTPException(status_code=503, detail="Risk Engine not initialized")
    return risk_engine.get_venue_state()


@app.get("/api/zones")
async def get_zones_list():
    """Returns static zone definitions and thresholds."""
    return get_zones()


# --- Citizen Hazard Reports ---
@app.post("/api/reports/citizen")
async def submit_citizen_report(report: CitizenReport):
    """
    POST /api/reports/citizen (Section 2 FR10)
    Saves citizen hazard report and immediately elevates zone risk score.
    """
    if not risk_engine:
        raise HTTPException(status_code=503, detail="Risk Engine not initialized")

    save_citizen_report(report.zone_id, report.message)

    # Re-evaluate zone immediately
    z = risk_engine.get_zone_state(report.zone_id)
    if z:
        risk_engine.ingest(
            zone_id=report.zone_id,
            person_count=z["person_count"],
            density=z["density"],
            behaviour_flag=z["behaviour_flag"],
            sensor_status=z["sensor_status"]
        )

    # Broadcast update
    state = risk_engine.get_venue_state()
    state["type"] = "venue_state"
    await manager.broadcast(state)

    return {
        "status": "ok",
        "message": f"Hazard report logged for {report.zone_id}",
        "zone_id": report.zone_id
    }


# --- Alerts & Human-in-the-Loop Actions ---
@app.get("/api/alerts")
async def list_alerts(limit: int = 20):
    return get_alerts(limit)


@app.post("/api/alerts")
async def create_alert(alert_payload: dict):
    """Dispatches a manual or automated alert to the system."""
    alert_id = save_alert(
        zone_id=alert_payload["zone_id"],
        level=alert_payload["level"],
        recommendation=alert_payload.get("recommendation", ""),
        observation=alert_payload.get("observation", ""),
        trend=alert_payload.get("trend", ""),
        prediction=alert_payload.get("prediction", ""),
        expected_benefit=alert_payload.get("expected_benefit", ""),
        source=alert_payload.get("source", "template")
    )
    alert_obj = {"alert_id": alert_id, **alert_payload}
    await manager.broadcast({"type": "recommendation", "recommendation": alert_obj})
    return {"alert_id": alert_id}


@app.post("/api/alerts/{alert_id}/action")
async def record_alert_action(alert_id: int, action: AlertAction):
    """
    POST /api/alerts/{id}/action (Human-in-the-Loop Approval)
    Operator records 'approved', 'rejected', or 'edited' directive.
    """
    if action.action not in ("approved", "rejected", "edited"):
        raise HTTPException(status_code=400, detail="Action must be 'approved', 'rejected', or 'edited'")

    update_alert_action(alert_id, action.action)

    # Inform agentic cognitive memory to track post-intervention density drops
    if action.action == "approved" and agent_daemon and risk_engine:
        alerts = get_alerts(30)
        matched = next((a for a in alerts if a["alert_id"] == alert_id), None)
        if matched:
            z_id = matched["zone_id"]
            z = risk_engine.get_zone_state(z_id)
            if z:
                agent_daemon.record_operator_approval(alert_id, z_id, z["density"])

    await manager.broadcast({
        "type": "alert_action",
        "alert_id": alert_id,
        "action": action.action,
        "notes": action.directive_notes,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    })

    print(f"👨‍✈️ [OPERATOR ACTION]: Alert #{alert_id} marked as '{action.action.upper()}'")
    return {"status": "ok", "alert_id": alert_id, "action": action.action}


# ============================================================
# PHASE 2 EXTENSIONS: FLOW PREDICTION, SOPS & STEWARD OPTIMIZATION
# ============================================================

from backend.flow_engine import CrossZoneFlowEngine
from backend.sop_engine import SOPEngine
from backend.resource_engine import ResourceOptimizationEngine

flow_engine = CrossZoneFlowEngine()
sop_engine = SOPEngine()
resource_engine = ResourceOptimizationEngine()


@app.get("/api/flow/predict")
async def get_flow_predictions():
    """Predicts wavefront spillover propagation across adjacent zones (Phase 2 F13)."""
    if not risk_engine:
        raise HTTPException(status_code=503, detail="Risk Engine not initialized")
    state = risk_engine.get_venue_state()
    return flow_engine.predict_spillovers(state.get("zones", []))


@app.get("/api/flow/evacuation/{zone_id}")
async def get_evacuation_route(zone_id: str):
    """Calculates step-by-step egress evacuation route from zone to Emergency Exit C."""
    return flow_engine.get_evacuation_routes(zone_id)


@app.get("/api/resources/optimize")
async def get_steward_optimization(pool: int = 12):
    """Calculates optimal steward deployment based on priority-weighted risk deficits (Phase 2 F15)."""
    if not risk_engine:
        raise HTTPException(status_code=503, detail="Risk Engine not initialized")
    state = risk_engine.get_venue_state()
    return resource_engine.optimize_allocation(state.get("zones", []), total_pool=pool)


@app.get("/api/sops/{zone_id}")
async def get_zone_sop(zone_id: str):
    """Generates standard operating procedure (SOP) based on real-time zone status (Phase 2 F16)."""
    if not risk_engine:
        raise HTTPException(status_code=503, detail="Risk Engine not initialized")
    z = risk_engine.get_zone_state(zone_id)
    if not z:
        raise HTTPException(status_code=404, detail="Zone not found")
    return sop_engine.get_sop_for_state(zone_id, z["zone_name"], z["state"], z["behaviour_flag"])


@app.get("/api/roles")
async def get_roles():
    """Returns available operational command views (Chief, Police, Volunteer - Phase 2 F14)."""
    return {
        "roles": [
            {"id": "chief", "name": "Chief Operations Commander", "access": "full_iccc", "focus": "all_sectors"},
            {"id": "police", "name": "Police Tactical Units", "access": "security_tactical", "focus": "chokepoints_and_egress"},
            {"id": "volunteer", "name": "Field Stewards & Volunteers", "access": "field_responder", "focus": "steward_posts_and_wayfinding"}
        ]
    }


# --- Briefings ---
@app.get("/api/briefings")
async def list_briefings(limit: int = 10):
    return get_briefings(limit)


@app.post("/api/briefings/generate")
async def trigger_briefing():
    """Forces an immediate on-demand safety briefing."""
    if agent_daemon:
        content = await agent_daemon.generate_briefing(trigger_type="manual")
        return {"status": "ok", "briefing": content}
    raise HTTPException(status_code=503, detail="Agent daemon not running")


# --- Grounded Operator Chat ---
@app.post("/api/chat")
async def send_chat(msg: ChatMessage):
    """POST /api/chat (Section 2 FR11 Grounded Q&A)"""
    if not agent_daemon:
        raise HTTPException(status_code=503, detail="Agent daemon not running")
    response_text = await agent_daemon.handle_chat(msg.message)
    return {"status": "ok", "response": response_text}


@app.get("/api/chat")
async def get_chat_history(limit: int = 50):
    return get_chat(limit)


# --- Weather Simulation Toggle (S07 Adverse Weather) ---
@app.post("/api/weather")
async def set_weather(w: WeatherToggle):
    """Toggles adverse weather (rain / storm) increasing outdoor zone risks by +15%."""
    if risk_engine:
        risk_engine.set_weather(condition=w.condition, active=w.active)
        state = risk_engine.get_venue_state()
        state["type"] = "venue_state"
        await manager.broadcast(state)
        return {"status": "ok", "weather": state["weather"]}
    raise HTTPException(status_code=503, detail="Risk Engine not available")


# --- Live Video Stream / CCTV Buffer ---
latest_frame_jpeg: Optional[bytes] = None
last_frame_time: float = 0.0
latest_frame_seq: int = 0


def generate_standby_frame() -> bytes:
    try:
        import cv2
        import numpy as np
        img = np.full((360, 640, 3), 18, dtype=np.uint8)
        for x in range(0, 640, 40):
            cv2.line(img, (x, 0), (x, 360), (28, 28, 38), 1)
        for y in range(0, 360, 40):
            cv2.line(img, (0, y), (640, y), (28, 28, 38), 1)
        cv2.putText(img, "CAM 01 // MAIN CONCOURSE CCTV", (20, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 220, 255), 2)
        cv2.putText(img, "YOLOv8 REAL-TIME ANALYTICS: STANDBY", (20, 65), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (140, 140, 140), 1)
        cv2.circle(img, (610, 30), 6, (0, 0, 220), -1)
        cv2.putText(img, "STANDBY", (530, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0, 0, 220), 1)
        cv2.putText(img, "ACTIVE CAMERA / VIDEO STREAM READY", (130, 185), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 200, 200), 1)
        cv2.putText(img, "Run: python vision/run_vision.py --source data/crowd_sample.mp4", (70, 215), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0, 230, 150), 1)
        _, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 75])
        return buf.tobytes()
    except Exception:
        return b""


@app.post("/api/vision/frame")
async def upload_frame(request: Request):
    global latest_frame_jpeg, last_frame_time, latest_frame_seq
    latest_frame_jpeg = await request.body()
    last_frame_time = time.time()
    latest_frame_seq += 1
    return {"status": "ok"}


@app.get("/api/video/feed")
async def video_feed(channel: str = "cam1"):
    """Streams live CCTV MJPEG feed with minimal latency."""
    async def frame_generator():
        standby_bytes = generate_standby_frame()
        last_sent_seq = -1
        while True:
            now = time.time()
            if latest_frame_seq != last_sent_seq and latest_frame_jpeg and (now - last_frame_time) < 3.0:
                data = latest_frame_jpeg
                last_sent_seq = latest_frame_seq
                yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + data + b"\r\n")
            elif video_streamer:
                frame_data = video_streamer.get_latest_frame(channel)
                if frame_data:
                    yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + frame_data + b"\r\n")
                else:
                    yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + standby_bytes + b"\r\n")
            else:
                yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + standby_bytes + b"\r\n")
            await asyncio.sleep(0.04)

    return StreamingResponse(
        frame_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-cache, no-store, must-revalidate"}
    )


# --- QR Code Citizen Access ---
@app.get("/api/qr")
async def get_qr_code():
    import io
    import socket

    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
    except Exception:
        local_ip = "localhost"

    port = os.getenv("BACKEND_PORT", "8000")
    url = f"http://{local_ip}:{port}/report.html"

    try:
        import qrcode
        qr = qrcode.QRCode(version=1, box_size=10, border=4)
        qr.add_data(url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        return StreamingResponse(buf, media_type="image/png", headers={"X-QR-URL": url})
    except Exception:
        import cv2
        import numpy as np
        # Generate clean QR fallback badge with OpenCV
        badge = np.full((240, 240, 3), 255, dtype=np.uint8)
        cv2.rectangle(badge, (10, 10), (230, 230), (0, 0, 0), 2)
        cv2.rectangle(badge, (20, 20), (60, 60), (0, 0, 0), -1)
        cv2.rectangle(badge, (180, 20), (220, 60), (0, 0, 0), -1)
        cv2.rectangle(badge, (20, 180), (60, 220), (0, 0, 0), -1)
        cv2.putText(badge, "CITIZEN BEACON", (35, 115), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 0), 1)
        cv2.putText(badge, f"/report.html", (45, 140), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (80, 80, 80), 1)
        _, png_buf = cv2.imencode(".png", badge)
        return StreamingResponse(io.BytesIO(png_buf.tobytes()), media_type="image/png", headers={"X-QR-URL": url})


# ============================================================
# TACTICAL SIMULATION ENDPOINTS (Master Scenarios S01 - S10)
# ============================================================

demo_scenario_task: Optional[asyncio.Task] = None


async def run_surge_simulation():
    """S02: Simulates Gate A sudden influx 2 -> 12 persons."""
    try:
        for count in [3, 5, 8, 10, 12]:
            den = round(count / 6.0, 3)
            beh = "surge" if count >= 8 else ("running" if count >= 5 else "normal")
            risk_engine.ingest(
                zone_id="gate_a",
                person_count=count,
                density=den,
                behaviour_flag=beh,
                sensor_status="ok"
            )
            if agent_daemon:
                asyncio.create_task(agent_daemon.run_cycle(force=True, trigger="surge_sim"))
            await asyncio.sleep(2.0)
    except asyncio.CancelledError:
        pass


@app.post("/api/demo/scenario/{scenario_id}")
async def trigger_demo_scenario(scenario_id: str):
    """Triggers preset master scenarios S01 - S10 directly from command dashboard."""
    global demo_scenario_task
    if demo_scenario_task and not demo_scenario_task.done():
        demo_scenario_task.cancel()

    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    if scenario_id in ("normal", "s01", "reset"):
        # S01: Steady State Baseline (all zones Safe, risk < 0.35)
        for zid, area in [("gate_a", 6.0), ("corridor_b", 8.0), ("exit_c", 6.0), ("counter_d", 6.0), ("ground_e", 20.0)]:
            cnt = 1 if zid != "ground_e" else 3
            risk_engine.ingest(
                zone_id=zid,
                person_count=cnt,
                density=round(cnt / area, 3),
                behaviour_flag="normal",
                sensor_status="ok",
                timestamp=now_iso,
            )
        risk_engine.set_weather(condition="fair", active=False)
        return {"status": "ok", "message": "S01: Venue reset to Safe baseline"}

    elif scenario_id in ("surge", "s02"):
        # S02: Rapid Inflow Surge at Gate A
        demo_scenario_task = asyncio.create_task(run_surge_simulation())
        return {"status": "ok", "message": "S02: Rapid Inflow Surge at Gate A initiated (escalating over 10s)"}

    elif scenario_id in ("running", "s03"):
        # S03: Running Panic in Corridor B
        risk_engine.ingest(
            zone_id="corridor_b",
            person_count=6,
            density=round(6 / 8.0, 3),
            behaviour_flag="running",
            sensor_status="ok",
            timestamp=now_iso
        )
        if agent_daemon:
            asyncio.create_task(agent_daemon.run_cycle(force=True, trigger="running_sim"))
        return {"status": "ok", "message": "S03: Running Panic flag active in Corridor B (elevates to Warning)"}

    elif scenario_id in ("reverse_flow", "s04"):
        # S04: Counter-flow at Exit C
        risk_engine.ingest(
            zone_id="exit_c",
            person_count=5,
            density=round(5 / 6.0, 3),
            behaviour_flag="counter_flow",
            sensor_status="ok",
            timestamp=now_iso
        )
        if agent_daemon:
            asyncio.create_task(agent_daemon.run_cycle(force=True, trigger="counter_flow_sim"))
        return {"status": "ok", "message": "S04: Reverse Flow detected at Exit C"}

    elif scenario_id in ("citizen", "s05"):
        # S05: Citizen Report
        save_citizen_report("ground_e", "Severe crowd congestion developing near central stage!")
        z = risk_engine.get_zone_state("ground_e")
        if z:
            risk_engine.ingest("ground_e", z["person_count"], z["density"], z["behaviour_flag"])
        return {"status": "ok", "message": "S05: Citizen hazard report injected for Ground E"}

    elif scenario_id in ("spillover", "s06"):
        # S06: Cross-Zone Spillover Propagation
        risk_engine.ingest("gate_a", 12, 2.0, "surge", "ok")
        if agent_daemon:
            asyncio.create_task(agent_daemon.run_cycle(force=True, trigger="spillover_sim"))
        return {"status": "ok", "message": "S06: Cross-Zone Spillover projected from Gate A -> Corridor B"}

    elif scenario_id in ("weather", "s07"):
        # S07: Adverse Weather (Rain)
        is_active = not risk_engine.rain_active
        risk_engine.set_weather(condition="rain" if is_active else "fair", active=is_active)
        state = risk_engine.get_venue_state()
        state["type"] = "venue_state"
        await manager.broadcast(state)
        return {"status": "ok", "message": f"S07: Adverse Weather {'ENABLED (+15% outdoor risk)' if is_active else 'DISABLED'}"}

    elif scenario_id in ("disconnect", "s10"):
        # S10: Sensor Disconnect
        risk_engine.ingest("gate_a", 0, 0.0, "normal", sensor_status="unavailable")
        state = risk_engine.get_venue_state()
        state["type"] = "venue_state"
        await manager.broadcast(state)
        return {"status": "ok", "message": "S10: Gate A Camera sensor disconnected (system remains stable)"}

    elif scenario_id in ("critical", "emergency"):
        risk_engine.ingest("gate_a", 12, 2.0, "surge", "ok")
        if agent_daemon:
            asyncio.create_task(agent_daemon.run_cycle(force=True, trigger="critical_sim"))
        return {"status": "ok", "message": "Gate A Critical state & 5-part XAI Recommendation triggered"}

    else:
        raise HTTPException(status_code=400, detail=f"Unknown scenario ID: {scenario_id}")


# ============================================================
# WEBSOCKET ENDPOINT
# ============================================================

@app.websocket("/ws/live")
async def websocket_live_stream(websocket: WebSocket):
    """Live bidirectional WebSocket stream for dashboard telemetry."""
    await manager.connect(websocket)
    try:
        if risk_engine:
            initial_state = risk_engine.get_venue_state()
            initial_state["type"] = "venue_state"
            await websocket.send_text(json.dumps(initial_state))

        while True:
            msg = await websocket.receive_text()
            if msg == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("BACKEND_PORT", "8000"))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=True)
