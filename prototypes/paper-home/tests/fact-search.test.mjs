import {test} from 'node:test';
import assert from 'node:assert/strict';
import {factIntent,resolveFactSearch,factTeamRows} from '../src/lib/factSearch.js';
const games=[{verified:true,id:'1',teams:[{id:'a',name:'BC Nokia',score:80,stats:{assists:10},players:[]},{id:'b',name:'ToPo',score:70,stats:{assists:8},players:[]}]}];
const context={leagueId:'women',seasonId:'2026-27',loadGames:async()=>games};
test('fact vocabulary recognizes standings, league leaders and metric operators without exact sentences',()=>{
 assert.equal(factIntent('sarjataulukko').kind,'standings');
 assert.equal(factIntent('kuka johtaa sarjaa').kind,'league-leader');
 assert.equal(factIntent('kenellä on eniten pisteitä').metric.key,'points');
 assert.equal(factIntent('fewest rebounds per game').ascending,true);
 assert.equal(factIntent('voittoja suhteessa käytettyyn 100 000 euroon').metric.key,'efficiency');
 assert.equal(factIntent('kuka voitti kauden 2526'),null);
});
test('requested season and league propagate to loading and output',async()=>{
 let scope;const result=await resolveFactSearch('miesten sarjataulukko 2025-26',{...context,loadGames:async(...args)=>{scope=args;return games;}});
 assert.deepEqual(scope,['2025-26','men']);assert.equal(result.season,'2025-26');assert.equal(result.leagueId,'men');
});
test('unknown names fall back instead of becoming league-wide answers',async()=>{
 assert.equal(await resolveFactSearch('tuntematon pelaaja pisteet',context),null);
 const result=await resolveFactSearch('kenellä on eniten pisteitä',context);
 assert.deepEqual(result.groups.map(g=>g.entity),['player','team']);assert.equal(result.groups[1].rows[0].value,80);
});
test('budget efficiency uses selected season wins and allows vocabulary components',async()=>{
 const result=await resolveFactSearch('monta voittoa suhteessa käytettyyn 100 000 euroon',context);
 assert.equal(result.metric.key,'efficiency');assert.equal(result.groups[0].rows.find(row=>row.name==='BC Nokia').wins,1);
 assert.equal(result.season,'2026-27');
});
test('unverified games and missing optional stats do not fabricate totals',()=>{
 assert.equal(factTeamRows([{...games[0],verified:false}]).length,0);
 assert.equal(factTeamRows(games)[0].rebounds,null);
 assert.equal(factTeamRows(games)[0].wins,1);
});
