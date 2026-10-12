import {test} from 'node:test';
import assert from 'node:assert/strict';
import {leaguePercentile,leagueRank,radarProfile,radarAxes} from '../src/lib/matchupRadar.js';
test('radar ranks use a common league scale and invert lower-is-better axes',()=>{
 assert.equal(leaguePercentile(90,[80,90,100]),50);
 assert.equal(leaguePercentile(80,[80,90,100],true),100);
 assert.equal(leaguePercentile(100,[80,90,100],true),0);
 assert.equal(leaguePercentile(0,[0,1,2]),0);
});
test('ties share midpoint rank and missing values are never represented as zero',()=>{
 assert.equal(leaguePercentile(4,[4,4,4]),50);
 assert.equal(leaguePercentile(4,[2,4,4,6]),50);
 assert.equal(leaguePercentile(null,[0,1,2]),null);
 assert.equal(leaguePercentile(0,[null,0]),null);
 assert.equal(leaguePercentile(0,[null,0,2]),0);
 const profiles=radarProfile({values:{ortg:90}},[{values:{ortg:90}},{values:{ortg:100}}]);
 assert.equal(profiles[0].percentile,0);assert.equal(profiles[1].value,null);assert.equal(profiles[1].percentile,null);
 assert.equal(radarAxes.length,6);
});

test('offensive board share and turnovers use pooled opponent and possession denominators',async()=>{
 const {comparisonValues}=await import('../src/lib/matchupStats.ts');
 const own={points:80,two_pm:25,three_pm:5,two_pa:50,three_pa:20,fta:10,offensive_rebounds:10,defensive_rebounds:25,turnovers:15,assists:20};
 const opponent={...own,points:70,defensive_rebounds:30};
 const values=comparisonValues(own,1,opponent);
 assert.equal(values.orbPct,25);
 assert.ok(Math.abs(values.tovPct-1500/79.4)<1e-9);
 assert.equal(values.astTo,20/15);
 assert.equal(comparisonValues({...own,turnovers:null},1,opponent).tovPct,null);
 assert.equal(comparisonValues(own,1).orbPct,null);
});

test('display ranks show ordinal league position, share ties, and handle inverse metrics',()=>{
 assert.equal(leagueRank(90,[80,90,100]),2);
 assert.equal(leagueRank(80,[80,90,100],true),1);
 assert.equal(leagueRank(90,[90,90,100]),2);
 assert.equal(leagueRank(null,[0,1,2]),null);
 const profile=radarProfile({values:{ortg:90}},[{values:{ortg:90}},{values:{ortg:100}},{values:{ortg:null}}]);
 assert.equal(profile[0].rank,2);assert.equal(profile[0].count,2);
});
