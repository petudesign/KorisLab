import {test} from 'node:test';
import assert from 'node:assert/strict';
import {teamResourceRows,rankTeamResources,resourceInfoForSeason} from '../src/lib/teamResources.js';
const g=(a,b,verified=true)=>({verified,teams:[{name:'A',score:a},{name:'B',score:b}]});
test('wins per euro uses the selected-season budget, verified scores and observed games',()=>{
 const info={teams:{A:{budget:900000,payroll:600000,previousBudget:100000},B:{budget:50000,payroll:30000,previousBudget:50000}}};
 const rows=teamResourceRows(info,[g(80,70),g(70,80),g(81,70),g(200,0,false),g(null,null)]);
 assert.equal(rows[0].games,3);assert.equal(rows[0].wins,2);assert.equal(rows[0].losses,1);assert.equal(rows[0].efficiency,2/9);
 assert.equal(rows[1].efficiency,2);assert.equal(rankTeamResources(rows,'efficiency')[0].rank,1);assert.equal(rankTeamResources(rows,'efficiency')[1].rank,2);
});
test('unknown or zero budgets and absent results never turn into cheap wins or fabricated zero records',()=>{
 const rows=teamResourceRows({teams:{A:{budget:0,previousBudget:100},B:{budget:null,previousBudget:null},C:{budget:200,previousBudget:10000}}},[g(80,70)]);
 assert.equal(rows[0].efficiency,null);assert.equal(rows[1].efficiency,null);assert.equal(rows[2].games,null);assert.equal(rows[2].efficiency,null);
 const ranked=rankTeamResources(rows,'budget');assert.deepEqual(ranked.map(r=>r.name),['C','A','B']);assert.equal(ranked[2].rank,null);assert.equal(rows[0].name,'A');
});

test('historical resource view uses the figures for that year and includes only that season’s clubs',()=>{
 const packs={'2026-27':{sourceUrl:'official',teams:{A:{budget:900000,payroll:600000,previousBudget:100000,previousPayroll:50000},Promoted:{budget:50000}}}};
 const old=resourceInfoForSeason(packs,'2025-26',['A','Departed']);
 assert.equal(old.teams.A.budget,100000);assert.equal(old.teams.A.payroll,50000);
 assert.equal(old.teams.Departed.budget,null);assert.equal(old.teams.Promoted,undefined);
 assert.equal(resourceInfoForSeason(packs,'2026-27',['A']).teams.A.budget,900000);
 assert.equal(resourceInfoForSeason(packs,'2024-25',['A']),null);
});
