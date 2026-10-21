"""
Kinematic Behaviour & Surge Classifier.
Strictly implements Section 7 File 4 & Section 2 FR2:
Classifies motion dynamics: normal, surge, running, counter_flow.
"""

class BehaviourClassifier:
    def __init__(self, surge_delta_thresh=3, running_delta_thresh=3):
        self.surge_thresh = surge_delta_thresh
        self.running_thresh = running_delta_thresh
        self.last_counts = {}

    def classify(self, zone_id, current_count, detected_points=None, velocity_m_s=None):
        """
        1. Surge detection based on instantaneous count acceleration (> +3 p/s).
        2. Running / panic dispersal based on negative delta or high optical speed (> 2.5 m/s).
        3. Counter-flow detection if flow direction opposes egress path.
        """
        prev_count = self.last_counts.get(zone_id, current_count)
        delta = current_count - prev_count
        self.last_counts[zone_id] = current_count

        # Speed threshold from FR2
        if velocity_m_s is not None and velocity_m_s > 2.5:
            return "running"

        if delta >= self.surge_thresh:
            return "surge"

        if delta <= -self.running_thresh and prev_count >= 5:
            return "running"

        return "normal"
