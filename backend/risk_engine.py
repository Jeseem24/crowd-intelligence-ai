"""
Context-Aware Risk Engine — The mathematical core of the system.
Strictly implements Handbook Section 5:
- 4-Factor Fused Risk Score: R(z,t) = min(1.0, w(z) * [0.45*D + 0.20*T + 0.25*B + 0.10*C])
- OLS Linear Trend Slope: m (p/m²/s)
- Time-to-Critical: T_crit = (5.0 - rho) / m  (when m > 0.02)
- Asymmetric Anti-Flicker Hysteresis: N_up = 2, N_down = 3
- Adverse Weather & Spillover Prediction integrations
"""

import numpy as np
import time
import json
from collections import deque
from pathlib import Path
from backend.database import get_zones, get_active_reports, log_risk

# Canonical constants from Section 5
RHO_CRITICAL = 5.0       # Critical density threshold (people/m²)
BUFFER_SIZE = 15          # Rolling window size (readings)
SLOPE_THRESHOLD = 0.02    # Minimum slope to project time-to-critical

# Behaviour flag weights from Section 5.1
BEHAVIOUR_SCORES = {
    "normal": 0.0,
    "running": 0.5,
    "counter_flow": 0.75,
    "reverse_flow": 0.75,
    "surge": 1.0,
}

# State order
STATE_RANKS = {
    "Safe": 0,
    "Watch": 1,
    "Warning": 2,
    "Critical": 3
}


class ZoneState:
    """Tracks real-time telemetry, trend regression, fused risk score, and hysteresis for a single zone."""

    def __init__(self, zone_config):
        self.zone_id = zone_config["zone_id"]
        self.zone_name = zone_config["zone_name"]
        self.zone_type = zone_config.get("zone_type", "General")
        self.priority_weight = float(zone_config.get("priority_weight", 1.0))
        self.floor_area = float(zone_config.get("floor_area_sqm", 10.0))
        self.thresholds = {
            "watch": float(zone_config.get("watch_threshold", 0.35)),
            "warning": float(zone_config.get("warning_threshold", 0.60)),
            "critical": float(zone_config.get("critical_threshold", 0.85)),
        }

        # Rolling buffer: stores (timestamp_float, density_float)
        self.density_buffer = deque(maxlen=BUFFER_SIZE)

        # Current telemetry
        self.person_count = 0
        self.density = 0.0
        self.behaviour_flag = "normal"
        self.sensor_status = "ok"
        self.last_timestamp = ""

        # Computed metrics
        self.trend_slope = 0.0
        self.time_to_critical_s = None
        self.risk_score = 0.0
        self.state = "Safe"
        self.previous_state = "Safe"
        self.active_reports = 0

        self.escalation_counter = 0
        self.deescalation_counter = 0
        self._target_state = "Safe"

    def force_telemetry(self, person_count, density, risk_score, state, behaviour_flag="surge", trend_slope=0.035, timestamp=None):
        """Immediately sets explicit zone telemetry bypassing hysteresis (used by master scenarios)."""
        if timestamp is None:
            timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        self.person_count = int(person_count)
        self.density = float(density)
        self.risk_score = round(float(risk_score), 3)
        self.previous_state = self.state
        self.state = state
        self._target_state = state
        self.behaviour_flag = behaviour_flag
        self.trend_slope = float(trend_slope)
        self.last_timestamp = timestamp
        self.escalation_counter = 0
        self.deescalation_counter = 0
        now_sec = time.time()
        self.density_buffer.append((now_sec, self.density))
        try:
            log_risk(
                self.zone_id, timestamp, self.person_count, self.density,
                self.behaviour_flag, self.risk_score, self.state,
                self.trend_slope, self.time_to_critical_s
            )
        except Exception:
            pass

    def ingest(self, person_count, density, behaviour_flag="normal", sensor_status="ok", timestamp=None, weather_multiplier=1.0):
        """Ingest a new reading and compute all spatial metrics."""
        if timestamp is None:
            timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        self.person_count = person_count
        self.density = float(density)
        self.behaviour_flag = behaviour_flag
        self.sensor_status = sensor_status
        self.last_timestamp = timestamp

        now_sec = time.time()
        if sensor_status == "ok":
            self.density_buffer.append((now_sec, self.density))

        # 1. Compute Linear Regression Trend Slope m and Time-to-Critical
        self._compute_trend()

        # 2. Compute 4-Factor Fused Risk Score
        self._compute_risk_score(weather_multiplier=weather_multiplier)

        # 3. Apply Asymmetric Anti-Flicker Hysteresis
        state_changed = self._apply_hysteresis()

        # 4. Log to database with trend slope and time-to-critical
        try:
            log_risk(
                self.zone_id, timestamp, person_count, self.density,
                behaviour_flag, self.risk_score, self.state,
                self.trend_slope, self.time_to_critical_s
            )
        except Exception as e:
            print(f"Risk log DB write warning: {e}")

        return state_changed

    def _compute_trend(self):
        """OLS linear regression slope over rolling buffer & Time-to-Critical."""
        n = len(self.density_buffer)
        if n < 3:
            self.trend_slope = 0.0
            self.time_to_critical_s = None
            return

        times = np.array([t for t, _ in self.density_buffer])
        densities = np.array([d for _, d in self.density_buffer])

        # Normalize time origin to avoid numeric overflow
        t_norm = times - times[0]

        # Polyfit degree 1: y = m*t + c
        try:
            poly = np.polyfit(t_norm, densities, 1)
            self.trend_slope = round(float(poly[0]), 3)
        except Exception:
            self.trend_slope = 0.0

        # Time-to-Critical formula: T_crit = (rho_crit - rho_curr) / m  (when m > 0.02)
        if self.trend_slope > SLOPE_THRESHOLD and self.density < RHO_CRITICAL:
            t_crit = (RHO_CRITICAL - self.density) / self.trend_slope
            self.time_to_critical_s = round(float(t_crit), 1)
        else:
            self.time_to_critical_s = None

    def _compute_risk_score(self, weather_multiplier=1.0):
        """
        4-factor mathematical formula from Section 5.1:
        R(z, t) = min(1.0, w(z) * [0.45*D + 0.20*T + 0.25*B + 0.10*C])
        """
        # 1. Normalized Density D(z, t) = min(1.0, rho / 5.0)
        D = min(1.0, self.density / RHO_CRITICAL)

        # 2. Normalized Trend Velocity T(z, t) = max(0.0, min(1.0, (m + 0.10) / 0.30))
        T = max(0.0, min(1.0, (self.trend_slope + 0.10) / 0.30))

        # 3. Behaviour Term B(z, t)
        B = BEHAVIOUR_SCORES.get(self.behaviour_flag, 0.0)

        # 4. Citizen Reports Term C(z, t) = min(1.0, active_reports * 0.30)
        try:
            self.active_reports = get_active_reports(self.zone_id)
        except Exception:
            self.active_reports = 0
        C = min(1.0, self.active_reports * 0.30)

        # Weighted Sum
        weighted_sum = (0.45 * D) + (0.20 * T) + (0.25 * B) + (0.10 * C)

        # Apply Priority Weight & Weather adjustment
        raw_score = self.priority_weight * weighted_sum * weather_multiplier

        # Clamp to [0.0, 1.0]
        self.risk_score = round(min(1.0, max(0.0, float(raw_score))), 3)

    def _apply_hysteresis(self):
        """
        Asymmetric Anti-Flicker State Machine (Section 5.4):
        - Escalation requires N_up = 2 consecutive cycles above threshold
        - De-escalation requires N_down = 3 consecutive cycles below threshold
        """
        # Determine target state based on thresholds
        if self.risk_score >= self.thresholds["critical"]:
            target_state = "Critical"
        elif self.risk_score >= self.thresholds["warning"]:
            target_state = "Warning"
        elif self.risk_score >= self.thresholds["watch"]:
            target_state = "Watch"
        else:
            target_state = "Safe"

        self._target_state = target_state
        cur_rank = STATE_RANKS[self.state]
        tgt_rank = STATE_RANKS[target_state]

        self.previous_state = self.state
        state_changed = False

        if tgt_rank > cur_rank:
            # Escalation path
            self.escalation_counter += 1
            self.deescalation_counter = 0
            if self.escalation_counter >= 2:
                self.state = target_state
                self.escalation_counter = 0
                state_changed = True
        elif tgt_rank < cur_rank:
            # De-escalation path
            self.deescalation_counter += 1
            self.escalation_counter = 0
            if self.deescalation_counter >= 3:
                self.state = target_state
                self.deescalation_counter = 0
                state_changed = True
        else:
            # Steady state in same band
            self.escalation_counter = 0
            self.deescalation_counter = 0

        return state_changed

    def to_dict(self):
        return {
            "zone_id": self.zone_id,
            "zone_name": self.zone_name,
            "zone_type": self.zone_type,
            "priority_weight": self.priority_weight,
            "floor_area_sqm": self.floor_area,
            "person_count": self.person_count,
            "density": round(self.density, 2),
            "behaviour_flag": self.behaviour_flag,
            "trend_slope": self.trend_slope,
            "time_to_critical_s": self.time_to_critical_s,
            "risk_score": self.risk_score,
            "state": self.state,
            "active_reports": self.active_reports,
            "sensor_status": self.sensor_status,
        }


class RiskEngine:
    """Manages all zone trackers, adjacency graph, and venue-wide risk aggregation."""

    def __init__(self, config_path=None):
        if config_path is None:
            config_path = Path(__file__).resolve().parent.parent / "config" / "zones.json"
        
        self.config_path = Path(config_path)
        self.zones_config = self._load_zones()
        self.trackers = {z["zone_id"]: ZoneState(z) for z in self.zones_config}
        
        # Load adjacency graph for cross-zone flow prediction
        self.adj_graph = self._load_adjacency()
        
        # Weather simulation state (S07)
        self.weather_condition = "fair"
        self.rain_active = False

    def _load_zones(self):
        if not self.config_path.exists():
            return []
        with open(self.config_path, "r") as f:
            data = json.load(f)
        return data.get("zones", [])

    def _load_adjacency(self):
        adj_file = self.config_path.parent / "adjacency.json"
        if adj_file.exists():
            try:
                with open(adj_file, "r") as f:
                    return json.load(f).get("connections", [])
            except Exception:
                pass
        return []

    def set_weather(self, condition="fair", active=False):
        """Toggle weather condition (S07 Adverse Weather scenario)."""
        self.weather_condition = condition
        self.rain_active = active

    def ingest(self, zone_id, person_count, density, behaviour_flag="normal",
               sensor_status="ok", timestamp=None):
        """Ingest telemetry for a zone with weather multiplier applied to outdoor zones."""
        if zone_id not in self.trackers:
            return False

        # Apply +15% weather risk multiplier to outdoor/general areas if rain is active (S07)
        multiplier = 1.0
        if self.rain_active and self.trackers[zone_id].zone_type in ("General", "General Area"):
            multiplier = 1.15

        return self.trackers[zone_id].ingest(
            person_count=person_count,
            density=density,
            behaviour_flag=behaviour_flag,
            sensor_status=sensor_status,
            timestamp=timestamp,
            weather_multiplier=multiplier
        )

    def force_zone_state(self, zone_id, person_count, density, risk_score, state, behaviour_flag="surge", trend_slope=0.035):
        """Immediately sets explicit zone telemetry bypassing hysteresis."""
        if zone_id in self.trackers:
            self.trackers[zone_id].force_telemetry(
                person_count=person_count,
                density=density,
                risk_score=risk_score,
                state=state,
                behaviour_flag=behaviour_flag,
                trend_slope=trend_slope
            )

    def get_zone_state(self, zone_id):
        if zone_id in self.trackers:
            return self.trackers[zone_id].to_dict()
        return None

    def get_venue_state(self):
        """Aggregate full venue state and determine highest severity level."""
        zones_list = [t.to_dict() for t in self.trackers.values()]
        
        overall = "Safe"
        for z in zones_list:
            if STATE_RANKS[z["state"]] > STATE_RANKS[overall]:
                overall = z["state"]

        # Predict cross-zone flow propagation if any zone is in Warning/Critical (S06 / Phase 2)
        spillover_alerts = []
        for z in zones_list:
            if z["state"] in ("Warning", "Critical") and z["trend_slope"] > 0.02:
                for edge in self.adj_graph:
                    if edge["source"] == z["zone_id"]:
                        target_id = edge["target"]
                        target_tracker = self.trackers.get(target_id)
                        target_name = target_tracker.zone_name if target_tracker else target_id
                        spillover_alerts.append({
                            "source_zone": z["zone_id"],
                            "source_name": z["zone_name"],
                            "target_zone": target_id,
                            "target_name": target_name,
                            "eta_seconds": edge["walk_time_seconds"],
                            "chokepoint_risk": edge.get("chokepoint_risk", "medium"),
                            "directive": f"Pre-position crowd stewards at {target_name}. Expected spillover arrival in ~{edge['walk_time_seconds']}s."
                        })

        return {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "overall_status": overall,
            "zones": zones_list,
            "weather": {
                "condition": self.weather_condition,
                "rain_active": self.rain_active,
                "adverse_risk_active": self.rain_active
            },
            "spillover_predictions": spillover_alerts
        }
