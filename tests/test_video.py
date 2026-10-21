import cv2
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from vision.detector import CrowdDetector

video_path = "data/crowd_sample.mp4"
cap = cv2.VideoCapture(video_path)

if not cap.isOpened():
    print(f"[FAIL] Could not open {video_path}")
    sys.exit(1)

fps = cap.get(cv2.CAP_PROP_FPS)
count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
duration = count / max(fps, 1)

print(f"[OK] Video file: {video_path}")
print(f"     Resolution: {w}x{h}")
print(f"     Framerate:  {fps:.1f} FPS")
print(f"     Frames:     {count} ({duration:.1f} seconds duration)")

det = CrowdDetector()

# Test detection on a few sample frames
for frame_idx in [10, 30, 60]:
    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
    ret, frame = cap.read()
    if ret:
        readings, annotated = det.process_frame(frame)
        active = [f"{r['zone_id']}={r['person_count']}" for r in readings if r['person_count'] > 0]
        print(f"Frame #{frame_idx:03d} -> Detected zones: {', '.join(active) if active else 'No people in polygon zones'}")

cap.release()
print("[OK] Video verification complete!")
