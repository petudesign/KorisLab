import {test} from 'node:test';
import assert from 'node:assert/strict';
import {aggregateSeasonPlayers,playerUsagePct} from '../src/lib/playerStats.ts';
import {metricLeader,playerRecentGames} from '../src/lib/playerLeaders.js';

const stats=(two_pa,three_pa,fta,turnovers)=>({points:0,two_pm:0,two_pa,three_pm:0,three_pa,ftm:0,fta,rebounds:0,assists:0,turnovers,steals:0,blocks:0,blocks_received:0,plus_minus:0,efficiency:0});
const record=(id,minutes,teamStats=stats(60,20,25,14))=>({game:{source_id:id},teams:[{name:'Home',source_id:'h',stats:teamStats,players:[
 {source_player_id:'a',display_name:'A',minutes:minutes[0],participated:true,stats:stats(20,5,10,5)},
 {source_player_id:'b',display_name:'B',minutes:minutes[1],participated:true,stats:stats(5,5,0,1)},
]}]});

test('usage is the share of team possessions used while on the floor, not a share of the whole game',()=>{
 const [a,b]=aggregateSeasonPlayers([record('1',[20,180])]);
 assert.ok(Math.abs(playerUsagePct(a)-100*(25+4.4+5)*(200/5)/(20*(80+11+14)))<1e-9);
 assert.ok(playerUsagePct(a)>playerUsagePct(b));
 assert.equal(a.minutes,20);
});

test('games with lost minutes do not count towards usage but still count as games',()=>{
 const complete=record('1',[100,100]),missing=record('2',[null,null]),partial=record('3',[30,30]);
 const [a]=aggregateSeasonPlayers([complete,missing,partial]);
 assert.equal(a.games,3);
 assert.equal(a.usageGames,1);
 assert.ok(Math.abs(playerUsagePct(a)-playerUsagePct(aggregateSeasonPlayers([complete])[0]))<1e-9);
 const [only]=aggregateSeasonPlayers([missing]);
 assert.equal(playerUsagePct(only),null);
});

test('missing team stats leave usage empty instead of zero',()=>{
 const [a]=aggregateSeasonPlayers([{...record('1',[100,100]),teams:[{...record('1',[100,100]).teams[0],stats:{}}]}]);
 assert.equal(playerUsagePct(a),null);
});

test('usage leaders need enough complete games and the league average is weighted by minutes',()=>{
 const rows=aggregateSeasonPlayers([record('1',[100,100]),record('2',[100,100])]);
 const result=metricLeader(rows,'usagePct',2);
 assert.equal(result.leader.id,'a');
 const expected=rows.reduce((sum,p)=>sum+playerUsagePct(p)*p.usageMinutes,0)/rows.reduce((sum,p)=>sum+p.usageMinutes,0);
 assert.ok(Math.abs(result.average-expected)<1e-9);
 assert.equal(metricLeader(rows,'usagePct',3).leader,undefined);
});

test('the usage trend skips games without complete minutes',()=>{
 const game=(day,value)=>({id:day,date:`2026-10-0${day}`,verified:true,teams:[{side:'home',name:'Home',score:80,stats:stats(60,20,25,14),players:[{id:'a',minutesValue:value,participated:true,stats:stats(20,5,10,5)},{id:'b',minutesValue:value===null?null:200-value,participated:true,stats:stats(5,5,0,1)}]},{side:'away',name:'Away',score:70,stats:stats(60,20,25,14),players:[]}]});
 const rows=playerRecentGames([game(1,30),game(2,null)],'a','usagePct');
 assert.deepEqual(rows.map(g=>g.id),[1]);
 assert.ok(rows[0].usagePct>0);
});
