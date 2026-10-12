import {test} from 'node:test';
import assert from 'node:assert/strict';
import {longestScoringRuns} from '../src/lib/scoringRuns.js';
const teams=[{id:'h',home:true},{id:'a',home:false}];
test('runs continue across missed shots/period ends and stop only on opponent points',()=>{
 const replay={teams,events:[
 {points:0,home:0,away:0},{team_id:'h',points:3,home:3,away:0},{team_id:'a',points:0,home:3,away:0},
 {points:0,home:3,away:0,kind:'periodEnd'},{team_id:'h',points:2,home:5,away:0},
 {team_id:'a',points:2,home:5,away:2},{team_id:'a',points:3,home:5,away:5},
 {team_id:'h',points:2,home:7,away:5},{team_id:'h',points:2,home:9,away:5}
 ]};
 const [home,away]=longestScoringRuns(replay);
 assert.deepEqual(home.run,{teamId:'h',points:5,first:1,last:4,beforeHome:0,beforeAway:0});
 assert.deepEqual(away.run,{teamId:'a',points:5,first:5,last:6,beforeHome:5,beforeAway:0});
});
test('ties keep the first run and teams with no scoring have no run',()=>{
 const result=longestScoringRuns({teams,events:[{points:0,home:0,away:0}]});
 assert.ok(result.every(r=>r.run===null));
 const [h]=longestScoringRuns({teams,events:[{points:0,home:0,away:0},{points:2,team_id:'h',home:2,away:0},{points:1,team_id:'a',home:2,away:1},{points:2,team_id:'h',home:4,away:1}]});
 assert.equal(h.run.first,1);
});
