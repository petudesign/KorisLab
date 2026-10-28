import {test} from 'node:test';
import assert from 'node:assert/strict';
import {playerRatings,ratingFromPool,ratingPool,playerTypes,ratingAxes} from '../src/lib/playerRatings.js';

const player=(id,minutes,extra={})=>({id,name:id,team:'T',games:10,minutes,points:minutes*.4,twoPM:minutes*.1,twoPA:minutes*.2,threePM:minutes*.04,threePA:minutes*.12,
 ftm:minutes*.05,fta:minutes*.07,rebounds:minutes*.15,assists:minutes*.08,turnovers:minutes*.05,steals:minutes*.03,blocks:minutes*.01,...extra});
const league=Array.from({length:20},(_,i)=>player(`p${i}`,200+i*20,{points:(200+i*20)*(.25+i*.012)}));

test('ratings stay between 1 and 99, so nobody is rated 100',()=>{
 assert.equal(ratingFromPool(10,[1,2,3,4,5]),99);
 assert.equal(ratingFromPool(0,[1,2,3,4,5]),1);
 assert.equal(ratingFromPool(3,[1,2,3,4,5]),50);
 const best=playerRatings(league[19],league).axes.find(a=>a.key==='scoring').rating;
 assert.ok(best<=99&&best>=95);
});

test('missing values and tiny leagues give no rating rather than zero',()=>{
 assert.equal(ratingFromPool(null,[1,2,3,4,5]),null);
 assert.equal(ratingFromPool(3,[1,2,3]),null);
 const noDefense=league.map(p=>({...p,steals:null}));
 assert.equal(playerRatings(noDefense[5],noDefense).axes.find(a=>a.key==='defense').rating,null);
});

test('players outside the regulars get the minutes they still need instead of a rating',()=>{
 const hot=player('hot',30,{points:30});
 const result=playerRatings(hot,[...league,hot]);
 assert.equal(result.qualified,false);
 assert.equal(result.threshold,200);
 assert.ok(!ratingPool([...league,hot]).includes(hot));
});

test('the same scoring rate rates higher with more minutes behind it',()=>{
 const pool=[...league,player('short',230,{points:230*.6}),player('long',560,{points:560*.6})];
 const rating=id=>playerRatings(pool.find(p=>p.id===id),pool).axes.find(a=>a.key==='scoring').rating;
 assert.ok(rating('long')>rating('short'));
});

test('player types follow a few readable rules',()=>{
 assert.deepEqual(playerTypes({scoring:50,efficiency:50,threes:90,playmaking:40,rebounding:30,defense:50}),['shooter']);
 assert.deepEqual(playerTypes({scoring:40,efficiency:60,threes:20,playmaking:30,rebounding:85,defense:60}),['inside']);
 assert.deepEqual(playerTypes({scoring:70,efficiency:70,threes:70,playmaking:70,rebounding:70,defense:50}),['allround']);
 assert.deepEqual(playerTypes({scoring:50,efficiency:50,threes:50,playmaking:50,rebounding:50,defense:50}),['role']);
 assert.deepEqual(playerTypes({scoring:50,efficiency:null,threes:null,playmaking:null,rebounding:50,defense:50}),[]);
 assert.equal(ratingAxes.length,6);
});
