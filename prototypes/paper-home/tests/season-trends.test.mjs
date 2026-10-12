import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seasonTrend,phaseValue} from '../src/lib/seasonTrends.js';
const game=(id,date,score,opponent,stats={})=>({id,date,verified:true,teams:[{name:'A',side:'home',score,stats:{two_pm:4,three_pm:2,two_pa:10,three_pa:5,fta:4,offensive_rebounds:3,turnovers:2,...stats}},{name:'B',side:'away',score:opponent,stats:{two_pm:3,three_pm:1,two_pa:12,three_pa:4,fta:2,offensive_rebounds:2,turnovers:3}}]});
test('orders actual games, excludes future games and rolls only last five observations',()=>{
 const games=Array.from({length:6},(_,i)=>game(String(i),`2025-10-0${i+1}`,10*(i+1),20)).reverse();
 games.push({...game('future','2026-01-01',999,999),verified:false});
 const result=seasonTrend(games,'A','points');
 assert.equal(result.length,6);assert.equal(result[0].value,10);assert.equal(result[5].rolling,40);assert.equal(result[5].window,5);
 assert.equal(seasonTrend(games,'','points')[0].value,15);
});
test('shooting percentages pool attempts instead of averaging percentages',()=>{
 const rows=seasonTrend([game('a','2025-01-01',10,5,{two_pm:1,three_pm:0,two_pa:2,three_pa:0}),game('b','2025-01-02',10,5,{two_pm:0,three_pm:1,two_pa:0,three_pa:8})],'A','efg');
 assert.equal(rows[0].value,50);assert.equal(rows[1].value,18.75);assert.equal(rows[1].rolling,25);
});
test('net rating uses shared possessions; undefined inputs stay missing',()=>{
 const g=game('a','2025-01-01',80,70);const possessions=((15+.44*4-3+2)+(16+.44*2-2+3))/2;
 assert.equal(seasonTrend([g],'A','net')[0].value,1000/possessions);
 assert.equal(seasonTrend([g],'','net')[0].value,0);
 g.teams[0].stats.three_pa=null;assert.equal(seasonTrend([g],'A','net')[0].value,null);
 assert.equal(phaseValue({games:0},'points'),null);
 assert.equal(phaseValue({games:2,totals:{points:160}},'points'),80);
});
