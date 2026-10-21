"""
Cross-Zone Flow & Operational Resource Test Suite.
Verifies Phase 2 Features F13, F15, F16:
- Topological spatial spillover propagation
- Evacuation route pathfinding
- Dynamic SOP generator (Life Safety standards)
- Steward resource deployment optimization
"""

import sys
import unittest
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.flow_engine import CrossZoneFlowEngine
from backend.sop_engine import SOPEngine
from backend.resource_engine import ResourceOptimizationEngine


class TestCrossZoneFlowAndOperations(unittest.TestCase):

    def setUp(self):
        self.flow_engine = CrossZoneFlowEngine()
        self.sop_engine = SOPEngine()
        self.resource_engine = ResourceOptimizationEngine()

    def test_spillover_prediction_from_critical_gate_a(self):
        """Verifies spillover prediction when Gate A is Critical."""
        mock_state = [
            {
                "zone_id": "gate_a",
                "zone_name": "Main Gate A",
                "density": 2.0,
                "trend_slope": 0.10,
                "state": "Critical",
                "floor_area_sqm": 6.0
            },
            {
                "zone_id": "corridor_b",
                "zone_name": "Connecting Corridor B",
                "density": 0.5,
                "trend_slope": 0.0,
                "state": "Safe",
                "floor_area_sqm": 8.0
            },
            {
                "zone_id": "exit_c",
                "zone_name": "Emergency Exit C",
                "density": 0.2,
                "trend_slope": 0.0,
                "state": "Safe",
                "floor_area_sqm": 6.0
            },
            {
                "zone_id": "counter_d",
                "zone_name": "Ticket Counter D",
                "density": 0.3,
                "trend_slope": 0.0,
                "state": "Safe",
                "floor_area_sqm": 6.0
            },
            {
                "zone_id": "ground_e",
                "zone_name": "Open Ground Plaza E",
                "density": 0.2,
                "trend_slope": 0.0,
                "state": "Safe",
                "floor_area_sqm": 20.0
            }
        ]

        predictions = self.flow_engine.predict_spillovers(mock_state)
        self.assertGreaterEqual(len(predictions), 1)

        # Check Gate A -> Corridor B connection
        p_corridor = next((p for p in predictions if p["target_id"] == "corridor_b"), None)
        self.assertIsNotNone(p_corridor)
        self.assertEqual(p_corridor["source_id"], "gate_a")
        self.assertEqual(p_corridor["eta_seconds"], 45)
        self.assertGreater(p_corridor["target_projected_density"], p_corridor["target_current_density"])
        self.assertIn("Deploy 2-3 crowd stewards", p_corridor["tactical_directive"])

    def test_evacuation_routing(self):
        """Verifies multi-step safe routing to Emergency Exit C."""
        route = self.flow_engine.get_evacuation_routes("gate_a")
        self.assertEqual(len(route), 3)
        self.assertEqual(route[0]["zone"], "gate_a")
        self.assertEqual(route[-1]["zone"], "exit_c")

    def test_dynamic_sop_generation(self):
        """Verifies Life Safety Code SOP phases for Critical state."""
        sop = self.sop_engine.get_sop_for_state("gate_a", "Main Gate A", "Critical", "surge")
        self.assertEqual(sop["severity"], "Critical")
        self.assertIn("CODE RED", sop["title"])
        self.assertEqual(len(sop["operational_phases"]), 3)
        self.assertIn("TEN-33", sop["radio_dispatch_code"])

    def test_steward_resource_optimization(self):
        """Verifies steward allocation prioritizes high-risk zones."""
        mock_zones = [
            {"zone_id": "gate_a", "zone_name": "Gate A", "priority_weight": 2.0, "risk_score": 0.95, "state": "Critical"},
            {"zone_id": "corridor_b", "zone_name": "Corridor B", "priority_weight": 1.75, "risk_score": 0.40, "state": "Watch"},
            {"zone_id": "exit_c", "zone_name": "Exit C", "priority_weight": 2.0, "risk_score": 0.10, "state": "Safe"},
            {"zone_id": "counter_d", "zone_name": "Counter D", "priority_weight": 1.5, "risk_score": 0.10, "state": "Safe"},
            {"zone_id": "ground_e", "zone_name": "Ground E", "priority_weight": 1.0, "risk_score": 0.10, "state": "Safe"},
        ]
        result = self.resource_engine.optimize_allocation(mock_zones, total_pool=12)
        allocations = {a["zone_id"]: a for a in result["allocations"]}

        # Gate A must receive the highest allocation
        self.assertGreaterEqual(allocations["gate_a"]["assigned_stewards"], 4)
        self.assertEqual(allocations["gate_a"]["urgency"], "URGENT_DEPLOY")
        self.assertEqual(result["allocated_stewards"], 12)


if __name__ == "__main__":
    unittest.main()
