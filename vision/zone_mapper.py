"""
Zone Polygon Mapper — OpenCV Point-in-Polygon Allocation.
Strictly implements Section 7 File 2:
Maps detected foot-contact points (x_center, y_bottom) into geometric zones.
"""

import cv2
import json
import numpy as np
from pathlib import Path


class ZoneMapper:
    def __init__(self, config_path=None):
        if config_path is None:
            config_path = Path(__file__).resolve().parent.parent / "config" / "zones.json"
        
        self.config_path = Path(config_path)
        with open(self.config_path, "r") as f:
            data = json.load(f)
        self.zones = data.get("zones", [])

    def assign_points_to_zones(self, points):
        """
        Assigns each detected point to a zone polygon using cv2.pointPolygonTest.
        Returns a dict mapping zone_id to headcount and points in zone.
        """
        counts = {z["zone_id"]: 0 for z in self.zones}
        for pt in points:
            for zone in self.zones:
                coords = zone.get("polygon") or zone.get("polygon_coords") or []
                if not coords:
                    continue
                poly = np.array(coords, dtype=np.int32)
                # cv2.pointPolygonTest returns >= 0 if inside or on edge
                if cv2.pointPolygonTest(poly, (float(pt[0]), float(pt[1])), False) >= 0:
                    counts[zone["zone_id"]] += 1
                    break
        return counts

    def get_zone_area(self, zone_id):
        for z in self.zones:
            if z["zone_id"] == zone_id:
                return float(z.get("floor_area_sqm", 10.0))
        return 10.0

    def get_zone_name(self, zone_id):
        for z in self.zones:
            if z["zone_id"] == zone_id:
                return z.get("zone_name", zone_id)
        return zone_id
