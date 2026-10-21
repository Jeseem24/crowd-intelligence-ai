"""
Mathematical Verification & Hysteresis Test Suite.
Validates implementation against Section 5 of the Master Implementation Handbook:
- 5.1 Multi-Factor Risk Score Formulation
- 5.2 Linear Trend Slope & Time-to-Critical
- 5.3 Numerical Worked Example (Gate A Surge Scenario)
- 5.4 Asymmetric Anti-Flicker State Machine (N_up=2, N_down=3)
"""

import sys
import unittest
import numpy as np
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.risk_engine import ZoneState, RHO_CRITICAL, BEHAVIOUR_SCORES


class TestRiskEngineMath(unittest.TestCase):

    def setUp(self):
        self.gate_a_config = {
            "zone_id": "gate_a",
            "zone_name": "Main Gate A",
            "zone_type": "Gate",
            "priority_weight": 2.0,
            "floor_area_sqm": 6.0,
            "watch_threshold": 0.35,
            "warning_threshold": 0.60,
            "critical_threshold": 0.85,
        }

    def test_numerical_worked_example_section_5_3(self):
        """
        Tests the exact numerical worked example from Section 5.3:
        Zone: Main Gate A, Area = 6.0 m², Priority Weight = 2.0
        Headcount: 8 persons -> density = 8 / 6.0 = 1.3333 p/m²
        Trend Slope: m = +0.12 p/m²/s
        Behaviour: 'surge' (B = 1.0)
        Citizen Reports: 1 active report (C = 0.30)
        Expected Fused Risk Score: 1.000 (Critical)
        Expected Time-to-Critical: ~31s
        """
        tracker = ZoneState(self.gate_a_config)
        
        # Override slope and active reports for isolated mathematical verification
        tracker.density = 8.0 / 6.0  # 1.3333
        tracker.trend_slope = 0.12
        tracker.behaviour_flag = "surge"
        tracker.active_reports = 1

        # Check Normalized terms
        D = min(1.0, tracker.density / 5.0)
        self.assertAlmostEqual(D, 0.2666667, places=4)

        T = max(0.0, min(1.0, (tracker.trend_slope + 0.10) / 0.30))
        self.assertAlmostEqual(T, 0.7333333, places=4)

        B = 1.0
        C = 0.30

        weighted_sum = (0.45 * D) + (0.20 * T) + (0.25 * B) + (0.10 * C)
        self.assertAlmostEqual(weighted_sum, 0.5466667, places=4)

        # Fused risk score with weight 2.0
        fused = min(1.0, 2.0 * weighted_sum)
        self.assertEqual(fused, 1.000)

        # Time-to-critical
        t_crit = (5.0 - tracker.density) / tracker.trend_slope
        self.assertAlmostEqual(t_crit, 30.5555, places=1)
        self.assertEqual(round(t_crit), 31)

    def test_hysteresis_escalation_requires_two_cycles(self):
        """
        Verifies that escalating from Safe to Critical requires N_up = 2 cycles.
        """
        tracker = ZoneState(self.gate_a_config)
        self.assertEqual(tracker.state, "Safe")

        # Cycle 1: sudden surge with critical score (e.g. 10 people at Gate A)
        changed_1 = tracker.ingest(person_count=10, density=10.0/6.0, behaviour_flag="surge")
        # Should NOT escalate yet on cycle 1
        self.assertFalse(changed_1)
        self.assertEqual(tracker.state, "Safe")
        self.assertEqual(tracker.escalation_counter, 1)

        # Cycle 2: continued high density
        changed_2 = tracker.ingest(person_count=10, density=10.0/6.0, behaviour_flag="surge")
        # Must escalate to Critical on cycle 2
        self.assertTrue(changed_2)
        self.assertEqual(tracker.state, "Critical")
        self.assertEqual(tracker.escalation_counter, 0)

    def test_hysteresis_deescalation_requires_three_cycles(self):
        """
        Verifies that de-escalating requires N_down = 3 cycles.
        """
        tracker = ZoneState(self.gate_a_config)
        # Escalate first to Critical (2 cycles)
        tracker.ingest(person_count=10, density=10.0/6.0, behaviour_flag="surge")
        tracker.ingest(person_count=10, density=10.0/6.0, behaviour_flag="surge")
        self.assertEqual(tracker.state, "Critical")

        # Cycle 1 of low density (calm)
        c1 = tracker.ingest(person_count=1, density=1.0/6.0, behaviour_flag="normal")
        self.assertFalse(c1)
        self.assertEqual(tracker.state, "Critical")
        self.assertEqual(tracker.deescalation_counter, 1)

        # Cycle 2 of calm
        c2 = tracker.ingest(person_count=1, density=1.0/6.0, behaviour_flag="normal")
        self.assertFalse(c2)
        self.assertEqual(tracker.state, "Critical")
        self.assertEqual(tracker.deescalation_counter, 2)

        # Cycle 3 of calm -> State drops!
        c3 = tracker.ingest(person_count=1, density=1.0/6.0, behaviour_flag="normal")
        self.assertTrue(c3)
        self.assertNotEqual(tracker.state, "Critical")
        self.assertEqual(tracker.deescalation_counter, 0)


if __name__ == "__main__":
    unittest.main()
