// Fixed scale for player ratings: typical rates and spreads from completed regular seasons, newest season left out.
// node scripts/build-rating-reference.mjs  (part of the build; output is deterministic)
import fs from 'node:fs';
import {aggregateSeasonPlayers} from '../src/lib/playerStats.ts';
import {buildRatingReference} from '../src/lib/playerRatings.js';

const dir=new URL('../public/data/',import.meta.url),out=new URL('../source/rating-reference.json',import.meta.url);
const records=games=>games.filter(g=>g.verified).map(g=>({game:{source_id:g.id},teams:g.teams.map(t=>({...t,source_id:t.id,
 players:t.players.map(p=>({...p,source_player_id:p.id,display_name:p.name,minutes:p.minutesValue}))}))}));
const reference={};
for(const league of ['men','women']){
 const seasons=fs.readdirSync(dir).map(name=>name.match(new RegExp(`^${league}-(\\d{4}-\\d{2})-matches\\.json$`))?.[1]).filter(Boolean).sort();
 const completed=seasons.slice(0,-1);
 const players=completed.map(season=>aggregateSeasonPlayers(records(JSON.parse(fs.readFileSync(new URL(`${league}-${season}-matches.json`,dir),'utf8')))));
 reference[league]={seasons:completed,...buildRatingReference(players)};
}
fs.writeFileSync(out,JSON.stringify(reference,null,1)+'\n');
console.log(Object.entries(reference).map(([league,r])=>`${league}: ${r.seasons.join(', ')} · ${r.regulars} regulars`).join('\n'));
