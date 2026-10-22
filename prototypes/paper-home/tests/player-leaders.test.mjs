import {test} from 'node:test';
import assert from 'node:assert/strict';
import {playerLeader,playerRecentGames} from '../src/lib/playerLeaders.js';
test('leaders use per-game values, break ties with sample size, and weight league average by appearances',()=>{
 const players=[{id:'a',name:'A',games:1,points:20},{id:'b',name:'B',games:3,points:60},{id:'c',name:'C',games:5,points:50},{id:'d',name:'D',games:0,points:100},{id:'e',name:'E',games:2,points:null}];
 const result=playerLeader(players,'points');
 assert.equal(result.leader.id,'b');
 assert.equal(result.average,130/9);
 assert.deepEqual(playerLeader([],'points'),{leader:undefined,average:null});
});
test('recent games exclude fixtures, DNP and missing metrics and keep last five chronologically',()=>{
 const game=(day,{verified=true,minutes=20,value=day}={})=>({id:day,date:`2026-10-${String(day).padStart(2,'0')}`,verified,teams:[{side:'home',name:'Home',score:80,players:[{id:'p',minutesValue:minutes,stats:{points:value}}]},{side:'away',name:'Away',score:70,players:[]}]});
 const games=[game(9,{verified:false}),game(8,{minutes:0}),game(7,{value:null}),...[6,1,5,2,4,3].map(day=>game(day))];
 const result=playerRecentGames(games,'p','points');
 assert.deepEqual(result.map(g=>g.id),[2,3,4,5,6]);
 assert.equal(result[0].homeScore,80);
 assert.deepEqual(playerRecentGames(games,'unknown','points'),[]);
});

test('derived leaders qualify meaningful samples and league rates use their underlying denominators',async()=>{
 const {metricLeader,playerMetric}=await import('../src/lib/playerLeaders.js');
 const players=[{id:'a',name:'A',games:2,minutes:60,points:40,twoPA:20,threePA:10,fta:10,efficiency:45},{id:'b',name:'B',games:1,minutes:2,points:3,twoPA:0,threePA:1,fta:0,efficiency:3}];
 assert.equal(metricLeader(players,'trueShootingPct',1).leader.id,'a');
 assert.equal(metricLeader(players,'minutes',2).leader.id,'a');
 assert.equal(metricLeader(players,'minutes',1).average,31);
 assert.equal(metricLeader(players,'minutes',1).trendAverage,62/3);
 assert.equal(metricLeader(players,'efficiencyPer40',1).average,40*48/62);
 assert.equal(metricLeader(players,'trueShootingPct',1).average,100*43/(2*(31+.44*10)));
 assert.equal(playerMetric(players[0],'attemptsPer40'),20);
 const g={id:1,date:'2026-10-01',verified:true,teams:[{side:'home',name:'Home',score:80,players:[{id:'a',minutesValue:30,stats:{points:20,two_pa:10,three_pa:5,fta:5,efficiency:24}}]},{side:'away',name:'Away',score:70,players:[]}]};
 assert.equal(playerRecentGames([g],'a','efficiencyPer40')[0].efficiencyPer40,32);
 assert.equal(playerRecentGames([g],'a','minutes')[0].minutes,30);
});
