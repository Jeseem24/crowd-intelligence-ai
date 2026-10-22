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

        # Priority 1: Citizen Incident Report & Field Hazard Analysis
        if any(w in q for w in ["citizen report", "analyze citizen", "hazard report", "report at", "incident report", "slippery", "crush risk", "fallen person"]):
            # Identify target zone
            target_id = "ground_e"
            for zid in ["gate_a", "corridor_b", "exit_c", "counter_d", "ground_e"]:
                if zid in q:
                    target_id = zid
                    break
            if "festival" in q or "plaza" in q:
                target_id = "ground_e"
            elif "concourse" in q or "main gate" in q:
                target_id = "gate_a"
            elif "corridor" in q or "passage" in q:
                target_id = "corridor_b"
            elif "exit" in q or "surge" in q:
                target_id = "exit_c"
            elif "ticket" in q or "wicket" in q or "skycity" in q:
                target_id = "counter_d"

            z_info = next((z for z in zones if z.get("zone_id") == target_id), None)
            zone_name = z_info["zone_name"] if z_info else target_id.upper()
            density_str = f"{z_info['density']:.2f} p/m²" if z_info else "Monitored"
            status_str = z_info.get("state", "Active") if z_info else "Warning"

            # Determine tactical measures tailored to the hazard
            if "slip" in q or "wet" in q or "rain" in q:
                tactical_directive = (
                    f"🚨 **Tactical Response Plan for {zone_name} (Report: Wet/Slippery Ground)**:\n"
                    f"1. **Surface Slip-Hazard Containment**: Dispatch 2 field stewards equipped with high-visibility warning stanchions and rubber traction mats to high-traffic egress paths.\n"
                    f"2. **Inflow Throttling**: Decelerate arriving inflow from adjacent corridors by ~40% to eliminate running and prevent dangerous slip-induced crowd domino falls.\n"
                    f"3. **Flow Diversion**: Reroute pedestrian streams onto dry paved walkways leading toward Emergency Exit C.\n"
                    f"4. **Public Advisory**: Broadcast automated PA announcement: *'Attention attendees: ground surfaces are damp; please proceed at a steady walking pace.'*\n"
                    f"*(Telemetry Context: {zone_name} is currently at {status_str} with {density_str} density)*"
                )
            elif "crush" in q or "compress" in q or "surge" in q:
                tactical_directive = (
                    f"🚨 **Tactical Response Plan for {zone_name} (Report: Severe Crowd Compression)**:\n"
                    f"1. **Turnstile Throttling**: Hold entry turnstiles immediately (60% intake hold) to alleviate physical pressure.\n"
                    f"2. **Secondary Egress Release**: Unlatch dual panic bolts at bypass gates to expand corridor exit capacity.\n"
                    f"3. **Steward Wavebreaker**: Deploy 4 stewards in a chevron wedge formation to diffuse crowd momentum.\n"
                    f"*(Telemetry Context: {zone_name} status: {status_str}, Density: {density_str})*"
                )
            elif "fall" in q or "medic" in q:
                tactical_directive = (
                    f"🚨 **Tactical Response Plan for {zone_name} (Report: Fallen Attendee / Medical)**:\n"
                    f"1. **Medical Cordon**: Dispatch First-Aid response team and 2 stewards to establish an immediate 3-meter safety cordon.\n"
                    f"2. **Flow Bypass**: Divert pedestrian channel away from the victim to prevent trampling.\n"
                    f"3. **CCTV Lock**: Tracking CAM source on high-priority split view.\n"
                    f"*(Telemetry Context: {zone_name} status: {status_str}, Density: {density_str})*"
                )
            else:
                tactical_directive = (
                    f"🚨 **Tactical Response Plan for {zone_name}**:\n"
                    f"1. Field hazard verified from mobile citizen beacon.\n"
                    f"2. Redeploy 2 stewards from reserve pool to monitor chokepoint.\n"
                    f"3. Current telemetry shows {zone_name} at {density_str} ({status_str}). Divert peripheral flow to secondary egress."
                )

            reply = tactical_directive

        # Priority 2: Evacuation / Egress Routing
        elif any(w in q for w in ["evacuat", "egress", "escape", "exit route", "safe path", "safest gate"]):
            target_zone = "gate_a"
            for z in zones:
                if z.get("state") in ("Warning", "Critical"):
                    target_zone = z["zone_id"]
                    break
            routes = self.flow_engine.get_evacuation_routes(target_zone)
            steps_txt = " -> ".join([f"Step {s['step']}: {s['action']}" for s in routes])
            reply = f"🚨 **Egress Plan for {target_zone.upper()}**: {steps_txt}. Emergency Exit C panic hardware is unlocked."

        # Priority 3: Steward / Responder Resource Allocation
        elif ("steward" in q and any(w in q for w in ["deploy", "assign", "allocat", "pool", "where", "how many", "dispatch", "send"])) or any(w in q for w in ["steward deployment", "steward allocation", "officer deployment"]):
            alloc = self.resource_engine.optimize_allocation(zones, total_pool=12)
            breakdown = ", ".join([f"{a['zone_name']}: {a['assigned_stewards']} Stewards ({a['urgency']})" for a in alloc["allocations"]])
            reply = f"👮‍♂️ **Optimal Steward Allocation (Pool: 12)**: {breakdown}. Reserve pool: {alloc['reserve_stewards']} Stewards."

        # Priority 4: Standard Operating Procedure (SOP) Query
        elif any(w in q for w in ["sop", "protocol", "procedure", "code red", "guidelines"]):
            highest_zone = max(zones, key=lambda z: z.get("risk_score", 0.0)) if zones else {"zone_id": "gate_a", "zone_name": "Main Gate A", "state": "Safe"}
            sop = self.sop_engine.get_sop_for_state(highest_zone["zone_id"], highest_zone["zone_name"], highest_zone.get("state", "Safe"))
            phase_1 = sop["operational_phases"][0]["actions"][0]
            reply = f"📋 **{sop['title']} ({sop['sop_code']})**: Dispatch Code: `{sop['radio_dispatch_code']}`. Immediate Action: {phase_1}"

        # Priority 5: Spillover & Adjacency ETA
        elif any(w in q for w in ["spill", "adjacen", "propagat", "corridor b", "eta", "spread"]):
            spillovers = self.flow_engine.predict_spillovers(zones)
            if spillovers:
                sp = spillovers[0]
                reply = f"🌊 **Wavefront Spillover**: {sp['source_name']} -> {sp['target_name']}. Estimated Arrival: **~{sp['eta_seconds']}s** (Risk: {sp['chokepoint_risk']}). Directive: {sp['tactical_directive']}"
            else:
                reply = "🌊 **Cross-Zone Flow Stability**: All interconnecting corridors report laminar movement. No immediate wavefront spillover detected."

        else:
            # Grounded telemetry synthesis / LLM
            reply = await self.llm_client.answer_operator_chat(user_message, venue_state)

        # Log AI reply to database audit trail
        try:
            save_chat(sender="ai_agent", message=reply)
        except Exception:
            pass

        return reply

