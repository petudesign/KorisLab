import {test} from 'node:test';
import assert from 'node:assert/strict';
import {overviewRecentPoints} from '../src/lib/overviewPoints.js';
const game=(id,date,h,a,verified=true)=>({id,date,verified,teams:[{id:'home',name:'Koti',side:'home',score:h},{id:'away',name:'Vieras',side:'away',score:a}]});
test('overview points show actual recent games chronologically, not a curve between season team averages',()=>{
 const games=[game('6','2026-03-06',90,70),game('3','2026-03-03',60,90),game('1','2026-03-01',50,70),game('5','2026-03-05',65,55),game('4','2026-03-04',100,80),game('2','2026-03-02',75,65),game('7','2026-03-07',null,null,false)];
 const rows=overviewRecentPoints(games);
 assert.deepEqual(rows.map(r=>r.id),['2','3','4','5','6']);
 assert.deepEqual(rows.map(r=>r.points),[70,75,90,60,80]);
 assert.deepEqual(overviewRecentPoints(games,'away').map(r=>r.points),[65,90,80,55,70]);
 assert.equal(games[0].id,'6');
});
test('missing results and unplayed fixtures do not become zero points',()=>{
 assert.deepEqual(overviewRecentPoints([game('1','2026-01-01',null,80),game('2','2026-02-01',0,0,false)]),[]);
 assert.deepEqual(overviewRecentPoints([game('1','2026-01-01',80,70)],'unknown'),[]);
});
