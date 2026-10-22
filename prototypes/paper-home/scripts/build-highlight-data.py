"""Build small highlight trends from the project's dated, normalized games."""
import json
import re
from datetime import datetime
from pathlib import Path
root = Path(__file__).resolve().parents[3]
source = root / 'prototypes/paper-home/source'
datasets = json.loads((source / 'seasons.json').read_text())
# Historic women's box scores lack dates; use the existing application's schedule.
dates = dict(re.findall(r'"(\d+)":\s*"([0-9T:+-]+)"', (root / 'web/src/schedule.ts').read_text()))
ratio = lambda numerator, denominator: 100 * numerator / denominator if denominator else None
for league, seasons in datasets.items():
    for season_id, data in seasons.items():
        records = json.loads((root / data['sourceFile']).read_text())['matches']
        standings = {}
        for match in records:
            for team in match['teams']:
                opponent = next(t for t in match['teams'] if t['home_away'] != team['home_away'])
                row = standings.setdefault(team['source_id'], {'games':0,'wins':0,'losses':0,'pointsFor':0,'pointsAgainst':0})
                row['games'] += 1
                row['wins'] += int(team['score'] > opponent['score'])
                row['losses'] += int(team['score'] < opponent['score'])
                row['pointsFor'] += team['score']
                row['pointsAgainst'] += opponent['score']
        data['standings'] = standings
        histories = {}
        for match in records:
            date = match['game'].get('scheduled_at') or (dates.get(match['game']['source_id']) if league == 'women' and season_id == '2025-26' else None)
            if not date:
                raise ValueError(f"Missing game date: {match['game']['source_id']}")
            for team in match['teams']:
                opponent = next(t for t in match['teams'] if t['home_away'] != team['home_away'])
                stats, other = team['stats'], opponent['stats']
                possessions = lambda s: s['two_pa'] + s['three_pa'] + .44 * s['fta'] - s['offensive_rebounds'] + s['turnovers']
                shared = (possessions(stats) + possessions(other)) / 2
                histories.setdefault(team['source_id'], []).append({
                    'id':match['game']['source_id'], 'date':date, 'opponent':opponent['name'],
                    'home':next(t['name'] for t in match['teams'] if t['home_away']=='home'),
                    'away':next(t['name'] for t in match['teams'] if t['home_away']=='away'),
                    'homeScore':next(t['score'] for t in match['teams'] if t['home_away']=='home'),
                    'awayScore':next(t['score'] for t in match['teams'] if t['home_away']=='away'),
                    'orb':ratio(stats['offensive_rebounds'],stats['offensive_rebounds'] + other['defensive_rebounds']),
                    'efg':ratio(stats['two_pm'] + 1.5 * stats['three_pm'],stats['two_pa'] + stats['three_pa']),
                    'net':ratio(stats['points'] - other['points'],shared),
                })
        data['highlightTrends'] = {team_id:sorted(rows,key=lambda r: datetime.fromisoformat(r['date']).timestamp())[-5:] for team_id, rows in histories.items()}
        teams = data['aggregate']['teams']
        total = lambda key: sum(t['totals'][key] for t in teams)
        data['highlightLeagueAverages'] = {
            'orb':ratio(total('offensive_rebounds'),total('offensive_rebounds') + total('defensive_rebounds')),
            'efg':ratio(total('two_pm') + 1.5 * total('three_pm'),total('two_pa') + total('three_pa')),
            'net':0,
        }
(source / 'seasons.json').write_text(json.dumps(datasets,ensure_ascii=False,separators=(',',':'))+'\n')
print('Updated all six highlight datasets, sorted by game dates.')
