"""Refresh the new UI from verified public snapshots before publishing data.

Run from the repository checkout after ingestion.publish_season. Historical
snapshots and their source files remain unchanged; no network requests are made.
"""
import json
import shutil
import subprocess
import sys
from pathlib import Path


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


def sync(prototype):
    project = prototype.parents[1]
    seasons_path = prototype / "source/seasons.json"
    seasons = read(seasons_path)
    match_manifest_path = prototype / "source/match-analysis.json"
    player_manifest_path = prototype / "source/player-analysis.json"
    match_manifest, player_manifest = read(match_manifest_path), read(player_manifest_path)
    refreshed = []
    for league, datasets in seasons.items():
        for season, dataset in datasets.items():
            if not dataset["sourceFile"].startswith("web/public/"):
                continue
            source = project / dataset["sourceFile"]
            snapshot = read(source)
            if snapshot["aggregate"]["games"] != len(snapshot["matches"]):
                raise ValueError(f"Inconsistent verified game count: {source}")
            if any(not m.get("validation", {}).get("valid", True) for m in snapshot["matches"]):
                raise ValueError(f"Invalid game in published snapshot: {source}")
            dataset.update(aggregate=snapshot["aggregate"], summary=snapshot["summary"], updatedAt=snapshot["updated_at"])
            public = source.parent
            for source_name, destination in [
                (f"player-shots-{season}.json", f"/data/analysis/{league}-{season}-shots.json"),
                (f"assists-{season}.json", f"/data/analysis/{league}-{season}-assists.json"),
                (f"player-profiles-{season}.json", f"/data/profiles/{league}-{season}.json"),
            ]:
                original = public / source_name
                if original.exists():
                    target = prototype / "public" / destination.lstrip("/")
                    target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(original, target)
                    if "profiles" not in source_name:
                        kind = "shots" if source_name.startswith("player-shots") else "assists"
                        player_manifest.setdefault(f"{league}-{season}", {})[kind] = destination
            for match in snapshot["matches"]:
                match_id = str(match["game"]["source_id"])
                for kind in ["shots", "replays"]:
                    original = public / kind / f"{match_id}.json"
                    if not original.exists():
                        continue
                    destination = f"/data/matches/{league}/{kind}/{match_id}.json"
                    target = prototype / "public" / destination.lstrip("/")
                    target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(original, target)
                    match_manifest.setdefault(f"{league}-{match_id}", {}).update({kind: destination, "season": season})
            refreshed.append((league, season))
    write(seasons_path, seasons)
    write(match_manifest_path, match_manifest)
    write(player_manifest_path, player_manifest)
    for builder in ["build-match-data.py", "build-highlight-data.py"]:
        subprocess.run([sys.executable, str(prototype / "scripts" / builder)], check=True)
    seasons = read(seasons_path)
    for league, season in refreshed:
        dataset = seasons[league][season]
        dataset["games"] = [g for g in dataset["schedule"] if g["action"] == "Katso analyysi"][:4]
        print(f"Synced {league} {season}: {dataset['aggregate']['games']} verified games; {dataset['updatedAt']}")
    write(seasons_path, seasons)


if __name__ == "__main__":
    sync(Path(__file__).resolve().parents[1])
