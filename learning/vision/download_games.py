"""Download the two supplied public videos into the local originals folder."""
from pathlib import Path

import imageio_ffmpeg
import yt_dlp


def main():
    destination = Path(__file__).resolve().parent / "media" / "originals"
    destination.mkdir(parents=True, exist_ok=True)
    options = {
        "paths": {"home": str(destination)},
        "outtmpl": "%(id)s.%(ext)s",
        "noplaylist": True,
        "overwrites": False,
        "writeinfojson": True,
        "noprogress": True,
        "format": "bestvideo+bestaudio/best",
        "merge_output_format": "mkv",
        "ffmpeg_location": imageio_ffmpeg.get_ffmpeg_exe(),
        "js_runtimes": {"node": {"path": "/Users/petu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"}},
    }
    with yt_dlp.YoutubeDL(options) as downloader:
        downloader.download([
            "https://www.youtube.com/watch?v=qFkzvLoQO40",
            "https://www.youtube.com/watch?v=6FjDbtSGiGg",
        ])


if __name__ == "__main__":
    main()
