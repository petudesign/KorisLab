"""First lesson: find people in three frames, without assigning player identities."""
import json
import os
from pathlib import Path
import subprocess
import time

ROOT = Path(__file__).resolve().parent
MEDIA = ROOT / "media"
OUTPUT = MEDIA / "detection"
EVENTS = []
os.environ.setdefault("HF_HOME", str(MEDIA / "models" / "huggingface"))
os.environ.setdefault("TORCH_HOME", str(MEDIA / "models" / "torch"))
os.environ.setdefault("RF_HOME", str(MEDIA / "models" / "rfdetr"))


def status(stage, message, frames):
    print(message, flush=True)
    EVENTS.append({"time": time.strftime("%H:%M:%S"), "message": message})
    value = {"stage": stage, "message": message, "frames": frames, "events": EVENTS}
    temp = OUTPUT / "status.tmp"
    temp.write_text(json.dumps(value))
    temp.replace(OUTPUT / "status.json")


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    frames = []
    status("loading", "Ladataan RF-DETR Small -mallia. Ensimmäinen ajo hakee mallipainot.", frames)
    try:
        import imageio_ffmpeg
        from PIL import Image
        from rfdetr import RFDETRSmall
        # CPU is the first reproducible baseline. No video is uploaded to a service.
        model = RFDETRSmall(device="cpu")
        source = MEDIA / "clips" / "honka-veto-10m00s-30s.mp4"
        for seconds in (0, 5, 10):
            status("processing", f"Poimitaan ja käsitellään ruutu kohdasta {seconds} s / 30 s.", frames)
            image_path = OUTPUT / f"frame-{seconds}.jpg"
            subprocess.run([
                imageio_ffmpeg.get_ffmpeg_exe(), "-hide_banner", "-loglevel", "error",
                "-y", "-ss", str(seconds), "-i", str(source), "-frames:v", "1", str(image_path),
            ], check=True)
            image = Image.open(image_path).convert("RGB")
            started = time.perf_counter()
            # Keep low-confidence candidates so the viewer can inspect the cutoff.
            detections = model.predict(image, threshold=0.15)
            people = []
            for box, confidence, class_id in zip(detections.xyxy, detections.confidence, detections.class_id):
                if int(class_id) == 1:  # COCO class 1 = person, not necessarily a player.
                    people.append({"box": [float(x) for x in box], "confidence": float(confidence)})
            frames.append({"seconds": seconds, "image": f"/results/frame-{seconds}.jpg",
                           "width": image.width, "height": image.height,
                           "elapsed": round(time.perf_counter() - started, 2), "people": people})
            status("processing", f"Ruutu {seconds} s valmis: {len(people)} ihmisehdokasta (raja 15 %).", frames)
        status("done", "Kolme ruutua käsitelty. Tämä vaihe löytää ihmisiä; se ei seuraa tai nimeä pelaajia.", frames)
    except Exception as error:
        status("error", f"Käsittely epäonnistui: {type(error).__name__}: {error}", frames)
        raise


if __name__ == "__main__":
    main()
