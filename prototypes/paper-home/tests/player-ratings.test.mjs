import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {playerRatings,ratingPool,playerTypes,ratingAxes,ratingFromScore,buildRatingReference,priorMinutes,reliability} from '../src/lib/playerRatings.js';

const player=(id,minutes,extra={})=>({id,name:id,team:'T',games:10,minutes,points:minutes*.4,twoPM:minutes*.1,twoPA:minutes*.2,threePM:minutes*.04,threePA:minutes*.12,
 ftm:minutes*.05,fta:minutes*.07,rebounds:minutes*.15,assists:minutes*.08,turnovers:minutes*.05,steals:minutes*.03,blocks:minutes*.01,...extra});
const season=(offset=0)=>Array.from({length:30},(_,i)=>player(`p${offset}-${i}`,200+i*10,{points:(200+i*10)*(.25+i*.008),rebounds:(200+i*10)*(.1+(i%7)*.02),assists:(200+i*10)*(.04+(i%5)*.015)}));
const reference=buildRatingReference([season(1),season(2)]);
const scoring=(p,players)=>playerRatings(p,players,reference).axes.find(a=>a.key==='scoring');

test('ratings stay between 1 and 99 and 50 is the typical regular',()=>{
 assert.equal(ratingFromScore(0),50);
 assert.equal(ratingFromScore(10),99);
 assert.equal(ratingFromScore(-10),1);
 assert.equal(ratingFromScore(null),null);
});

test('the fixed scale keeps the size of a lead, unlike a rank',()=>{
 const league=season(3),best=player('best',500,{points:500*.55}),second=player('second',500,{points:500*.48});
 const players=[...league,best,second];
 assert.equal(scoring(best,players).rank,1);
 assert.ok(scoring(best,players).rating-scoring(second,players).rating>=5);
});

test('short shifts are shrunk harder than full minutes at the same per-40 rate',()=>{
 assert.equal(priorMinutes(30),120);
 assert.equal(priorMinutes(7),360);
 const league=season(4),bench=player('bench',250,{games:30,points:250*.5}),starter=player('starter',250,{games:8,points:250*.5});
 assert.ok(scoring(starter,[...league,bench,starter]).rating>scoring(bench,[...league,bench,starter]).rating);
});

test('players outside the regulars get the minutes they still need instead of a rating',()=>{
 const hot=player('hot',30,{points:30});
 const result=playerRatings(hot,[...season(5),hot],reference);
 assert.equal(result.qualified,false);
 assert.equal(result.threshold,200);
 assert.ok(!ratingPool([...season(5),hot]).includes(hot));
});

test('missing values give no rating rather than zero, and reliability follows minutes',()=>{
 const league=season(6).map(p=>({...p,steals:null}));
 assert.equal(playerRatings(league[5],league,reference).axes.find(a=>a.key==='defense').rating,null);
 assert.equal(playerRatings(league[5],league,null),null);
 assert.deepEqual([reliability(150),reliability(300),reliability(600)],['early','moderate','settled']);
});

test('player types follow a few readable rules',()=>{
 assert.deepEqual(playerTypes({scoring:50,efficiency:50,threes:90,playmaking:40,rebounding:30,defense:50}),['shooter']);
 assert.deepEqual(playerTypes({scoring:40,efficiency:60,threes:20,playmaking:30,rebounding:85,defense:60}),['inside']);
 assert.deepEqual(playerTypes({scoring:65,efficiency:65,threes:65,playmaking:65,rebounding:65,defense:50}),['allround']);
 assert.deepEqual(playerTypes({scoring:50,efficiency:50,threes:50,playmaking:50,rebounding:50,defense:50}),['role']);
 assert.deepEqual(playerTypes({scoring:50,efficiency:null,threes:null,playmaking:null,rebounding:50,defense:50}),[]);
 // A league-leading scorer on 34.8 minutes a game was called a role player: scoring 73 fell just short of the old limit of 75.
 assert.deepEqual(playerTypes({scoring:73,efficiency:85,threes:48,playmaking:45,rebounding:34,defense:72}),['scorer']);
 assert.deepEqual(playerTypes({scoring:70,efficiency:50,threes:90,playmaking:80,rebounding:50,defense:50}),['shooter','playmaker']);
 assert.deepEqual(playerTypes({scoring:69,efficiency:50,threes:50,playmaking:50,rebounding:50,defense:50}),['role']);
 assert.equal(ratingAxes.length,6);
});

test('the committed reference covers both leagues from completed seasons only',()=>{
 const committed=JSON.parse(fs.readFileSync(new URL('../source/rating-reference.json',import.meta.url),'utf8'));
 for(const league of ['men','women']){
  assert.ok(committed[league].regulars>50);
  assert.ok(!committed[league].seasons.includes('2026-27'));
  for(const axis of ratingAxes)assert.ok(committed[league].scales[axis.key]?.scale>0,`${league} ${axis.key}`);
 }
});
