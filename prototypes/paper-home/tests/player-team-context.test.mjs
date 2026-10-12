import {test} from 'node:test';
import assert from 'node:assert/strict';
import {playerTeamContext} from '../src/lib/playerTeamContext.js';
const player=(id,minutes,points,attempts)=>({id,minutesValue:minutes,stats:{points,two_pa:attempts,three_pa:0}});
const game=(id,name,won=true,patch={})=>({id,verified:true,teams:[{name,score:won?80:60,stats:{two_pa:40,three_pa:10},players:[player('A',30,20,10),player('B',20,10,5)]},{name:'Opponent',score:70,stats:{two_pa:30,three_pa:20},players:[]}],...patch});
test('team results use the full verified season while responsibility uses only selected appearances',()=>{
 const games=[game('1','Old'),game('2','Old',false),game('3','Old')];
 const [r]=playerTeamContext(games,[{id:'1',team:'Old'}],'A');
 assert.equal(r.games,3);assert.equal(r.wins,2);assert.equal(r.sampleGames,1);
 assert.equal(r.minutes,30);assert.equal(r.shotShare,20);assert.equal(r.pointShare,25);
});
test('responsibility rank compares teammates in the same games and preserves tied ranks',()=>{
 const g=game('1','A');g.teams[0].players.push(player('C',30,20,5));
 const [r]=playerTeamContext([g],[{id:'1',team:'A'}],'A');
 assert.equal(r.minuteRank,1);assert.equal(r.pointRank,1);
});
test('missing team attempts or teammate points cannot become a zero share or confident point rank',()=>{
 const g=game('1','A');g.teams[0].stats.two_pa=null;g.teams[0].players[1].stats.points=null;
 const [r]=playerTeamContext([g],[{id:'1',team:'A'}],'A');
 assert.equal(r.shotShare,null);assert.equal(r.pointRank,null);
});
test('multiple teams stay separate and fixtures never become losses',()=>{
 const games=[game('1','A'),game('2','B'),game('3','A',false,{verified:false})];
 const rows=playerTeamContext(games,[{id:'1',team:'A'},{id:'2',team:'B'}],'A');
 assert.equal(rows.length,2);assert.equal(rows[0].games,1);assert.equal(rows[0].losses,0);
 assert.equal(rows[1].sampleGames,1);
});
