import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fiveGamesSections,fiveGamesSummaryHtml,startGroups} from '../src/lib/fiveGamesArticle.js';

const data=JSON.parse(readFileSync(new URL('../source/analysis-five-games.json',import.meta.url)));
const wins=(league,test)=>data[league].rows.filter(test).map(r=>Math.round(r.restWinPct));

// The article's written claims are frozen text, so each one is checked against the frozen numbers.
test('claims about earlier seasons match the data',()=>{
 const weak=r=>r.wins<=1;
 assert.equal(Math.max(...wins('women',weak))<50,true);
 assert.equal(wins('women',weak).length,7);
 assert.equal(wins('men',weak).filter(v=>v>=50).length,3);
 assert.equal(wins('men',weak).length,5);
 assert.deepEqual(data.men.rows.filter(r=>r.team==='Helsinki Seagulls'&&r.wins===4).map(r=>Math.round(r.restWinPct)),[85,37]);
 const fourOne=wins('men',r=>r.wins===4);
 assert.deepEqual([Math.min(...fourOne),Math.max(...fourOne)],[37,85]);
 assert.deepEqual(wins('men',r=>r.wins===5),[63]);
 const big=wins('women',r=>r.margin>=16);
 assert.equal(big.length,4);
 assert.deepEqual([Math.min(...big),Math.max(...big)],[62,81]);
 assert.equal(data.women.teamSeasons+data.men.teamSeasons,43);
});

test('claims about the current season match the data',()=>{
 const row=(league,team)=>data[league].standings.find(r=>r.team===team);
 assert.deepEqual([row('women','Kouvottaret').wins,row('women','Kouvottaret').losses,row('women','Kouvottaret').lastSeason],[4,0,'3–21']);
 assert.equal(row('women','ToPo').diff,91);
 assert.equal(Math.max(...data.women.standings.map(r=>r.diff)),91);
 assert.equal(row('women','Espoo Basket Team').diff,33);
 assert.equal(row('women','Peli-Karhut').diff,-34);
 assert.equal(row('women','Vimpelin Veto').lastSeason,'18–6');
 assert.deepEqual([row('men','KTP-Basket').wins,row('men','KTP-Basket').losses],[7,0]);
 assert.deepEqual([row('men','Kipinä Basket').wins,row('men','Kipinä Basket').losses,row('men','Kipinä Basket').lastSeason],[6,1,undefined]);
});

test('both languages have the same structure and the summary is escaped',()=>{
 const shape=lang=>fiveGamesSections(data,lang).map(s=>[(s.paragraphs||[]).length,(s.bullets||[]).length,!!s.chart,s.table||null]);
 assert.deepEqual(shape('fi'),shape('en'));
 assert.equal(startGroups(data).length,2);
 const html=fiveGamesSummaryHtml(data,v=>v.replace(/</g,'&lt;'));
 assert.match(html,/<h2>Sama alku, eri loppu<\/h2>/);
 assert.match(html,/0,83/);
});
