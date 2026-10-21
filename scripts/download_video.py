"""
Crowd Video Downloader Utility.

Allows you to download any YouTube, Pexels, or direct video URL for the AI Crowd Safety System demo,
or download one of our curated high-angle crowd surveillance presets.

Usage:
  # Option 1: Paste any online video link
  python scripts/download_video.py --url "https://www.youtube.com/watch?v=..."

  # Option 2: Choose a preset
  python scripts/download_video.py --preset 1   # Shibuya overhead scramble crossing
  python scripts/download_video.py --preset 2   # Oxford TownCentre concourse sample
"""

import argparse
import sys
import subprocess
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

PRESETS = {
    "1": {
        "title": "Dense Pedestrian Scramble (Overhead High-Angle)",
        "url": "https://commons.wikimedia.org/wiki/File:Shibuya_Crossing,_Tokyo,_Japan_(video).webm",
        "output": DATA_DIR / "crowd_high_angle.webm"
    },
    "2": {
        "title": "Benchmark Pedestrian Dataset (Town Concourse)",
        "url": "https://raw.githubusercontent.com/intel-iot-devkit/sample-videos/master/person-bicycle-car-detection.mp4",
        "output": DATA_DIR / "crowd_sample.mp4"
    }
}


def download_with_ytdlp(url, output_path):
    print(f"\n[Downloader] Target URL: {url}")
    print(f"[Downloader] Saving to:   {output_path}")
    print("[Downloader] Downloading via yt-dlp...")

    cmd = [
        sys.executable, "-m", "yt_dlp",
        url,
        "-o", str(output_path),
        "-f", "best[height<=720]/best",
        "--force-overwrites",
        "--no-playlist"
    ]

    try:
        res = subprocess.run(cmd, check=True)
        if res.returncode == 0:
            print(f"\n[OK] Video successfully downloaded to: {output_path}")
            print(f"\nTo run the vision engine with this video:")
            print(f"python vision/run_vision.py --source \"{output_path}\" --no-display --fps 2\n")
            return True
    except subprocess.CalledProcessError as e:
        print(f"[FAIL] Download failed: {e}")
        return False
    except FileNotFoundError:
        print("[FAIL] yt-dlp is not installed. Run: pip install yt-dlp")
        return False


def main():
    parser = argparse.ArgumentParser(description="Download crowd surveillance videos for demonstration.")
    parser.add_argument("--url", type=str, help="Any YouTube, Pexels, or direct video URL")
    parser.add_argument("--preset", type=str, choices=["1", "2"], help="Download a curated preset video (1 or 2)")
    parser.add_argument("--output", type=str, default="data/demo_video.mp4", help="Destination file path")

    args = parser.parse_args()

    if args.preset:
        preset = PRESETS[args.preset]
        print(f"Loading preset {args.preset}: {preset['title']}")
        download_with_ytdlp(preset["url"], preset["output"])
    elif args.url:
        out_path = Path(args.output)
        if not out_path.is_absolute():
            out_path = Path(__file__).resolve().parent.parent / out_path
        download_with_ytdlp(args.url, out_path)
    else:
        print("=" * 60)
        print("  AI CROWD SAFETY SYSTEM — VIDEO DOWNLOAD UTILITY")
        print("=" * 60)
        print("\nHow to use:")
        print("1. Download ANY video from YouTube or Pexels:")
        print("   python scripts/download_video.py --url \"<YOUR_LINK>\"")
        print("\n2. Or download a built-in curated preset:")
        for k, v in PRESETS.items():
            print(f"   Preset {k}: {v['title']}")
            print(f"   Run: python scripts/download_video.py --preset {k}\n")


if __name__ == "__main__":
    main()
