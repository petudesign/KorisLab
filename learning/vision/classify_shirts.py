"""Lesson 2: inspect torso crops with explicit colour rules, not a trained team model."""
import colorsys
import json
from pathlib import Path
import time

from PIL import Image

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "media/detection"


def inspect_shirt(image, box):
    x1, y1, x2, y2 = box
    width, height = x2 - x1, y2 - y1
    # Use the middle of the upper body, avoiding head, shorts and box edges.
    crop_box = [max(0, int(x1 + width * .25)), max(0, int(y1 + height * .20)),
                min(image.width, int(x1 + width * .75)), min(image.height, int(y1 + height * .50))]
    if crop_box[2] <= crop_box[0] or crop_box[3] <= crop_box[1]:
        raise ValueError("Empty torso crop")
    crop = image.crop(crop_box)
    pixels = list(crop.convert("RGB").get_flattened_data())
    green = white = 0
    for red, green_channel, blue in pixels:
        hue, saturation, value = colorsys.rgb_to_hsv(red / 255, green_channel / 255, blue / 255)
        # The green jersey looks teal under this camera's lighting.
        if 65 / 360 <= hue <= 210 / 360 and saturation >= .18 and value >= .10:
            green += 1
        # Exclude warm beige pixels from skin and the wooden floor.
        neutral_or_cool = saturation < .10 or hue > 65 / 360 or hue < 15 / 360
        if saturation <= .30 and value >= .55 and neutral_or_cool:
            white += 1
    green_share = green / len(pixels)
    white_share = white / len(pixels)
    if green_share >= .35 and green_share - white_share >= .08:
        group = "green"
    elif white_share >= .22 and green_share < .20 and white_share - green_share >= .15:
        group = "white"
    else:
        group = "unknown"
    return crop, {"crop_box": crop_box, "group": group,
                  "green_share": round(green_share, 4), "white_share": round(white_share, 4)}


def main():
    path = OUTPUT / "status.json"
    state = json.loads(path.read_text())
    for frame in state["frames"]:
        image = Image.open(OUTPUT / f"frame-{frame['seconds']}.jpg").convert("RGB")
        for index, person in enumerate(frame["people"]):
            crop, result = inspect_shirt(image, person["box"])
            filename = f"shirt-{frame['seconds']}-{index}.jpg"
            crop.save(OUTPUT / filename, quality=95)
            person["shirt"] = {**result, "image": f"/results/{filename}", "number": index + 1}
        state.setdefault("events", []).append({"time": time.strftime("%H:%M:%S"),
                                              "message": f"Ruutu {frame['seconds']} s: paitakuvat rajattu ja värisäännöt laskettu."})
    state["lesson"] = 2
    state["stage"] = "done"
    state["message"] = "Paitakuvat valmiina. Värisäännöt ovat alustava kokeilu, eivät varmennettuja joukkuetunnistuksia."
    temp = OUTPUT / "status.tmp"
    temp.write_text(json.dumps(state))
    temp.replace(path)
    for frame in state["frames"]:
        print(f"Frame {frame['seconds']} s (person cutoff 60%):")
        for person in frame["people"]:
            if person["confidence"] >= .60:
                shirt = person["shirt"]
                print(shirt["number"], shirt["group"], shirt["green_share"], shirt["white_share"])


if __name__ == "__main__":
    main()
