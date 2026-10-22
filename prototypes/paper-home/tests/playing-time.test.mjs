import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {aggregateSeasonPlayers,playerPerGame,playerEfficiencyPer40} from '../src/lib/playerStats.ts';
import {buildComparisonEntries} from '../src/lib/matchupStats.ts';

test('missing minutes retain appearances and counting stats, never produce partial season minute averages',()=>{
 const records=[20,null].map((minutes,i)=>({game:{source_id:String(i)},teams:[{source_id:'a',name:'A',score:80,stats:{},players:[{source_player_id:'p',display_name:'Player',minutes,participated:true,stats:{points:20,efficiency:10}}]},{source_id:'b',name:'B',score:70,stats:{},players:[]}]}));
 const [player]=aggregateSeasonPlayers(records);
 assert.equal(player.games,2);assert.equal(player.points,40);
 assert.equal(playerPerGame(player,'points'),20);
 assert.ok(Number.isNaN(player.minutes));assert.equal(playerEfficiencyPer40(player),null);
 assert.equal(buildComparisonEntries(records,'players')[0].values.points,20);
 assert.equal(buildComparisonEntries(records,'players','40')[0].values.points,null);
});

test('historical Dunn minutes are reconstructed; Harris missing games never inflate or suppress his points',()=>{
 const records=JSON.parse(readFileSync(new URL('../../../data/normalized/season_korisliiga_2025_2026.json',import.meta.url))).matches;
 const players=aggregateSeasonPlayers(records);
 const dunn=players.find(p=>p.name==='Damian Dunn'),harris=players.find(p=>p.name.includes('Claudell Harris'));
 assert.ok(dunn.minutes/dunn.games>30&&dunn.minutes/dunn.games<32);
 assert.equal(harris.games,6);assert.equal(playerPerGame(harris,'points'),20);
 assert.ok(Number.isNaN(harris.minutes));
 const row=records.find(r=>r.game.source_id==='968707').teams.flatMap(t=>t.players).find(p=>p.display_name==='Damian Dunn');
 assert.equal(row.minutes_display,'39:48');assert.equal(row.stats.points,32);
});
