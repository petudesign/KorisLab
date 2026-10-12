import {test} from 'node:test';
import assert from 'node:assert/strict';
import {teamSeasonContext,teamSeasonInfo} from '../src/lib/teamSeasonInfo.js';

const player=(id,name,minutesValue=20)=>({id,name,minutesValue});
const team=(name,score,players=[])=>({id:name,name,score,players});
const game=(id,date,teams,verified=true)=>({id,date,teams,verified});

test('team season context uses verified results and finds margin extremes and a provisional record',()=>{
 const games=[
  game('g1','2026-10-01',[team('A',90),team('B',80)]),
  game('g2','2026-10-04',[team('B',100),team('A',75)]),
  game('g3','2026-10-06',[team('A',101),team('C',100)]),
  game('g4','2026-10-08',[team('B',80),team('C',70)]),
  game('scheduled','2026-11-06',[team('A',null),team('D',null)],false),
  game('unverified','2026-09-30',[team('A',200),team('D',20)],false),
 ];
 const context=teamSeasonContext(games,null,'A');
 assert.equal(context.games,3);
 assert.equal(context.biggestWin.id,'g1');
 assert.equal(context.biggestLoss.id,'g2');
 assert.equal(context.currentRank,2);
 assert.equal(context.standingsCount,3);
 assert.equal(context.wins,2);
 assert.equal(context.losses,1);
});

test('roster comparison counts appearances without treating missing records as confirmed transfers',()=>{
 const current=[game('c1','2026-10-01',[
  team('A',80,[player('p1','Returning',30),player('p2','Moved in',20),player('p3','First record',12),player('p0','No minutes',0)]),
  team('B',70),
 ])];
 const previous=[game('p1','2025-10-01',[
  team('A',78,[player('p1','Returning',25),player('p4','Not seen this season',10)]),
  team('B',74,[player('p2','Moved in',30)]),
 ])];
 const roster=teamSeasonContext(current,previous,'A').roster;
 assert.deepEqual(roster,{current:3,previous:2,returning:1,joined:2,movedIn:1,newToLeagueData:1,notYetSeen:1});
});

test('official season briefs identify both leagues and use team payroll costs as the published term',()=>{
 assert.ok(teamSeasonInfo.women['2026-27'].sourceUrl.includes('basket.fi'));
 assert.ok(teamSeasonInfo.men['2026-27'].sourceUrl.includes('basket.fi'));
 assert.equal(teamSeasonInfo.women['2026-27'].teams['HBA-Märsky'].budget,null);
 assert.equal(teamSeasonInfo.men['2026-27'].teams['Salon Vilpas'].payroll,495800);
});
