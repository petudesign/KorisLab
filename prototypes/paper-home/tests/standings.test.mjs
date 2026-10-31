import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {leagueOrder} from '../src/lib/standings.js';

const game=(home,homeScore,away,awayScore)=>({verified:true,teams:[{name:home,score:homeScore},{name:away,score:awayScore}]});
const season=file=>JSON.parse(fs.readFileSync(new URL(`../public/data/${file}-matches.json`,import.meta.url)));
const within=(order,names)=>order.filter(name=>names.includes(name));

test('league points come first, before the size of the wins',()=>{
 assert.deepEqual(leagueOrder([game('A',60,'B',59),game('A',60,'C',59),game('B',100,'C',50)]),['A','B','C']);
});
test('two level teams are split by the games between them, not the season difference',()=>{
 const games=[game('A',61,'B',60),game('B',100,'C',50),game('C',90,'A',60)];
 assert.deepEqual(within(leagueOrder([...games,game('A',70,'D',60),game('B',70,'D',60),game('C',70,'D',60),game('B',90,'A',70),game('A',80,'B',70)]),['A','B']),['A','B']);
});
test('once one of three level teams is placed, the comparison restarts for the other two',()=>{
 // All 1–1 between them. A has the best difference; B and C are level on it, so their own game decides, despite C's better season difference.
 const games=[game('A',70,'B',60),game('B',66,'C',60),game('C',62,'A',60),game('C',100,'D',40),game('A',60,'D',50),game('B',60,'D',50)];
 assert.deepEqual(leagueOrder(games).slice(0,3),['A','B','C']);
});
test('uneven games between level teams use win rate, then point ratio',()=>{
 // Mid-season: A and B have played each other twice and C only once, all on one win.
 const games=[game('A',80,'B',70),game('B',80,'A',75),game('C',70,'A',60),game('B',90,'D',50),game('D',60,'A',50),game('D',60,'C',50)];
 const order=leagueOrder(games.concat(game('C',70,'D',65)));
 assert.equal(order.length,4);
 assert.ok(order.indexOf('C')<order.indexOf('A'),order.join());
});
test('only played, verified games count',()=>{
 assert.deepEqual(leagueOrder([{verified:false,teams:[{name:'A',score:80},{name:'B',score:60}]},{teams:[{name:'A'},{name:'B'}]}]),[]);
});
// Official order from Basket.fi's tables (tulospalvelu.basket.fi), read on 31 October 2026.
test('finished tables match the official order, including the three teams level on 18–6',()=>{
 assert.deepEqual(within(leagueOrder(season('women-2025-26')),['Peli-Karhut','Tampereen Pyrintö','Vimpelin Veto','Espoo Basket Team','HBA-Märsky','BC Nokia','Tapiolan Honka','Kouvottaret']),['Peli-Karhut','Tampereen Pyrintö','Vimpelin Veto','Espoo Basket Team','HBA-Märsky','BC Nokia','Tapiolan Honka','Kouvottaret']);
 const men=leagueOrder(season('men-2025-26'));
 const upper=['Salon Vilpas','Kauhajoki','KTP-Basket','Korihait','Tapiolan Honka','Helsinki Seagulls'],lower=['Kataja Basket','Tampereen Pyrintö','Bisons Loimaa','Lahti Basketball','Kouvot','Kobrat'];
 assert.deepEqual(within(men,upper),upper);assert.deepEqual(within(men,lower),lower);
 const upper2425=['Helsinki Seagulls','Kauhajoki','Kataja Basket','Salon Vilpas','Korihait','Bisons Loimaa'];
 assert.deepEqual(within(leagueOrder(season('men-2024-25')),upper2425),upper2425);
});
