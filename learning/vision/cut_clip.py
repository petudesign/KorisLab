"""Write a separate, frame-accurate test clip; never overwrite the source."""
import argparse
from pathlib import Path
import subprocess

import imageio_ffmpeg


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--start", type=float, required=True, help="Start in seconds")
    parser.add_argument("--duration", type=float, default=30, help="Length in seconds")
    args = parser.parse_args()
    source = args.source.resolve()
    output = args.output.resolve()
    if not source.is_file():
        parser.error("Source video does not exist")
    if source == output or output.exists():
        parser.error("Output must be a new file, different from the source")
    import math
    if not math.isfinite(args.start) or not math.isfinite(args.duration) or args.start < 0 or args.duration <= 0:
        parser.error("Start must be nonnegative and duration positive and finite")
    output.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([
        imageio_ffmpeg.get_ffmpeg_exe(), "-hide_banner", "-n",
        "-ss", str(args.start), "-i", str(source), "-t", str(args.duration),
        "-map", "0:v:0", "-map", "0:a:0?", "-c:v", "libx264",
        "-preset", "fast", "-crf", "18", "-c:a", "aac", "-b:a", "160k",
        "-movflags", "+faststart", str(output),
    ], check=True)
    print(f"Clip: {output}\nOriginal preserved: {source}")


if __name__ == "__main__":
    main()
