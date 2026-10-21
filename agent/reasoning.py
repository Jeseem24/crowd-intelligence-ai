"""
Agentic Reasoning Engine — 4-Phase Cognitive Cycle (Observe -> Analyze -> Predict -> Recommend).
Strictly implements Section 7 File 6 & Handbook Section 2 FR6/FR8:
Dispatches 5-part explainable recommendations with Human-in-the-Loop decision capture.
"""

import time
import asyncio
from agent.llm_client import LLMClient
from backend.database import save_alert, save_briefing


class CognitiveEngine:
    def __init__(self, risk_engine=None, broadcast_callback=None):
        self.risk_engine = risk_engine
        self.broadcast_callback = broadcast_callback
        self.llm_client = LLMClient()
        self.active_recommendations = {}
        self.last_alert_time = {}
        self.cooldown_seconds = 10  # Prevent spamming alerts for the same zone

    async def run_cycle(self, force=False, trigger="scheduled"):
        """Executes the full 4-stage cognitive loop."""
        if not self.risk_engine:
            return

        # Phase 1: OBSERVE
        venue_state = self.risk_engine.get_venue_state()
        zones = venue_state.get("zones", [])
        now = time.time()

        # Phase 2: ANALYZE & PREDICT
        for z in zones:
            z_id = z["zone_id"]
            state = z["state"]

            # We trigger decision support recommendations on Warning and Critical states
            if state in ("Warning", "Critical"):
                last_time = self.last_alert_time.get(z_id, 0)
                if force or (now - last_time >= self.cooldown_seconds):
                    self.last_alert_time[z_id] = now

                    # Phase 4: RECOMMEND
                    rec = await self.llm_client.generate_recommendation(z)
                    self.active_recommendations[z_id] = rec

                    # Persist alert to database with pending human approval
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

                    # Broadcast recommendation to live dashboard via WebSocket
                    if self.broadcast_callback:
                        await self.broadcast_callback({
                            "type": "recommendation",
                            "recommendation": rec,
                            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                        })
                        print(f"🤖 [AGENT ADVISORY]: Dispatched 5-part XAI Recommendation for {z['zone_name']} [{state}]")

    async def generate_briefing(self, trigger_type="scheduled"):
        """Generates and broadcasts venue safety briefing."""
        if not self.risk_engine:
            return None

        venue_state = self.risk_engine.get_venue_state()
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
            print(f"📋 [AGENT BRIEFING]: Broadcasted autonomous safety briefing")

        return briefing_text
