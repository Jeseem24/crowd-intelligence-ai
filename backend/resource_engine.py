"""
Dynamic Steward & Security Resource Deployment Optimization Engine.
Implements Phase 2 Feature F15:
Optimizes steward placement across zones based on priority-weighted risk deficits.
"""

from typing import List, Dict, Any
import math


class ResourceOptimizationEngine:
    def __init__(self, default_steward_pool=12):
        self.total_stewards = default_steward_pool

    def optimize_allocation(self, zones_state: List[Dict[str, Any]], total_pool: int = None) -> Dict[str, Any]:
        """
        Calculates optimal allocation of stewards and police units based on risk density.
        """
        pool = total_pool or self.total_stewards
        if not zones_state:
            return {"total_pool": pool, "allocations": []}

        # Calculate weighted risk for each zone: W_i = priority_weight * (risk_score + 0.1)
        weighted_risks = {}
        for z in zones_state:
            z_id = z["zone_id"]
            weight = float(z.get("priority_weight", 1.0))
            risk = float(z.get("risk_score", 0.0))
            # Minimum baseline weight ensures every zone has at least 1 steward
            weighted_risks[z_id] = weight * (risk + 0.15)

        total_weighted_sum = sum(weighted_risks.values())
        if total_weighted_sum <= 0:
            total_weighted_sum = 1.0

        allocations = []
        allocated_so_far = 0

        # Initial proportional allocation
        for z in zones_state:
            z_id = z["zone_id"]
            z_name = z.get("zone_name", z_id)
            state = z.get("state", "Safe")
            share = weighted_risks[z_id] / total_weighted_sum
            assigned = max(1, int(round(pool * share)))
            allocated_so_far += assigned

            # Roles based on severity
            if state == "Critical":
                post_instructions = "Deploy 2 stewards at intake turnstiles, 2 forming diversion wedge, 1 on PA megaphone"
                urgency = "URGENT_DEPLOY"
            elif state == "Warning":
                post_instructions = "Pre-position 2 stewards at chokepoint mouth, 1 monitoring queue tail"
                urgency = "ELEVATED"
            elif state == "Watch":
                post_instructions = "1 steward on visual observation, 1 roving buffer area"
                urgency = "ROUTINE"
            else:
                post_instructions = "Standard stationing; assist attendee wayfinding"
                urgency = "NORMAL"

            allocations.append({
                "zone_id": z_id,
                "zone_name": z_name,
                "state": state,
                "assigned_stewards": assigned,
                "urgency": urgency,
                "post_instructions": post_instructions
            })

        # Normalize total count to pool
        diff = pool - sum(a["assigned_stewards"] for a in allocations)
        if diff != 0 and allocations:
            # Add or remove from highest risk zone
            highest = max(allocations, key=lambda x: weighted_risks[x["zone_id"]])
            highest["assigned_stewards"] = max(1, highest["assigned_stewards"] + diff)

        return {
            "total_stewards_pool": pool,
            "allocated_stewards": sum(a["assigned_stewards"] for a in allocations),
            "reserve_stewards": max(0, pool - sum(a["assigned_stewards"] for a in allocations)),
            "allocations": allocations
        }
