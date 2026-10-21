"""
Vision Ingestion Pipeline.
Strictly implements Section 7 File 5 & Section 2 FR1/FR2:
Master Capture -> Detect (YOLOv8) -> Zone Allocation -> Kinematic Classification -> POST loop.
"""

import cv2
import time
import requests
import argparse
import sys
from pathlib import Path

# Add root path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from vision.detector import PersonDetector
from vision.zone_mapper import ZoneMapper
from vision.behaviour import BehaviourClassifier


def run_vision_pipeline(source=0, backend_url="http://localhost:8000/api/vision/ingest", display=False):
    print(f"🎥 Starting Vision Pipeline with video source: {source}...")
    detector = PersonDetector()
    mapper = ZoneMapper()
    classifier = BehaviourClassifier()

    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        print(f"⚠️ Warning: Unable to open video source {source}. Emitting sensor unavailable to backend.")
        try:
            requests.post(backend_url, json={"zone_id": "gate_a", "person_count": 0, "density": 0.0, "sensor_status": "unavailable"}, timeout=1.0)
        except Exception:
            pass
        return

    last_post = time.time()
    frame_count = 0

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                # Loop video if testing with pre-recorded clips
                if isinstance(source, str) and Path(source).exists():
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    continue
                else:
                    print("Stream dropped. Emitting sensor unavailable (Scenario S10)...")
                    try:
                        requests.post(backend_url, json={"zone_id": "gate_a", "person_count": 0, "density": 0.0, "sensor_status": "unavailable"}, timeout=1.0)
                    except Exception:
                        pass
                    break

            frame_count += 1

            # Ingest telemetry at ~1 Hz to conserve CPU and match mathematical window
            now = time.time()
            if now - last_post >= 1.0:
                points = detector.detect_bottom_centers(frame)
                counts = mapper.assign_points_to_zones(points)

                for zone_id, count in counts.items():
                    area = mapper.get_zone_area(zone_id)
                    density = round(count / area, 3)
                    flag = classifier.classify(zone_id, count, points)

                    payload = {
                        "zone_id": zone_id,
                        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        "person_count": count,
                        "density": density,
                        "behaviour_flag": flag,
                        "sensor_status": "ok"
                    }

                    try:
                        requests.post(backend_url, json=payload, timeout=0.8)
                    except Exception as e:
                        pass

                last_post = now

            if display:
                cv2.putText(frame, "AI CROWD SAFETY VISION PIPELINE [ACTIVE]", (20, 30),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 255, 0), 2)
                cv2.imshow("Crowd Intelligence Perception Engine", frame)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break

    except KeyboardInterrupt:
        print("Pipeline interrupted by operator.")
    finally:
        cap.release()
        if display:
            cv2.destroyAllWindows()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AI Crowd Safety Vision Pipeline")
    parser.add_argument("--source", default="0", help="Webcam index (0) or path to video file (.mp4)")
    parser.add_argument("--backend", default="http://localhost:8000/api/vision/ingest", help="Backend ingest URL")
    parser.add_argument("--display", action="store_true", help="Display OpenCV debug window")
    args = parser.parse_args()

    src = int(args.source) if args.source.isdigit() else args.source
    run_vision_pipeline(source=src, backend_url=args.backend, display=args.display)
