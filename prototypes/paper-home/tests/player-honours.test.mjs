import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url)));
for(const [league,prefix] of [['women',''],['men','korisliiga/']])for(const season of ['2024-25','2025-26','2026-27'])test(`${league} ${season}: profile biographies match the original source`,()=>{
 const copied=read(`../public/data/profiles/${league}-${season}.json`);
 assert.deepEqual(copied,read(`../../../web/public/${prefix}player-profiles-${season}.json`));
 assert.equal(copied.season_id,season);
 assert.equal(copied.league_id,league==='men'?'korisliiga':'naisten-korisliiga');
});
test('championship honours link to verified final rosters, never the current team alone',()=>{
 const honours=read('../source/player-honours.json');
 const files={'Peli-Karhut:2024-25':'season_playoffs_2024_2025.json','Peli-Karhut:2025-26':'season_playoffs_2025_2026.json','Helsinki Seagulls:2024-25':'season_korisliiga_playoffs_2024_2025.json','Salon Vilpas:2025-26':'season_korisliiga_playoffs_2025_2026.json'};
 const championships=honours.filter(row=>row.kind==='championship');
 assert.equal(new Set(championships.map(r=>`${r.playerId}:${r.season}`)).size,championships.length);
 assert.equal(new Set(championships.map(r=>`${r.team}:${r.season}`)).size,4);
 for(const honour of championships){
  const matches=read(`../../../data/normalized/${files[`${honour.team}:${honour.season}`]}`).matches.filter(g=>honour.matchIds.includes(g.game.source_id));
  assert.ok(matches.length);
  assert.ok(matches.some(g=>g.teams.some(t=>t.name===honour.team&&t.players.some(p=>p.source_player_id===honour.playerId))));
  assert.equal(new URL(honour.sourceUrl).hostname,'basket.fi');
 }
});
