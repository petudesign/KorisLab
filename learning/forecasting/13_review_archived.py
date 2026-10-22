"""Compare archived forecasts with validated results; never rewrite forecasts.

Run with --league men|women --fetch to retrieve missing public box scores.
Without --fetch this only reads previously downloaded local snapshots.
"""
import argparse
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from ingestion.basketfi_statistics import BasketFiStatisticsClient
from validation.checks import validate_statistics_snapshot
from forecast_tracker import HELSINKI, digest, evaluate_history, kickoff, prepare_games


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--league", choices=["men", "women"], required=True)
    parser.add_argument("--fetch", action="store_true")
    args = parser.parse_args()
    folder = Path(__file__).resolve().parent
    prefix = "men-" if args.league == "men" else ""
    results = folder / "results"
    history_path = folder / f"history/{prefix}forecasts-v1.jsonl"
    history_bytes = history_path.read_bytes()
    history = [json.loads(line) for line in history_bytes.decode().splitlines() if line]
    for row in history:
        if digest({k: v for k, v in row.items() if k != "record_id"}) != row["record_id"]:
            raise ValueError("Forecast archive integrity check failed")
    now = datetime.now(timezone.utc)
    source_games = json.loads((ROOT / f"prototypes/paper-home/public/data/{args.league}-2026-27-matches.json").read_text())
    archived_ids = {r["match_id"] for r in history}
    due = [g for g in source_games if g["id"] in archived_ids and kickoff(g) < now]
    client = BasketFiStatisticsClient()
    games, sources, skipped = [], [], []
    cache = results / "verified"
    cache.mkdir(exist_ok=True)
    for fixture in sorted(due, key=kickoff):
        match_id = fixture["id"]
        path = cache / f"{args.league}-{match_id}.json"
        older = results / f"men-2026-10-14-{match_id}.json"
        if not path.exists() and args.league == "men" and older.exists():
            snapshot = json.loads(older.read_text())
        elif path.exists():
            snapshot = json.loads(path.read_text())
        elif args.fetch:
            try:
                snapshot = client.get_match_statistics(match_id)
            except Exception as error:
                skipped.append({"match_id": match_id, "reason": str(error)})
                continue
        else:
            skipped.append({"match_id": match_id, "reason": "No local result; use --fetch"})
            continue
        validation = validate_statistics_snapshot(snapshot)
        if not validation["valid"] or snapshot["game"].get("status") != "CONFIRMED":
            skipped.append({"match_id": match_id, "reason": "Result not validated and confirmed", "validation": validation})
            continue
        if str(snapshot["game"]["source_id"]) != match_id:
            raise ValueError("Result match ID differs from requested fixture")
        game = deepcopy(fixture)
        sides = {t["home_away"]: t for t in snapshot["teams"]}
        for team in game["teams"]:
            actual = sides[team["side"]]
            if team["id"] != actual["source_id"]:
                raise ValueError(f"Team changed in match {match_id}")
            team["score"] = actual["score"]
        game.update(verified=True, status="played")
        snapshot["validation"] = validation
        if not path.exists():
            path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n")
        games.append(game)
        sources.append({"match_id": match_id, "file": str(path.relative_to(ROOT)),
                        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "source": snapshot["source"]})
        print(match_id, [(t["name"], t["score"]) for t in game["teams"]], flush=True)
    prepare_games(games)
    lock = json.loads((folder / ("model-lock-men-v1.json" if args.league == "men" else "model-lock-v1.json")).read_text())
    evaluated = evaluate_history(history, games, digest(lock), now)
    metrics = {}
    for model in lock["models"]:
        correct = ties = 0
        squared = []
        for entry in evaluated:
            p = entry["forecast"]["probabilities"][model]
            actual = int(entry["home_score"] > entry["away_score"])
            ties += p == .5
            correct += p != .5 and (p > .5) == bool(actual)
            squared.append((p - actual) ** 2)
        metrics[model] = {"correct": correct, "ties": ties, "games": len(evaluated),
                          "brier": sum(squared) / len(squared) if squared else None}
    payload = {"reviewed_at": now.isoformat(), "league": args.league,
               "model_sha256": digest(lock), "forecast_history_sha256": hashlib.sha256(history_bytes).hexdigest(),
               "time_note": "Box scores may omit kickoff. Existing season fixture times retained; postponements not independently checked by this script.",
               "archived_matches": len(archived_ids), "past_fixtures": len(due),
               "sources": sources, "skipped": skipped, "evaluated": evaluated, "metrics": metrics}
    (results / f"{args.league}-reviewed-results.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    lines = [f"# Ennusteiden toteumat · {args.league} · {now.astimezone(HELSINKI):%d.%m.%Y}", "",
             "Ennen otteluita arkistoidut arviot; malliparametreja tai ennusteita ei muutettu.", "",
             f"Arkistoituja otteluita {len(archived_ids)}, aiemmin alkaneita {len(due)}, arvioitavia varmennettuja tuloksia {len(evaluated)}.", "",
             "| Päivä | Ottelu | Tulos | Piste-eromallin suosikki | Kotipaikkaversion suosikki |",
             "|---|---|---|---|---|"]
    for entry in sorted(evaluated, key=lambda e: e["forecast"]["kickoff"]):
        r = entry["forecast"]
        cells = []
        for model in lock["models"]:
            p = r["probabilities"][model]
            if p == .5:
                cells.append("Ei suosikkia · 50 %")
            else:
                home = p > .5
                name = r["home"] if home else r["away"]
                probability = p if home else 1-p
                outcome = "oikein" if home == (entry["home_score"] > entry["away_score"]) else "väärin"
                cells.append(f"{name} {probability:.1%} · {outcome}")
        date = datetime.fromisoformat(r["kickoff"]).astimezone(HELSINKI).strftime("%d.%m.")
        lines.append(f"| {date} | {r['home']} – {r['away']} | {entry['home_score']}–{entry['away_score']} | " + " | ".join(cells) + " |")
    lines += ["", f"Mittarit: {json.dumps(metrics, ensure_ascii=False)}", "",
              "Suosikkiosumat ja todennäköisyyksien laatu ovat eri asioita. Brierissä pienempi on parempi; 50/50-verrokki on 0,2500.",
              "Tulosten alkamisaika tulee vanhasta kausiohjelmasta, jos box score ei sisällä sitä. Siirtoja ei ole tarkistettu erikseen.",
              "Saman päivän vielä alkamattomia pelejä ei lasketa toteumiksi. Puuttuvia tuloksia ei tulkita tappioiksi.",
              "Kausikoostetta ja tulevia ennusteita ei päivitetä tällä skriptillä. Ennusteet perustuvat edelleen 13.10. käytössä olleeseen aineistoon.", ""]
    if skipped:
        lines += ["## Tarkistettavaa", json.dumps(skipped, ensure_ascii=False, indent=2)]
    (results / f"{args.league}-review-current.md").write_text("\n".join(lines))
    if history_path.read_bytes() != history_bytes:
        raise ValueError("Forecast archive changed during review")
    print(json.dumps(metrics, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
