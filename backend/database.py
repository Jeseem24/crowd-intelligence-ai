"""
Database Layer — SQLite initialization and helper functions.
Creates all core tables and provides shared data access utilities.
Enforces WAL mode, foreign keys, and indexes matching Handbook Section 4.D.
"""

import sqlite3
import json
import os
import sys
import time
from pathlib import Path

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

DB_PATH = Path(__file__).parent.parent / "crowd_safety.db"
CONFIG_PATH = Path(__file__).parent.parent / "config" / "zones.json"


def get_db():
    """Get a database connection with row factory enabled."""
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """Initialize all database tables and seed zone data."""
    conn = get_db()
    cursor = conn.cursor()

    # --- Core Tables (Phase 1) ---
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS zones (
            zone_id TEXT PRIMARY KEY,
            zone_name TEXT NOT NULL,
            zone_type TEXT NOT NULL,
            priority_weight REAL NOT NULL DEFAULT 1.0,
            floor_area_sqm REAL NOT NULL,
            watch_threshold REAL NOT NULL DEFAULT 0.35,
            warning_threshold REAL NOT NULL DEFAULT 0.60,
            critical_threshold REAL NOT NULL DEFAULT 0.85
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS risk_logs (
            log_id INTEGER PRIMARY KEY AUTOINCREMENT,
            zone_id TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            person_count INTEGER NOT NULL,
            density REAL NOT NULL,
            behaviour_flag TEXT NOT NULL DEFAULT 'normal',
            risk_score REAL NOT NULL DEFAULT 0.0,
            state TEXT NOT NULL DEFAULT 'Safe',
            trend_slope REAL NOT NULL DEFAULT 0.0,
            time_to_critical_s REAL,
            FOREIGN KEY (zone_id) REFERENCES zones(zone_id)
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_risk_logs_zone_ts ON risk_logs(zone_id, timestamp)")

    # Dynamic migration check if risk_logs was created without trend_slope or time_to_critical_s
    cursor.execute("PRAGMA table_info(risk_logs)")
    existing_cols = [row["name"] for row in cursor.fetchall()]
    if "trend_slope" not in existing_cols:
        cursor.execute("ALTER TABLE risk_logs ADD COLUMN trend_slope REAL NOT NULL DEFAULT 0.0")
    if "time_to_critical_s" not in existing_cols:
        cursor.execute("ALTER TABLE risk_logs ADD COLUMN time_to_critical_s REAL")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS alerts (
            alert_id INTEGER PRIMARY KEY AUTOINCREMENT,
            zone_id TEXT NOT NULL,
            triggered_at TEXT NOT NULL,
            level TEXT NOT NULL,
            recommendation TEXT,
            observation TEXT,
            trend TEXT,
            prediction TEXT,
            expected_benefit TEXT,
            operator_action TEXT DEFAULT 'pending',
            source TEXT DEFAULT 'template',
            resolved_at TEXT,
            FOREIGN KEY (zone_id) REFERENCES zones(zone_id)
        )
    """)

    # Dynamic migration for alerts table
    cursor.execute("PRAGMA table_info(alerts)")
    existing_alert_cols = [row["name"] for row in cursor.fetchall()]
    if "resolved_at" not in existing_alert_cols:
        cursor.execute("ALTER TABLE alerts ADD COLUMN resolved_at TEXT")
    if "operator_action" not in existing_alert_cols:
        cursor.execute("ALTER TABLE alerts ADD COLUMN operator_action TEXT DEFAULT 'pending'")
    if "observation" not in existing_alert_cols:
        cursor.execute("ALTER TABLE alerts ADD COLUMN observation TEXT")
    if "trend" not in existing_alert_cols:
        cursor.execute("ALTER TABLE alerts ADD COLUMN trend TEXT")
    if "prediction" not in existing_alert_cols:
        cursor.execute("ALTER TABLE alerts ADD COLUMN prediction TEXT")
    if "expected_benefit" not in existing_alert_cols:
        cursor.execute("ALTER TABLE alerts ADD COLUMN expected_benefit TEXT")
    if "source" not in existing_alert_cols:
        cursor.execute("ALTER TABLE alerts ADD COLUMN source TEXT DEFAULT 'template'")

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts(zone_id, resolved_at)")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS briefings (
            briefing_id INTEGER PRIMARY KEY AUTOINCREMENT,
            generated_at TEXT NOT NULL,
            trigger_type TEXT NOT NULL DEFAULT 'scheduled',
            content TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_logs (
            chat_id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            sender TEXT NOT NULL,
            message TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS citizen_reports (
            report_id INTEGER PRIMARY KEY AUTOINCREMENT,
            zone_id TEXT NOT NULL,
            submitted_at TEXT NOT NULL,
            message TEXT,
            processed INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (zone_id) REFERENCES zones(zone_id)
        )
    """)

    # Seed zones from config
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH, "r") as f:
            config = json.load(f)

        for zone in config.get("zones", []):
            cursor.execute("""
                INSERT OR REPLACE INTO zones
                (zone_id, zone_name, zone_type, priority_weight, floor_area_sqm,
                 watch_threshold, warning_threshold, critical_threshold)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                zone["zone_id"], zone["zone_name"], zone["zone_type"],
                zone["priority_weight"], zone["floor_area_sqm"],
                zone["watch_threshold"], zone["warning_threshold"],
                zone["critical_threshold"]
            ))

    conn.commit()
    conn.close()
    print(f"[OK] Database initialized at {DB_PATH}")


def get_zones():
    """Return all zone configurations as a list of dicts."""
    conn = get_db()
    rows = conn.execute("SELECT * FROM zones").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_zone(zone_id):
    """Return a single zone configuration."""
    conn = get_db()
    row = conn.execute("SELECT * FROM zones WHERE zone_id = ?", (zone_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def log_risk(zone_id, timestamp, person_count, density, behaviour_flag, risk_score, state,
             trend_slope=0.0, time_to_critical_s=None):
    """Log a risk reading to the database."""
    conn = get_db()
    conn.execute("""
        INSERT INTO risk_logs (zone_id, timestamp, person_count, density, behaviour_flag, risk_score, state, trend_slope, time_to_critical_s)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (zone_id, timestamp, person_count, density, behaviour_flag, risk_score, state, trend_slope, time_to_critical_s))
    conn.commit()
    conn.close()


def save_alert(zone_id, level, recommendation="", observation="", trend="",
               prediction="", expected_benefit="", source="template"):
    """Save an alert/recommendation to the database. Returns alert_id."""
    conn = get_db()
    cursor = conn.execute("""
        INSERT INTO alerts (zone_id, triggered_at, level, recommendation, observation,
                           trend, prediction, expected_benefit, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (zone_id, time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
          level, recommendation, observation, trend, prediction, expected_benefit, source))
    alert_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return alert_id


def update_alert_action(alert_id, action):
    """Update operator action on an alert (approved/rejected/edited)."""
    conn = get_db()
    resolved_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    conn.execute("UPDATE alerts SET operator_action = ?, resolved_at = ? WHERE alert_id = ?",
                 (action, resolved_at, alert_id))
    conn.commit()
    conn.close()


def get_alerts(limit=20):
    """Retrieve recent alerts."""
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM alerts ORDER BY alert_id DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def save_briefing(content, trigger_type="scheduled"):
    """Save a safety briefing."""
    conn = get_db()
    conn.execute("""
        INSERT INTO briefings (generated_at, trigger_type, content)
        VALUES (?, ?, ?)
    """, (time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), trigger_type, content))
    conn.commit()
    conn.close()


def get_briefings(limit=10):
    """Retrieve recent briefings."""
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM briefings ORDER BY briefing_id DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def save_chat(sender, message):
    """Save a chat message."""
    conn = get_db()
    conn.execute("""
        INSERT INTO chat_logs (timestamp, sender, message)
        VALUES (?, ?, ?)
    """, (time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), sender, message))
    conn.commit()
    conn.close()


def get_chat(limit=50):
    """Retrieve chat history."""
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM chat_logs ORDER BY chat_id DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in reversed(rows)]


def save_citizen_report(zone_id, message=""):
    """Save a citizen report."""
    conn = get_db()
    conn.execute("""
        INSERT INTO citizen_reports (zone_id, submitted_at, message)
        VALUES (?, ?, ?)
    """, (zone_id, time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), message))
    conn.commit()
    conn.close()


def get_active_reports(zone_id, window_seconds=120):
    """Count active citizen reports for a zone within the recent time window."""
    conn = get_db()
    cutoff = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - window_seconds))
    row = conn.execute("""
        SELECT COUNT(*) as cnt FROM citizen_reports
        WHERE zone_id = ? AND submitted_at >= ?
    """, (zone_id, cutoff)).fetchone()
    conn.close()
    return row["cnt"] if row else 0


if __name__ == "__main__":
    init_db()
