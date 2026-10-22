"""
Agentic AI Cognitive Loop & Autonomous Decision Test Suite.
Verifies:
- Cognitive cycle (Observe -> Analyze -> Predict -> Recommend)
- 5-part XAI Recommendation Contract
- Deterministic template fallback (zero-crash safety net)
- Stateful intervention outcome verification
- Tool-enabled grounded operator copilot
"""

import sys
import unittest
import asyncio
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.risk_engine import RiskEngine
from agent.reasoning import CognitiveEngine
from agent.template_fallback import generate_fallback_recommendation, generate_fallback_chat_response
from agent.chat_handler import GroundedChatHandler


class TestAgenticAI(unittest.IsolatedAsyncioTestCase):

    def setUp(self):
        self.risk_engine = RiskEngine()
        self.broadcast_events = []

        async def mock_broadcast(msg):
            self.broadcast_events.append(msg)

        self.engine = CognitiveEngine(self.risk_engine, mock_broadcast)
        self.chat = GroundedChatHandler(self.risk_engine)

    def test_deterministic_5_part_recommendation(self):
        """Verifies 5-part XAI structure on critical zone data."""
        zone_data = {
            "zone_id": "gate_a",
            "zone_name": "Main Gate A",
            "density": 1.5,
            "trend_slope": 0.08,
            "time_to_critical_s": 42.0,
            "behaviour_flag": "surge",
            "state": "Critical",
            "active_reports": 2
        }
        rec = generate_fallback_recommendation(zone_data)
        self.assertIn("observation", rec)
        self.assertIn("trend", rec)
        self.assertIn("prediction", rec)
        self.assertIn("recommendation", rec)
        self.assertIn("expected_benefit", rec)
        self.assertEqual(rec["severity"], "Critical")
        self.assertIn("Main Gate A", rec["observation"])

    async def test_cognitive_cycle_alert_dispatch(self):
        """Verifies that the agent automatically generates an advisory for Critical zones."""
        # Inject critical surge at Gate A (density 5.0 reaches Critical state with 1.25 priority weight)
        self.risk_engine.ingest("gate_a", 600, 5.0, "surge", "ok")
        self.risk_engine.ingest("gate_a", 600, 5.0, "surge", "ok")

        # Run cognitive cycle
        await self.engine.run_cycle(force=True, trigger="test")

        # Verify recommendation broadcasted
        rec_events = [e for e in self.broadcast_events if e.get("type") == "recommendation"]
        self.assertGreaterEqual(len(rec_events), 1)
        rec = rec_events[0]["recommendation"]
        self.assertEqual(rec["zone_id"], "gate_a")
        self.assertEqual(rec["severity"], "Critical")

    async def test_intervention_verification_loop(self):
        """Verifies that the agent tracks intervention and confirms density reduction."""
        # 1. Record operator approval at density 2.0
        self.engine.record_operator_approval(alert_id=999, zone_id="gate_a", current_density=2.0)
        self.assertIn("gate_a", self.engine.pending_interventions)

        # 2. Simulate density reduction after turnstiles held
        self.risk_engine.ingest("gate_a", 4, 0.66, "normal", "ok")
        self.risk_engine.ingest("gate_a", 4, 0.66, "normal", "ok")
        self.risk_engine.ingest("gate_a", 4, 0.66, "normal", "ok")

        # Fast forward time to trigger verification
        self.engine.pending_interventions["gate_a"]["approved_at"] = 0.0

        await self.engine.run_cycle(force=True)

        # Verify outcome event
        outcomes = [e for e in self.broadcast_events if e.get("type") == "intervention_outcome"]
        self.assertGreaterEqual(len(outcomes), 1)
        self.assertEqual(outcomes[0]["status"], "success")
        self.assertIn("Confirmed Effective", outcomes[0]["message"])

    async def test_grounded_operator_copilot_evacuation(self):
        """Verifies that asking for evacuation returns concrete step-by-step egress route."""
        reply = await self.chat.answer("What is the safe evacuation route for Gate A?")
        self.assertIn("Exit C", reply)
        self.assertIn("Step 1", reply)

    async def test_grounded_operator_copilot_stewards(self):
        """Verifies that asking for steward deployment returns allocation breakdown."""
        reply = await self.chat.answer("How should we deploy our 12 stewards?")
        self.assertIn("Steward Allocation", reply)
        self.assertIn("Stewards", reply)


if __name__ == "__main__":
    unittest.main()
