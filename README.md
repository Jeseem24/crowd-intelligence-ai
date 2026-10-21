# AI-Powered Crowd Intelligence & Decision Support System
## Master Implementation & Autonomous Safety Command Center (7th Semester B.Tech IT)

[![Architecture](https://img.shields.io/badge/Architecture-6--Layer%20Multi--Modal-indigo.svg)](#architecture)
[![Vision](https://img.shields.io/badge/Vision-YOLOv8%20Nano-blue.svg)](#vision-engine)
[![Risk Engine](https://img.shields.io/badge/Risk%20Engine-4--Factor%20Fusion%20%2B%20Hysteresis-emerald.svg)](#mathematical-risk-engine)
[![Agentic AI](https://img.shields.io/badge/Agentic%20AI-Cognitive%20Loop%20%2B%20XAI-purple.svg)](#agentic-ai-decision-layer)
[![Testing](https://img.shields.io/badge/Tests-S01--S10%20Master%20Suite-rose.svg)](#testing-suite--master-scenarios)

---

## 1. Executive Summary & Problem Formulation
This system is an autonomous multi-modal decision support platform engineered to prevent acute crowd stampedes and crush disasters (such as the 2025 Maha Kumbh Mela and Karur incidents). Conventional surveillance relies on human operators staring at hundreds of passive video tiles, leading to acute alert fatigue and delayed intervention. 

Our system continuously transforms video telemetry into proactive, spatial risk scores and delivers **5-part Explainable AI (XAI)** directives with a strict **Human-in-the-Loop** approval workflow.

### The Six Solved Engineering Gaps
1. **G1: Prediction Gap** — Linear regression trend slope projecting Time-to-Critical 30-90s in advance.
2. **G2: Cost Barrier** — Lightweight stack running on standard commodity laptop hardware without GPU clusters.
3. **G3: Spatial Blindness** — Priority-weighted polygon zones for turnstile gates, corridors, exits, and gathering grounds.
4. **G4: Alert Fatigue** — Structured 5-part XAI contracts clarifying exact observation, trend, prediction, recommendation, and expected benefit.
5. **G5: Passive AI** — Continuous agentic cognitive loop (Observe -> Analyze -> Predict -> Recommend) executing every 15s.
6. **G6: Kinematic Neglect** — Real-time classification of surge, running panic, and reverse-flow counter-currents.

---

## 2. 6-Layer Architecture & Repository Blueprint

```
crowd-safety/
├── backend/                       # BACKEND & RISK ENGINE (Member 2)
│   ├── main.py                    # FastAPI application, WebSockets, REST endpoints
│   ├── database.py                # SQLite WAL schema, risk_logs, alerts, chat_logs
│   ├── models.py                  # Canonical Pydantic data contracts
│   └── risk_engine.py             # 4-factor fusion, OLS trend, hysteresis (N_up=2, N_down=3)
├── agent/                         # AGENTIC AI DECISION LAYER (Member 1)
│   ├── reasoning.py               # 4-stage cognitive loop (Observe -> Analyze -> Predict -> Recommend)
│   ├── template_fallback.py       # Zero-crash deterministic offline fallback engine
│   ├── llm_client.py              # Groq LLM client (Qwen 3.8 27B) with retry & fallback
│   ├── chat_handler.py            # Grounded natural language operator Q&A
│   └── scheduler.py               # Background asyncio daemon (15s cycle, 60s briefings)
├── vision/                        # VISION PERCEPTION LAYER (Member 1)
│   ├── detector.py                # YOLOv8n inference with bottom-center foot contact anchoring
│   ├── zone_mapper.py             # Point-in-polygon zone allocation (OpenCV pointPolygonTest)
│   ├── behaviour.py               # Kinematic delta surge, running, and counter-flow classifier
│   ├── pipeline.py                # Real-time capture -> detect -> classify -> POST loop
│   └── run_vision.py              # Vision CLI runner with dual-stage sliced inference
├── config/                        # CONFIGURATION SPECIFICATION (Member 2)
│   ├── zones.json                 # 5 canonical demo zones, coordinates, thresholds, weights
│   ├── adjacency.json             # Topological spatial adjacency graph for cross-zone flow
│   └── schedule.json              # Event timetable and surge probability markers
├── frontend/                      # COMMAND DASHBOARD & PORTAL (Member 3 & Member 4)
│   ├── index.html                 # Tactical Command Center UI shell
│   ├── app.js                     # Live WebSocket state dispatcher, XAI cards, audio synthesizer
│   ├── style.css                  # Military-grade dark mode styling with tactile indicators
│   ├── report.html                # Mobile QR citizen hazard reporting portal
│   └── venue_map.svg              # High-tech vector floor plan
├── data/                          # MEDIA & BENCHMARKS (Member 4)
│   └── crowd_sample.mp4           # Benchmark multi-zone crowd test video
└── tests/                         # TESTING & QA SUITE (Member 4)
    ├── test_risk_math.py          # Validates Section 5.3 numerical worked example + hysteresis
    ├── test_contracts.py          # Validates Section 4 JSON schemas & SQLite DDL
    └── replay_scenario.py         # Master scenario replay harness (S01 through S10)
```

---

## 3. Mathematical Risk Formulation (Section 5)

### Continuous Fused Spatial Risk Score $R(z, t) \in [0.0, 1.0]$:
$$R(z, t) = \min\left(1.0, \; w(z) \cdot \left[ 0.45 \cdot D(z, t) + 0.20 \cdot T(z, t) + 0.25 \cdot B(z, t) + 0.10 \cdot C(z, t) \right]\right)$$

- **$w(z)$**: Priority weight factor (e.g. 2.0 for Gate A, 1.75 for Corridor B, 2.0 for Exit C, 1.0 for Grounds).
- **$D(z, t)$**: Normalized Density $= \min(1.0, \; \rho / 5.0\text{ p/m}^2)$.
- **$T(z, t)$**: Normalized Trend Velocity $= \max(0.0, \; \min(1.0, \; (m + 0.10) / 0.30))$.
- **$B(z, t)$**: Behaviour value (`normal` = 0.0, `running` = 0.5, `counter_flow` = 0.75, `surge` = 1.0).
- **$C(z, t)$**: Citizen hazard reports $= \min(1.0, \; \text{active\_reports} \cdot 0.30)$.

### Linear Trend Slope $m$ & Time-to-Critical Projection $T_{crit}$:
Using an ordinary least-squares fit over rolling density buffer:
$$m = \frac{N \sum(t_i \rho_i) - \sum t_i \sum \rho_i}{N \sum(t_i^2) - \left(\sum t_i\right)^2}$$

If $m > 0.02\text{ p/m}^2/\text{s}$ and $\rho < 5.0\text{ p/m}^2$:
$$T_{crit} = \frac{5.0 - \rho}{m} \quad (\text{seconds})$$

### Asymmetric Anti-Flicker Hysteresis:
- **Escalation (Upward):** Requires $N_{up} = 2$ consecutive cycles above the upper threshold.
- **De-escalation (Downward):** Requires $N_{down} = 3$ consecutive cycles below the lower threshold.

---

## 4. Quick Start & Execution

### 1. Prerequisites
- Python 3.10+
- Modern Web Browser (Chrome, Edge, Firefox)

### 2. Environment Setup
```powershell
# Navigate to project directory
cd "C:\Users\HP\Desktop\Mini Project\crowd-safety"

# Activate Python Virtual Environment
.\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Start the Command Operations Center (Terminal 1)
```powershell
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
- **Command Dashboard:** [http://localhost:8000/](http://localhost:8000/)
- **Mobile Citizen Portal:** [http://localhost:8000/report.html](http://localhost:8000/report.html)
- **Interactive Swagger Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)

### 4. Run the Vision Inference Stream (Terminal 2)
```powershell
python vision/run_vision.py --source data/crowd_sample.mp4
```

### 5. Execute Master Scenario Replays (Terminal 3)
```powershell
# Run individual master scenario
python tests/replay_scenario.py s02

# Or run all S01 - S10 scenarios sequentially
python tests/replay_scenario.py all
```

---

## 5. Master Scenarios (S01 - S10 Traceability Matrix)

| Scenario ID | Event Name | Trigger Input | Expected Output & Validation |
| :--- | :--- | :--- | :--- |
| **S01** | Steady State | Normal baseline flow $\le 4$ persons/zone | All zones Safe, risk $< 0.35$, zero false alerts. |
| **S02** | Rapid Surge | Gate A inflow $+4$ in 1s ($\rho > 1.3$) | Critical red banner, audio chime, $T_{crit} \approx 31\text{s}$. |
| **S03** | Running Panic | Corridor B speed $> 2.5\text{ m/s}$ | Behaviour flag `running`, elevates zone to Warning. |
| **S04** | Reverse Flow | Exit C counter-current | Flag `counter_flow`, advisory directs steward allocation. |
| **S05** | Citizen Report | Mobile report submitted via QR portal | Zone risk score visibly elevates in $\le 1\text{s}$, badge shown. |
| **S06** | Cross-Zone Spill | Sustained surge at Gate A | Adjacency model projects arrival at Corridor B in 45s. |
| **S07** | Adverse Weather | Rain toggled on via API | Outdoor gathering grounds risk multiplier $+15\%$ applied. |
| **S08** | Operator Chat | Natural language operator query | Grounded response with concrete numbers in $\le 2\text{s}$. |
| **S09** | Auto Briefing | 60s autonomous interval | Structured Markdown briefing saved to SQLite and UI. |
| **S10** | Sensor Drop | Camera disconnected or frame dropped | Zone flags `sensor: unavailable`, server runs with zero crash. |

---

## 6. Verification & Automated Test Suites

Run unit test suites:
```powershell
# Verify Section 5.3 numerical worked example + hysteresis anti-flicker
python -m unittest tests/test_risk_math.py

# Verify Section 4 canonical JSON data contracts & database schema
python -m unittest tests/test_contracts.py
```

---

## 7. Team Work Split & Ownership
- **Member 1 (Vision Perception & Agentic AI):** YOLOv8 feet-contact anchoring, OpenCV polygon testing, kinematics classifier, cognitive loop, 5-part XAI templates.
- **Member 2 (Backend Architecture & Risk Engine):** FastAPI application, SQLite WAL database, 4-factor fused risk mathematics, asymmetric hysteresis, WebSocket hub.
- **Member 3 (Command Dashboard UI):** Dynamic SVG floor plan, real-time zone cards, Time-to-Critical chips, audio synthesizer, Human-in-the-Loop Approve/Reject/Edit workflows.
- **Member 4 (Data, Portals & QA Validation):** Replay scenario harness (S01-S10), mobile citizen QR portal, contract testing, mathematical validation suites.
