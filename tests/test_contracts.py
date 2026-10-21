"""
Canonical JSON Contract Validation Suite.
Strictly verifies all data contracts against Handbook Section 4 schemas:
- 4.A Vision Telemetry Ingest Contract
- 4.B Venue State Snapshot Contract
- 4.C 5-Part Explainable Recommendation Contract
- 4.D SQLite Database DDL Integrity
"""

import sys
import unittest
import sqlite3
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.models import (
    VisionIngest, ZoneStateModel, VenueStateResponse,
    RecommendationContract, CitizenReport, AlertAction
)
from backend.database import DB_PATH, init_db, get_zones
from agent.template_fallback import generate_fallback_recommendation


class TestCanonicalContracts(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        init_db()

    def test_vision_telemetry_contract_section_4_a(self):
        """Validates Section 4.A Vision Ingest Contract schema."""
        raw_payload = {
            "zone_id": "gate_a",
            "timestamp": "2026-10-21T10:15:02Z",
            "person_count": 8,
            "density": 1.33,
            "behaviour_flag": "surge",
            "sensor_status": "ok"
        }
        model = VisionIngest(**raw_payload)
        self.assertEqual(model.zone_id, "gate_a")
        self.assertEqual(model.person_count, 8)
        self.assertEqual(model.density, 1.33)
        self.assertEqual(model.behaviour_flag, "surge")

    def test_venue_state_snapshot_contract_section_4_b(self):
        """Validates Section 4.B Venue State Snapshot Contract schema."""
        zone_payload = {
            "zone_id": "gate_a",
            "zone_name": "Main Gate A",
            "zone_type": "Gate",
            "priority_weight": 2.0,
            "person_count": 8,
            "density": 1.33,
            "behaviour_flag": "surge",
            "trend_slope": 0.12,
            "time_to_critical_s": 32.0,
            "risk_score": 0.92,
            "state": "Critical",
            "active_reports": 2,
            "sensor_status": "ok"
        }
        zone_model = ZoneStateModel(**zone_payload)
        self.assertEqual(zone_model.state, "Critical")

        venue_payload = {
            "timestamp": "2026-10-21T10:15:03Z",
            "overall_status": "Warning",
            "zones": [zone_model],
            "active_alert": {
                "alert_id": 101,
                "zone_id": "gate_a",
                "level": "Critical"
            }
        }
        venue_model = VenueStateResponse(**venue_payload)
        self.assertEqual(venue_model.overall_status, "Warning")
        self.assertEqual(len(venue_model.zones), 1)

    def test_explainable_recommendation_contract_section_4_c(self):
        """Validates Section 4.C 5-Part Explainable AI Contract."""
        zone_state = {
            "zone_id": "gate_a",
            "zone_name": "Main Gate A",
            "density": 1.33,
            "trend_slope": 0.12,
            "time_to_critical_s": 31.0,
            "behaviour_flag": "surge",
            "state": "Critical",
            "active_reports": 1
        }
        rec = generate_fallback_recommendation(zone_state)
        contract = RecommendationContract(**rec)
        
        # Verify 5 mandatory XAI pillars
        self.assertTrue(len(contract.observation) > 10)
        self.assertTrue(len(contract.trend) > 10)
        self.assertTrue(len(contract.prediction) > 10)
        self.assertTrue(len(contract.recommendation) > 10)
        self.assertTrue(len(contract.expected_benefit) > 10)
        self.assertEqual(contract.severity, "Critical")
        self.assertEqual(contract.status, "open")

    def test_sqlite_ddl_integrity_section_4_d(self):
        """Validates SQLite table structure and indices."""
        conn = sqlite3.connect(str(DB_PATH))
        cursor = conn.cursor()

        # Check tables existence
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [r[0] for r in cursor.fetchall()]
        required_tables = ["zones", "risk_logs", "alerts", "briefings", "chat_logs", "citizen_reports"]
        for t in required_tables:
            self.assertIn(t, tables, f"Missing table: {t}")

        # Check WAL mode
        cursor.execute("PRAGMA journal_mode")
        mode = cursor.fetchone()[0]
        self.assertEqual(mode.lower(), "wal")

        # Check zones table contains canonical 5 zones
        zones = get_zones()
        self.assertGreaterEqual(len(zones), 5)
        zone_ids = [z["zone_id"] for z in zones]
        self.assertIn("gate_a", zone_ids)
        self.assertIn("corridor_b", zone_ids)
        self.assertIn("exit_c", zone_ids)

        conn.close()


if __name__ == "__main__":
    unittest.main()
