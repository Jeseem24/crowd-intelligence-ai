"""
Deep Agentic Reasoning Engine — Multi-Step Cognitive Loop & Tool-Enabled AI.
Strictly implements Section 7 File 6 & Handbook Sections 2 & 3:
1. Observe (telemetry + sensor status)
2. Orient & Analyze (spatial graph + flow velocity)
3. Predict (time-to-critical + downstream spillover ETA)
4. Tool Execution (SOP engine, flow prediction, steward optimizer)
5. Recommend (5-Part XAI Directive)
6. Verify & Follow-Up (track post-intervention density drops)
"""

import time
import asyncio
from typing import Dict, Any, Optional
from agent.llm_client import LLMClient
from backend.database import save_alert, save_briefing
from backend.flow_engine import CrossZoneFlowEngine
from backend.sop_engine import SOPEngine
from backend.resource_engine import ResourceOptimizationEngine


class CognitiveEngine:
    def __init__(self, risk_engine=None, broadcast_callback=None):
        self.risk_engine = risk_engine
        self.broadcast_callback = broadcast_callback
        self.llm_client = LLMClient()
        self.flow_engine = CrossZoneFlowEngine()
        self.sop_engine = SOPEngine()
        self.resource_engine = ResourceOptimizationEngine()

        self.active_recommendations = {}
        self.last_alert_time = {}
        self.cooldown_seconds = 10

        # Stateful memory of interventions for outcome verification
        self.pending_interventions = {}  # {zone_id: {"baseline_density": X, "approved_at": T}}
        self.intervention_outcomes = []

    def record_operator_approval(self, alert_id: int, zone_id: str, current_density: float):
        """Records when an operator approves a recommendation for follow-up verification."""
        self.pending_interventions[zone_id] = {
            "alert_id": alert_id,
            "baseline_density": current_density,
            "approved_at": time.time(),
            "status": "evaluating"
        }
        print(f"🧠 [AGENT MEMORY]: Tracking intervention outcome for {zone_id} (Baseline: {current_density:.2f} p/m²)")

    async def run_cycle(self, force=False, trigger="scheduled"):
        """Executes full cognitive cycle with tool execution and intervention verification."""
        if not self.risk_engine:
            return

        # Phase 1: OBSERVE
        venue_state = self.risk_engine.get_venue_state()
        zones = venue_state.get("zones", [])
        now = time.time()

        # Phase 2: VERIFY INTERVENTIONS (Follow-Up Loop)
        await self._verify_intervention_outcomes(zones, now)

        # Phase 3: PREDICT SPILLOVERS (Tool 1: CrossZoneFlowEngine)
        spillovers = self.flow_engine.predict_spillovers(zones)
        venue_state["spillover_predictions"] = spillovers

        # Phase 4: OPTIMIZE STEWARDS (Tool 2: ResourceOptimizationEngine)
        steward_distribution = self.resource_engine.optimize_allocation(zones)
        venue_state["steward_distribution"] = steward_distribution

        # Phase 5: RECOMMEND FOR WARNING / CRITICAL ZONES
        for z in zones:
            z_id = z["zone_id"]
            state = z["state"]

            if state in ("Warning", "Critical"):
                last_time = self.last_alert_time.get(z_id, 0)
                if force or (now - last_time >= self.cooldown_seconds):
                    self.last_alert_time[z_id] = now

                    # Tool 3: Get SOP protocols
                    sop = self.sop_engine.get_sop_for_state(z_id, z["zone_name"], state, z.get("behaviour_flag", "normal"))

                    # Generate 5-part explainable recommendation
                    rec = await self.llm_client.generate_recommendation(z)
                    rec["sop"] = sop
                    self.active_recommendations[z_id] = rec

                    # Persist alert to database
                    try:
                        alert_id = save_alert(
                            zone_id=z_id,
                            level=state,
                            recommendation=rec["recommendation"],
                            observation=rec["observation"],
                            trend=rec["trend"],
                            prediction=rec["prediction"],
                            expected_benefit=rec["expected_benefit"],
                            source=rec.get("source", "template")
                        )
                        rec["alert_id"] = alert_id
                    except Exception as e:
                        print(f"Failed to log alert to DB: {e}")

                    # Broadcast recommendation to dashboard
                    if self.broadcast_callback:
                        await self.broadcast_callback({
                            "type": "recommendation",
                            "recommendation": rec,
                            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                        })
                        print(f"🤖 [AGENT ADVISORY]: Dispatched 5-part recommendation for {z['zone_name']} [{state}]")

    async def _verify_intervention_outcomes(self, zones, now):
        """
        Autonomous follow-up: measures whether approved interventions actually stabilized crowd density.
        """
        zone_map = {z["zone_id"]: z for z in zones}
        resolved = []

        for z_id, record in list(self.pending_interventions.items()):
            z = zone_map.get(z_id)
            if not z:
                continue

            elapsed = now - record["approved_at"]
            # After 12-40s, evaluate efficacy
            if elapsed >= 12.0:
                base_den = record["baseline_density"]
                curr_den = z["density"]
                pct_change = ((curr_den - base_den) / max(0.1, base_den)) * 100.0

                if pct_change < -5.0 or z["state"] in ("Safe", "Watch"):
                    outcome_msg = (
                        f"✅ Directive Confirmed Effective: {z['zone_name']} density dropped by {abs(pct_change):.1f}% "
                        f"({base_den:.2f} -> {curr_den:.2f} p/m²). Chokepoint compression successfully relieved."
                    )
                    status = "success"
                else:
                    outcome_msg = (
                        f"⚠️ Directive In Progress: {z['zone_name']} density is {curr_den:.2f} p/m². "
                        f"Recommend maintaining secondary gate diversion."
                    )
                    status = "monitoring"

                outcome_event = {
                    "type": "intervention_outcome",
                    "zone_id": z_id,
                    "zone_name": z["zone_name"],
                    "status": status,
                    "message": outcome_msg,
                    "baseline_density": base_den,
                    "current_density": curr_den,
                    "percent_reduction": round(-pct_change, 1),
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                }
                self.intervention_outcomes.append(outcome_event)
                resolved.append(z_id)

                if self.broadcast_callback:
                    await self.broadcast_callback(outcome_event)
                    print(f"🎯 [AGENT FEEDBACK]: {outcome_msg}")

        for z_id in resolved:
            self.pending_interventions.pop(z_id, None)

    async def generate_briefing(self, trigger_type="scheduled"):
        """Generates, saves, and broadcasts autonomous structured safety briefing."""
        if not self.risk_engine:
            return None

        venue_state = self.risk_engine.get_venue_state()
        venue_state["spillovers"] = self.flow_engine.predict_spillovers(venue_state.get("zones", []))
        briefing_text = await self.llm_client.generate_briefing(venue_state)

        try:
            save_briefing(briefing_text, trigger_type=trigger_type)
        except Exception as e:
            print(f"Failed to save briefing to DB: {e}")

        if self.broadcast_callback:
            await self.broadcast_callback({
                "type": "briefing",
                "content": briefing_text,
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            })
            print("📋 [AGENT BRIEFING]: Broadcasted autonomous safety briefing")

        return briefing_text
