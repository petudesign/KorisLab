import {test} from 'node:test';
import assert from 'node:assert/strict';
import {discoveryQualification,seasonOutliers,playersToWatch} from '../src/lib/playerDiscoveries.js';
const player=(id,overrides={})=>({id,name:id,team:'Team',games:3,minutes:80,points:0,rebounds:0,assists:0,steals:0,twoPA:0,threePA:0,twoPM:0,threePM:0,...overrides});

test('playing-time growth alone is not mistaken for improved per-40 production',()=>{
 const prior=player('A',{games:10,minutes:150,assists:30,rebounds:40});
 const current=player('A',{games:3,minutes:90,assists:18,rebounds:24});
 const result=seasonOutliers([current],[prior]);
 assert.equal(result.rows.length,1);assert.equal(result.rows[0].metric,'minutes');
 assert.equal(result.rows[0].delta,15);assert.equal(result.rows[0].identity,'id');
});
test('missing history and ambiguous identical names cannot become season comparisons',()=>{
 const old=player('old',{name:'Same Name',games:10,minutes:300,assists:12});
 const a=player('newA',{name:'Same Name',assists:30}),b=player('newB',{name:'Same Name',assists:20});
 assert.deepEqual(seasonOutliers([a,b],[old]).rows,[]);
 assert.deepEqual(seasonOutliers([a],[]).rows,[]);
 assert.equal(seasonOutliers([a],[old]).rows[0].identity,'name');
 assert.deepEqual(seasonOutliers([a],[{...old,games:7}]).rows,[]);
});
test('tiny perfect shooting samples are excluded and the peer average pools attempts',()=>{
 const peers=Array.from({length:8},(_,i)=>player(`P${i}`,{twoPA:40+i*10,twoPM:18+i*6}));
 const tiny=player('Tiny',{twoPA:3,twoPM:3});
 const result=playersToWatch([...peers,tiny]);
 assert.ok(result.rows.every(r=>r.player.id!=='Tiny'));
 const shooting=result.rows.find(r=>r.metric==='efg');assert.ok(shooting);
 const expected=100*peers.reduce((s,p)=>s+p.twoPM,0)/peers.reduce((s,p)=>s+p.twoPA,0);
 assert.ok(Math.abs(shooting.average-expected)<1e-10);
 assert.equal(shooting.cohort,8);
});
test('watch picks have qualifying top-15% ranks, independent of points and with no duplicates',()=>{
 const peers=Array.from({length:12},(_,i)=>player(`P${i}`,{assists:6+i,rebounds:12+i,steals:3+i,twoPA:40,twoPM:12+i,points:1000-i*100}));
 const result=playersToWatch(peers);
 assert.ok(result.rows.length>0);
 assert.equal(new Set(result.rows.map(r=>r.player.id)).size,result.rows.length);
 assert.ok(result.rows.every(r=>r.rank/r.cohort<=.15));
 const changed=playersToWatch(peers.map((p,i)=>({...p,points:i*3})));
 assert.deepEqual(changed.rows.map(r=>[r.player.id,r.metric]),result.rows.map(r=>[r.player.id,r.metric]));
});
test('qualification grows with the season and low-minute one-game appearances stay out',()=>{
 assert.deepEqual(discoveryQualification([player('A',{games:24})]),{games:8,minutes:120,early:false});
 assert.deepEqual(discoveryQualification([player('A',{games:3})]),{games:2,minutes:30,early:true});
 const peers=Array.from({length:6},(_,i)=>player(`P${i}`,{assists:6+i}));
 const low=player('Low',{games:1,minutes:4,assists:20});
 assert.ok(playersToWatch([...peers,low]).rows.every(r=>r.player.id!=='Low'));
});
test('up and down changes are both shown without repeating a player',()=>{
 const old=Array.from({length:4},(_,i)=>player(`P${i}`,{games:10,minutes:250,assists:30}));
 const current=old.map((p,i)=>({...p,games:3,minutes:90,assists:i<2?30:6}));
 const result=seasonOutliers(current,old);
 assert.ok(result.rows.some(r=>r.direction==='up'));
 assert.ok(result.rows.some(r=>r.direction==='down'));
 assert.equal(new Set(result.rows.map(r=>r.player.id)).size,result.rows.length);
});
