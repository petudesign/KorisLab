import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {aggregateSeasonPlayers} from '../src/lib/playerStats.ts';
const seasons=JSON.parse(fs.readFileSync(new URL('../source/seasons.json',import.meta.url)));
for(const [league,datasets] of Object.entries(seasons))for(const [season,data] of Object.entries(datasets))test(`${league} ${season}: schedule and player parity`,()=>{
 const exported=JSON.parse(fs.readFileSync(new URL('../public'+data.matchesUrl,import.meta.url)));
 const original=JSON.parse(fs.readFileSync(new URL('../../../'+data.sourceFile,import.meta.url)));
 assert.equal(exported.filter(g=>g.verified).length,data.aggregate.games);
 assert.equal(new Set(exported.map(g=>g.id)).size,exported.length);
 if(original.schedule){assert.equal(exported.length,original.schedule.length);assert.equal(exported.filter(g=>g.status==='fixture').length,original.schedule.filter(g=>g.status==='Fixture').length);}
 const adapted=exported.filter(g=>g.verified).map(g=>({game:{source_id:g.id},teams:g.teams.map(t=>({...t,players:t.players.map(p=>({...p,source_player_id:p.id,display_name:p.name,minutes:p.minutesValue}))}))}));
 const sorted=rows=>rows.sort((a,b)=>String(a.id).localeCompare(String(b.id)));
 const actual=sorted(aggregateSeasonPlayers(adapted)),expected=sorted(aggregateSeasonPlayers(original.matches));
 // Integer stats are exact; minute totals tolerate floating-point summation order.
 assert.equal(actual.length,expected.length);
 actual.forEach((p,i)=>{const q=expected[i];assert.equal(p.id,q.id);for(const key of ['games','starts','points','rebounds','assists','twoPM','twoPA','threePM','threePA','ftm','fta'])assert.equal(p[key],q[key],`${p.name} ${key}`);assert.ok(Number.isNaN(p.minutes)&&Number.isNaN(q.minutes)||Math.abs(p.minutes-q.minutes)<1e-8);});
});
