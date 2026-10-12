"""Copy compact game box scores into separately loaded prototype season files."""
import json,re
from pathlib import Path
root=Path(__file__).resolve().parents[3]
base=root/'prototypes/paper-home'
datasets=json.loads((base/'source/seasons.json').read_text())
dates=dict(re.findall(r'"(\d+)":\s*"([0-9T:+-]+)"',(root/'web/src/schedule.ts').read_text()))
output=base/'public/data';output.mkdir(exist_ok=True)
for league,seasons in datasets.items():
 for season,data in seasons.items():
  games=[]
  source_data=json.loads((root/data['sourceFile']).read_text())
  for record in source_data['matches']:
   game=record['game']
   games.append({'id':str(game['source_id']),'date':game.get('scheduled_at') or (dates.get(str(game['source_id'])) if league=='women' and season=='2025-26' else None),'venue':(game.get('venue') or {}).get('name'),'periods':game.get('periods',[]),'sourceUrl':record['source'].get('source_url'),'teams':[{'id':team['source_id'],'name':team['name'],'side':team['home_away'],'score':team['score'],'stats':team['stats'],'players':[{'id':p.get('source_player_id'),'name':p['display_name'],'minutesValue':p.get('minutes'),'minutes':p.get('minutes_display'),'starter':p.get('starter'),'stats':p['stats']} for p in team.get('players',[]) if p.get('participated',True)]} for team in record['teams']]})
  for g in games:g.update(verified=True,status='played')
  schedule=source_data.get('schedule',[])
  if schedule:
   indexed={g['id']:g for g in games}
   team_ids={t['name']:t['source_team_id'] for t in data['aggregate']['teams']}
   for fixture in schedule:
    fid=str(fixture['source_match_id'])
    g=indexed.get(fid) or {'id':fid,'verified':False,'periods':[],'sourceUrl':f'https://tulospalvelu.basket.fi/match/{fid}/statistics','teams':[{'id':team_ids.get(fixture[side]['name'],fixture[side]['source_team_id']),'name':fixture[side]['name'],'side':side,'score':fixture[side]['score'],'stats':{},'players':[]} for side in ['home','away']]}
    g.update(date=fixture['scheduled_date']+'T12:00:00' if fixture['scheduled_date'] else None,time=fixture.get('scheduled_time'),venue=fixture.get('venue'),status=fixture['status'].lower())
    indexed[fid]=g
   games=list(indexed.values())
  games.sort(key=lambda g:g['date'] or '',reverse=True)
  assert sum(g['verified'] for g in games)==data['aggregate']['games']
  (output/f'{league}-{season}-matches.json').write_text(json.dumps(games,ensure_ascii=False,separators=(',',':'))+'\n')
  data['schedule']=[{'id':g['id'],'date':g['date'],'time':g.get('time'),'status':g['status'],'home':g['teams'][0]['name'],'away':g['teams'][1]['name'],'venue':g['venue'],'value':f"{g['teams'][0]['score']} - {g['teams'][1]['score']}" if g['status'] in ['played','finished','completed'] else (g.get('time') or 'Aika avoin')[:5],'action':'Katso analyysi' if g['verified'] else 'Avaa ennakko'} for g in games] if schedule else []
  data['matchesUrl']=f'/data/{league}-{season}-matches.json'
(base/'source/seasons.json').write_text(json.dumps(datasets,ensure_ascii=False,separators=(',',':'))+'\n')
print('Exported six season game files with box scores and players.')
