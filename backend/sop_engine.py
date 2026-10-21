"""
Dynamic Standard Operating Procedure (SOP) Generator.
Implements Phase 2 Feature F16 & Section 2 Requirements:
Generates binding operational protocols adhering to Crowd Life Safety Engineering standards.
"""

from typing import Dict, Any, List


class SOPEngine:
    @staticmethod
    def get_sop_for_state(zone_id: str, zone_name: str, state: str, behaviour: str = "normal") -> Dict[str, Any]:
        """
        Returns structured Standard Operating Procedure directives for operators,
        police units, and on-ground stewards based on zone type and severity.
        """
        is_surge = behaviour == "surge"
        is_running = behaviour == "running"

        if state == "Critical":
            return {
                "sop_code": f"SOP-CRIT-{zone_id.upper()}-01",
                "severity": "Critical",
                "title": f"CODE RED: Chokepoint Crush Hazard at {zone_name}",
                "operational_phases": [
                    {
                        "phase": "1. Immediate Containment (T + 0s to 15s)",
                        "lead": "Gate / Turnstile Operator",
                        "actions": [
                            "Halt all automated incoming intake turnstiles immediately.",
                            "Do NOT lock turnstiles completely; switch to one-way slow egress ratchet.",
                            "Illuminate amber/red electronic signage: 'GATE CONGESTED - DIVERT TO SECONDARY GATE'."
                        ]
                    },
                    {
                        "phase": "2. Flow Diversion & Buffer Management (T + 15s to 60s)",
                        "lead": "Police Tactical & Head Steward",
                        "actions": [
                            "Deploy 4 roving stewards to form a human wedge 15 meters upstream.",
                            "Split arriving pedestrian column into bilateral diversion streams.",
                            "Broadcast calm, pre-recorded public address directive: 'Please keep moving forward, maintain personal space'."
                        ]
                    },
                    {
                        "phase": "3. Pressure Relief & Rapid Egress (T + 60s to 120s)",
                        "lead": "Command Operations Chief",
                        "actions": [
                            "Unlock panic exit doors 1 and 2 at adjacent perimeter.",
                            "Check for fallen individuals or localized pile-ups at the chokepoint mouth.",
                            "Record operator authorization timestamp in ICCC master incident log."
                        ]
                    }
                ],
                "radio_dispatch_code": "TEN-33 CROWD COMPRESSION EMERGENCY",
                "evacuation_priority": "IMMEDIATE"
            }

        elif state == "Warning":
            return {
                "sop_code": f"SOP-WARN-{zone_id.upper()}-02",
                "severity": "Warning",
                "title": f"CODE AMBER: Elevated Density Alert at {zone_name}",
                "operational_phases": [
                    {
                        "phase": "1. Intake Rate Throttling (T + 0s to 30s)",
                        "lead": "Turnstile Controller",
                        "actions": [
                            "Throttle intake processing rate by 35% (1 person per 3 seconds).",
                            "Announce expected wait time to queue attendees to prevent panic pushing."
                        ]
                    },
                    {
                        "phase": "2. Pre-positioning Resources (T + 30s to 90s)",
                        "lead": "Field Supervisor",
                        "actions": [
                            "Move 2 stewards from Ground E buffer to {zone_name} chokepoints.",
                            "Inspect barrier pins and interlocking ground tracks for physical stability."
                        ]
                    }
                ],
                "radio_dispatch_code": "TEN-12 ELEVATED TRAFFIC ADVISORY",
                "evacuation_priority": "PRECAUTIONARY"
            }

        elif state == "Watch":
            return {
                "sop_code": f"SOP-WATCH-{zone_id.upper()}-03",
                "severity": "Watch",
                "title": f"CODE YELLOW: Active Monitoring at {zone_name}",
                "operational_phases": [
                    {
                        "phase": "1. Surveillance Verification",
                        "lead": "ICCC CCTV Analyst",
                        "actions": [
                            "Switch PTZ camera focus to entry archway.",
                            "Verify if queue tail is obstructing transit corridor."
                        ]
                    }
                ],
                "radio_dispatch_code": "TEN-06 MONITORING",
                "evacuation_priority": "NONE"
            }

        else:
            return {
                "sop_code": f"SOP-NORM-{zone_id.upper()}-00",
                "severity": "Safe",
                "title": f"CODE GREEN: Nominal Laminar Flow at {zone_name}",
                "operational_phases": [
                    {
                        "phase": "Standard Operation",
                        "lead": "General Duty",
                        "actions": [
                            "Maintain standard free-flow ingress.",
                            "Periodic visual checks on illuminated exit signage."
                        ]
                    }
                ],
                "radio_dispatch_code": "TEN-02 ALL CLEAR",
                "evacuation_priority": "NONE"
            }
