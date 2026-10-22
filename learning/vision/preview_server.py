"""Loopback-only learning preview. Run the detector separately to watch real progress."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parent


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / "preview"), **kwargs)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/status":
            status = ROOT / "media/detection/status.json"
            data = status.read_bytes() if status.exists() else json.dumps({
                "stage": "setup", "message": "Valmistellaan paikallista Python-ympäristöä. Tunnistuksia ei ole vielä tehty.", "frames": []
            }).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)
            return
        if path == "/clip.mp4":
            self.path = path
            return super().do_GET()
        return super().do_GET()

    def translate_path(self, path):
        clean = path.split("?", 1)[0]
        if clean == "/clip.mp4":
            return str(ROOT / "media/clips/honka-veto-10m00s-30s.mp4")
        if clean in {f"/results/frame-{s}.jpg" for s in (0, 5, 10)} or re.fullmatch(r"/results/shirt-(0|5|10)-[0-9]+\.jpg", clean):
            return str(ROOT / "media/detection" / Path(clean).name)
        return super().translate_path(path)


if __name__ == "__main__":
    print("KorisLab vision lesson: http://127.0.0.1:5191", flush=True)
    ThreadingHTTPServer(("127.0.0.1", 5191), Handler).serve_forever()
