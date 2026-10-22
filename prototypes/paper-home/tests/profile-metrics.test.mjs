import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {teamRecentMetrics} from '../src/lib/teamProfiles.js';
import {profileMetrics,playerProfileHistory,profileLeagueBenchmarks} from '../src/lib/playerProfileMetrics.js';
import {aggregateSeasonPlayers} from '../src/lib/playerStats.ts';

const game=(day,stats={},minutes=20)=>({id:String(day),date:`2026-10-${String(day).padStart(2,'0')}`,verified:true,teams:[{name:'Home',side:'home',score:80,stats:{two_pa:40,three_pa:20,fta:10,offensive_rebounds:10,turnovers:12},players:[{id:'p',minutesValue:minutes,stats:{points:12,two_pm:3,two_pa:5,three_pm:2,three_pa:4,ftm:0,fta:0,assists:4,turnovers:2,efficiency:15,...stats}}]},{name:'Away',side:'away',score:70,stats:{two_pa:35,three_pa:20,fta:15,offensive_rebounds:8,turnovers:14},players:[]}]});
test('team ratings use shared possessions, retain only the last five played games and exclude fixtures',()=>{
 const games=[...[6,1,5,2,4,3].map(day=>game(day)),{...game(7),verified:false}];
 const rows=teamRecentMetrics(games,'Home');
 assert.deepEqual(rows.map(g=>g.id),['2','3','4','5','6']);
 const possessions=((40+20+.44*10-10+12)+(35+20+.44*15-8+14))/2;
 assert.equal(rows[0].offensive,100*80/possessions);
 assert.equal(rows[0].defensive,100*70/possessions);
 const missing=game(8);delete missing.teams[1].stats.fta;
 assert.equal(teamRecentMetrics([missing],'Home')[0].offensive,null);
});
test('all original 16 player metrics are included; zero-attempt percentages and missing stats are not zeroes',()=>{
 assert.equal(profileMetrics.length,16);
 const [row]=playerProfileHistory([game(1)],'p');
 assert.equal(row.assistTurnover,2);
 assert.equal(row.efficiency,30);
 assert.equal(row.attempts,18);
 assert.ok(Math.abs(row.effectiveFieldGoals-100*6/9)<1e-10);
 assert.ok(Math.abs(row.trueShooting-100*12/18)<1e-10);
 assert.equal(row.freeThrows,null);
 assert.equal(row.blocks,null);
 const rows=playerProfileHistory([...[7,1,6,2,5,3,4].map(day=>game(day)),game(8,{},0)],'p');
 assert.deepEqual(rows.map(g=>g.id),['3','4','5','6','7']);
});
test('profile benchmarks pool shooting attempts rather than average player percentages',()=>{
 const rows=[{games:1,points:2,twoPM:1,twoPA:1,threePM:0,threePA:0,ftm:0,fta:0},{games:1,points:0,twoPM:0,twoPA:9,threePM:0,threePA:0,ftm:0,fta:0}];
 const {averages,count,minimum}=profileLeagueBenchmarks(rows,[game(1)]);
 assert.equal(count,2);assert.equal(minimum,1);
 assert.equal(averages.fieldGoals,10);
 assert.equal(averages.points,1);
 assert.equal(averages.freeThrows,null);
});
const seasons=JSON.parse(fs.readFileSync(new URL('../source/seasons.json',import.meta.url)));
for(const [league,rows] of Object.entries(seasons))for(const [year,season] of Object.entries(rows))test(`${league} ${year}: profile histories resolve real player IDs and finite graph points`,()=>{
 const games=JSON.parse(fs.readFileSync(new URL('../public'+season.matchesUrl,import.meta.url)));
 const records=games.filter(g=>g.verified).map(g=>({game:{source_id:g.id},teams:g.teams.map(t=>({...t,source_id:t.id,players:t.players.map(p=>({...p,source_player_id:p.id,display_name:p.name,minutes:p.minutesValue}))}))}));
 const players=aggregateSeasonPlayers(records);
 for(const player of players){
  const history=playerProfileHistory(games,player.id);
  assert.equal(history.length,Math.min(player.games,5));
  for(const row of history)for(const d of profileMetrics.filter(d=>!d.noTrend))assert.ok(row[d.key]==null||Number.isFinite(row[d.key]),`${player.name} ${d.key}`);
 }
});
