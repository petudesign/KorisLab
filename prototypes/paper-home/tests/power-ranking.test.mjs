import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {POWER_PARAMS,powerRanking,resultsFromGames} from '../src/lib/powerRating.js';

test('the site uses the values that were locked before the test season',()=>{
 const lock=JSON.parse(readFileSync(new URL('../../../learning/forecasting/model-lock-power-rating-v1.json',import.meta.url)));
 for(const league of ['men','women'])for(const key of ['shrink','home','sigma'])assert.equal(POWER_PARAMS[league][key],lock.leagues[league].rating[key]);
});
test('ratings match the worked example, the same one the Python model is tested on',()=>{
 const [first,second]=powerRanking([{home:'A',away:'B',margin:10}],{shrink:1,home:0,sigma:10});
 assert.equal(first.team,'A');assert.ok(Math.abs(first.rating-10/3)<1e-9);assert.ok(Math.abs(second.rating+10/3)<1e-9);
 assert.ok(Math.abs(first.spread-1.2816*10*Math.sqrt(2/3))<1e-9);
});
test('beating a stronger schedule counts for more than the same margin against a weak one',()=>{
 const results=[{home:'S',away:'W',margin:30},{home:'S',away:'X',margin:30},{home:'A',away:'S',margin:5},{home:'B',away:'W',margin:5},{home:'W',away:'X',margin:0}];
 const rows=powerRanking(results,{shrink:1,home:0,sigma:10}),by=Object.fromEntries(rows.map(r=>[r.team,r]));
 assert.ok(by.A.rating>by.B.rating);assert.ok(by.A.schedule>by.B.schedule);
});
test('every league and season gives a full table from the site data',()=>{
 for(const [league,season] of [['men','2025-26'],['women','2025-26'],['men','2026-27'],['women','2026-27']]){
  const games=JSON.parse(readFileSync(new URL(`../public/data/${league}-${season}-matches.json`,import.meta.url))),results=resultsFromGames(games),rows=powerRanking(results,POWER_PARAMS[league]);
  assert.ok(rows.length>=6,league+season);
  assert.equal(rows.reduce((sum,row)=>sum+row.games,0),results.length*2);
  for(const row of rows)assert.ok(Number.isFinite(row.rating)&&row.spread>0&&row.wins<=row.games,row.team);
 }
});
