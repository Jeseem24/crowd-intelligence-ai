"""
Vision Engine Runner — Live Ingest Loop.

Streams video frames from webcam, pre-recorded video, or simulation mode,
processes person detection + zone mapping, and POSTs telemetry to FastAPI backend at 1 FPS.

Usage:
  python run_vision.py                  # Use default webcam (camera 0)
  python run_vision.py --source video.mp4 # Loop over a video file
  python run_vision.py --source simulate # Internal visual simulator mode
  python run_vision.py --no-display      # Headless mode (no OpenCV GUI)
"""

import argparse
import sys
import time
import random
import threading
from queue import Queue, Empty
from pathlib import Path
import cv2
import requests
import numpy as np

# Add parent directory to path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from vision.detector import CrowdDetector


def generate_simulated_frame(width=800, height=500, tick=0):
    """Generates a synthetic venue frame with dynamic simulated people."""
    frame = np.full((height, width, 3), 40, dtype=np.uint8)
    
    # Draw floor grid lines
    for x in range(0, width, 50):
        cv2.line(frame, (x, 0), (x, height), (50, 50, 60), 1)
    for y in range(0, height, 50):
        cv2.line(frame, (0, y), (width, y), (50, 50, 60), 1)

    # Simulate people moving in walkway
    num_gate_people = min(18, 4 + int((tick % 40) * 0.4))
    for i in range(num_gate_people):
        px = 120 + int(np.sin(tick * 0.2 + i) * 60) + (i % 5) * 25
        py = 70 + (i // 5) * 35 + int(np.cos(tick * 0.3 + i) * 20)
        px = np.clip(px, 110, 690)
        py = np.clip(py, 60, 440)
        # Draw head and body
        cv2.circle(frame, (px, py - 18), 7, (200, 180, 160), -1)
        cv2.rectangle(frame, (px - 6, py - 10), (px + 6, py + 12), (180, 100, 80), -1)

    return frame


def frame_uploader_worker(frame_queue: Queue, frame_url: str, stop_event: threading.Event):
    """Background worker that pushes frames to the backend without blocking the video loop."""
    session = requests.Session()
    while not stop_event.is_set():
        try:
            jpeg_bytes = frame_queue.get(timeout=0.05)
            session.post(
                frame_url,
                data=jpeg_bytes,
                headers={"Content-Type": "image/jpeg"},
                timeout=0.25
            )
            frame_queue.task_done()
        except Empty:
            continue
        except Exception:
            pass


class AsyncInferenceWorker:
    """
    Decoupled inference worker that runs YOLO asynchronously in the background.
    Main loop streams smooth 25 FPS video, while worker updates detections at ~10 Hz.
    """
    def __init__(self, detector):
        self.detector = detector
        self.frame_to_process = None
        self.lock = threading.Lock()
        self.stop_event = threading.Event()

        self.latest_readings = [
            {"zone_id": z["zone_id"], "timestamp": "", "person_count": 0, "density": 0.0, "behaviour_flag": "normal", "sensor_status": "ok"}
            for z in detector.zones
        ] if detector.zones else [
            {"zone_id": "gate_a", "timestamp": "", "person_count": 0, "density": 0.0, "behaviour_flag": "normal", "sensor_status": "ok"}
        ]
        self.latest_detections = []
        self.latest_person_count = 0
        self.latest_density = 0.0
        self.latest_behaviour = "normal"
        self.has_first_detection = threading.Event()

        self.thread = threading.Thread(target=self._worker_loop, daemon=True)
        self.thread.start()

    def update_frame(self, frame):
        with self.lock:
            self.frame_to_process = frame

    def _worker_loop(self):
        while not self.stop_event.is_set():
            frame = None
            with self.lock:
                if self.frame_to_process is not None:
                    frame = self.frame_to_process
                    self.frame_to_process = None

            if frame is None:
                time.sleep(0.005)
                continue

            try:
                readings, detections, count, density, behaviour = self.detector.process_inference_only(frame)
                with self.lock:
                    self.latest_readings = readings
                    self.latest_detections = detections
                    self.latest_person_count = count
                    self.latest_density = density
                    self.latest_behaviour = behaviour
                self.has_first_detection.set()
            except Exception:
                time.sleep(0.01)

    def get_state(self):
        with self.lock:
            return (
                self.latest_readings,
                self.latest_detections,
                self.latest_person_count,
                self.latest_density,
                self.latest_behaviour
            )

    def stop(self):
        self.stop_event.set()


def main():
    parser = argparse.ArgumentParser(description="AI Crowd Safety — Vision Engine Live Ingest")
    parser.add_argument("--source", type=str, default="data/crowd_demo.mp4",
                        help="Video source: '0' (webcam), path to .mp4, or 'simulate'")
    parser.add_argument("--backend", type=str, default="http://localhost:8000",
                        help="FastAPI backend URL")
    parser.add_argument("--fps", type=float, default=1.0,
                        help="Telemetry ingest frequency (default: 1.0 = 1 reading/sec)")
    parser.add_argument("--no-display", action="store_true",
                        help="Do not display OpenCV preview window")
    parser.add_argument("--conf", type=float, default=0.22,
                        help="YOLO detection confidence threshold")
    args = parser.parse_args()

    # Smart source fallback
    source_path = args.source
    if not source_path.isdigit() and source_path.lower() != "simulate":
        p = Path(source_path)
        if not p.exists():
            for alt in [Path("data/crowd_demo.mp4"), Path("data/dense_crowd.mp4")]:
                if alt.exists():
                    source_path = str(alt)
                    break

    ingest_url = f"{args.backend}/api/vision/ingest"
    frame_url = f"{args.backend}/api/vision/frame"

    print("=" * 60)
    print(" 👁️  AI CROWD SAFETY SYSTEM — VISION ENGINE (REAL-TIME)")
    print(f" Source:    {source_path}")
    print(f" Target:    {ingest_url}")
    print(f" Ingest:    ~{args.fps} reading/sec")
    print(" Mode:      Decoupled Multithreaded 25 FPS Native Speed")
    print("=" * 60)

    # Initialize Detector
    detector = CrowdDetector(conf_thresh=args.conf)

    is_simulation = source_path.lower() == "simulate"
    cap = None
    native_fps = 25.0

    if not is_simulation:
        src = int(source_path) if source_path.isdigit() else source_path
        cap = cv2.VideoCapture(src)
        if not cap.isOpened():
            print(f"[Vision] ⚠️ Could not open video source '{source_path}'. Falling back to simulated video.")
            is_simulation = True
        else:
            fps_val = cap.get(cv2.CAP_PROP_FPS)
            if fps_val and 5.0 <= fps_val <= 60.0:
                native_fps = float(fps_val)
            print(f"[Vision] Video source opened successfully. Native FPS: {native_fps:.1f}")

    target_frame_time = 1.0 / native_fps
    telemetry_interval = 1.0 / max(args.fps, 0.1)
    last_post_time = 0.0

    # Start non-blocking frame uploader thread (queue size 1 to prevent latency lag)
    frame_queue = Queue(maxsize=1)
    stop_event = threading.Event()
    uploader_thread = threading.Thread(
        target=frame_uploader_worker,
        args=(frame_queue, frame_url, stop_event),
        daemon=True
    )
    uploader_thread.start()

    # Start decoupled async inference worker
    inference_worker = AsyncInferenceWorker(detector)

    session = requests.Session()
    sim_tick = 0
    last_upload_time = 0.0

    try:
        while True:
            start_loop = time.time()

            if is_simulation:
                frame = generate_simulated_frame(800, 500, sim_tick)
                sim_tick += 1
            else:
                ret, frame = cap.read()
                if not ret:
                    # Loop video continuously
                    if isinstance(src, str):
                        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                        ret, frame = cap.read()
                    if not ret:
                        time.sleep(0.1)
                        continue

            # Pass latest frame to async neural worker
            inference_worker.update_frame(frame)

            # Retrieve latest detections and telemetry snapshot (<1ms)
            readings, detections, count, density, behaviour = inference_worker.get_state()

            # Render defense-grade tactical HUD on frame (<1ms)
            annotated = detector.render_tactical_hud(frame, detections, count, density, behaviour)

            now = time.time()

            # Stream annotated frame to web dashboard (~25 FPS real-time)
            if annotated is not None and (now - last_upload_time) >= 0.038:
                try:
                    ret_jpg, jpeg_buf = cv2.imencode('.jpg', annotated, [cv2.IMWRITE_JPEG_QUALITY, 72])
                    if ret_jpg:
                        if frame_queue.full():
                            try:
                                frame_queue.get_nowait()
                                frame_queue.task_done()
                            except Exception:
                                pass
                        frame_queue.put_nowait(jpeg_buf.tobytes())
                        last_upload_time = now
                except Exception:
                    pass

            # Post telemetry readings to backend at 1 Hz
            if now - last_post_time >= telemetry_interval:
                for reading in readings:
                    try:
                        session.post(ingest_url, json=reading, timeout=0.6)
                    except Exception:
                        pass
                last_post_time = now

                # Console readout
                gate_r = next((r for r in readings if r["zone_id"] == "gate_a"), readings[0])
                print(f"[Vision 25FPS] {time.strftime('%H:%M:%S')} | Gate A: {gate_r['person_count']}p ({gate_r['density']:.2f} p/m²) | Status: {gate_r['behaviour_flag']}")

            # Optional local preview window
            if not args.no_display and annotated is not None:
                cv2.imshow("AI Crowd Safety — Real-Time Vision Feed", annotated)
                key = cv2.waitKey(1) & 0xFF
                if key == ord('q') or key == 27:
                    break

            # Sleep exactly the delta needed to maintain 25 FPS real-time speed
            elapsed = time.time() - start_loop
            sleep_needed = max(0.001, target_frame_time - elapsed)
            time.sleep(sleep_needed)

    except KeyboardInterrupt:
        print("\n[Vision] Stopped by user.")
    finally:
        stop_event.set()
        inference_worker.stop()
        if cap is not None:
            cap.release()
        cv2.destroyAllWindows()
        print("[Vision] Cleaned up resources. Done.")


if __name__ == "__main__":
    main()
