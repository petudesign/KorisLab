"""Copy original verified Matchup Lab assets; regular-season records reuse match data."""
import json
import shutil
from pathlib import Path
prototype = Path(__file__).resolve().parents[1]
project = prototype.parents[1]
for league, prefix in [('women', ''), ('men', 'korisliiga_')]:
    for season in ['2024-25', '2025-26']:
        year = int(season[:4])
        source = project / f'data/normalized/season_{prefix}playoffs_{year}_{year+1}.json'
        records = [row for row in json.loads(source.read_text())['matches'] if row.get('validation', {}).get('valid', True)]
        (prototype / f'public/data/{league}-{season}-playoffs.json').write_text(json.dumps(records, ensure_ascii=False, separators=(',', ':')))
        onoff = project / 'web/public' / ('korisliiga' if league == 'men' else '') / f'onoff-{season}.json'
        if onoff.exists():
            shutil.copy(onoff, prototype / f'public/data/{league}-{season}-onoff.json')
