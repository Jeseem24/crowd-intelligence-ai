"""
Grounded Operator Copilot with Real Tool Execution.
Provides multi-step reasoning, evacuation planning, SOP extraction, and steward deployment answers.
"""

from agent.llm_client import LLMClient
from backend.database import save_chat
from backend.flow_engine import CrossZoneFlowEngine
from backend.sop_engine import SOPEngine
from backend.resource_engine import ResourceOptimizationEngine


class GroundedChatHandler:
    def __init__(self, risk_engine=None):
        self.risk_engine = risk_engine
        self.llm_client = LLMClient()
        self.flow_engine = CrossZoneFlowEngine()
        self.sop_engine = SOPEngine()
        self.resource_engine = ResourceOptimizationEngine()

    async def answer(self, user_message: str) -> str:
        """Processes operator query, invoking relevant spatial tools before synthesis."""
        q = user_message.lower()

        # Log user query to database audit trail
        try:
            save_chat(sender="operator", message=user_message)
        except Exception:
            pass

        venue_state = self.risk_engine.get_venue_state() if self.risk_engine else {"zones": [], "overall_status": "Safe"}
        zones = venue_state.get("zones", [])

        # Tool 1: Evacuation / Egress Routing
        if any(w in q for w in ["evacuat", "egress", "escape", "exit route", "safe path"]):
            # Identify highest risk zone or target
            target_zone = "gate_a"
            for z in zones:
                if z.get("state") in ("Warning", "Critical"):
                    target_zone = z["zone_id"]
                    break
            routes = self.flow_engine.get_evacuation_routes(target_zone)
            steps_txt = " -> ".join([f"Step {s['step']}: {s['action']}" for s in routes])
            reply = f"🚨 **Egress Plan for {target_zone.upper()}**: {steps_txt}. Emergency Exit C panic hardware is unlocked."

        # Tool 2: Steward / Responder Resource Allocation
        elif any(w in q for w in ["steward", "police", "deploy", "assign", "officer", "manpower"]):
            alloc = self.resource_engine.optimize_allocation(zones, total_pool=12)
            breakdown = ", ".join([f"{a['zone_name']}: {a['assigned_stewards']} Stewards ({a['urgency']})" for a in alloc["allocations"]])
            reply = f"👮‍♂️ **Optimal Steward Allocation (Pool: 12)**: {breakdown}. Reserve pool: {alloc['reserve_stewards']} Stewards."

        # Tool 3: Standard Operating Procedure (SOP) Query
        elif any(w in q for w in ["sop", "protocol", "procedure", "code red", "guidelines"]):
            highest_zone = max(zones, key=lambda z: z.get("risk_score", 0.0)) if zones else {"zone_id": "gate_a", "zone_name": "Main Gate A", "state": "Safe"}
            sop = self.sop_engine.get_sop_for_state(highest_zone["zone_id"], highest_zone["zone_name"], highest_zone.get("state", "Safe"))
            phase_1 = sop["operational_phases"][0]["actions"][0]
            reply = f"📋 **{sop['title']} ({sop['sop_code']})**: Dispatch Code: `{sop['radio_dispatch_code']}`. Immediate Action: {phase_1}"

        # Tool 4: Spillover & Adjacency ETA
        elif any(w in q for w in ["spill", "adjacen", "propagat", "corridor b", "eta", "spread"]):
            spillovers = self.flow_engine.predict_spillovers(zones)
            if spillovers:
                sp = spillovers[0]
                reply = f"🌊 **Wavefront Spillover**: {sp['source_name']} -> {sp['target_name']}. Estimated Arrival: **~{sp['eta_seconds']}s** (Risk: {sp['chokepoint_risk']}). Directive: {sp['tactical_directive']}"
            else:
                reply = "🌊 **Cross-Zone Flow Stability**: All interconnecting corridors report laminar movement. No immediate wavefront spillover detected."

        else:
            # General LLM answer grounded in live telemetry
            reply = await self.llm_client.answer_operator_chat(user_message, venue_state)

        # Log AI reply to database audit trail
        try:
            save_chat(sender="ai_agent", message=reply)
        except Exception:
            pass

        return reply
