import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyzeChange,changeRecords,summarizeChangeSample,previousPlayerIdentity,changeContextGames} from '../src/lib/changeAnalysis.js';
const row=(i,patch={})=>({id:String(i),date:`2026-01-${String(i+1).padStart(2,'0')}`,team:'A',opponent:'B',minutes:20,starts:1,points:10,attempts:10,effectiveMade:5,threeAttempts:2,rebounds:4,assists:2,turnovers:3,offensiveRebounds:2,opponentDefensiveRebounds:8,possessions:70,allowed:65,...patch});
test('last five and earlier samples are disjoint and require at least eight appearances',()=>{
 const data=Array.from({length:12},(_,i)=>row(i));const a=analyzeChange(data,[]);
 assert.equal(a.ready,true);assert.equal(a.recent.length,5);assert.equal(a.earlier.length,7);
 assert.equal(a.recent.some(r=>a.earlier.some(b=>b.id===r.id)),false);
 assert.equal(analyzeChange(data.slice(0,7),[]).ready,false);
});
test('extra minutes alone produce a role-context summary, not a per-40 improvement',()=>{
 const old=Array.from({length:8},(_,i)=>row(i));const current=Array.from({length:3},(_,i)=>row(i,{minutes:30,points:15,attempts:15,effectiveMade:7.5}));
 const a=analyzeChange(current,old,{mode:'season'});assert.equal(a.ready,true);
 assert.equal(a.rows.find(r=>r.key==='points40').delta,0);assert.match(a.summary,/peliajan kanssa/);
});
test('shooting and efficiency pool denominators rather than averaging game percentages',()=>{
 const totals=summarizeChangeSample([row(0,{attempts:2,effectiveMade:2,possessions:50,points:50}),row(1,{attempts:18,effectiveMade:6,possessions:100,points:80})],'team');
 assert.equal(totals.efg,40);assert.equal(totals.offensive,100*130/150);
});
test('missing statistics never become zero and sparse shooting samples cannot yield an eFG claim',()=>{
 const old=Array.from({length:8},(_,i)=>row(i)),current=[row(0,{attempts:3}),row(1,{attempts:3})];
 const a=analyzeChange(current,old,{mode:'season'});assert.equal(a.rows.find(r=>r.key==='efg').delta,null);
 assert.equal(summarizeChangeSample([row(0,{opponentDefensiveRebounds:null})],'team').orb,null);
 assert.equal(summarizeChangeSample([row(0,{turnovers:null})],'team').turnovers,null);
});
test('player identity uses IDs and rejects ambiguous names; zero-minute games are excluded',()=>{
 const stats={two_pa:2,three_pa:0,fta:0,offensive_rebounds:1,turnovers:1};
 const game={id:'1',verified:true,date:'2026-01-01',teams:[{name:'A',score:60,stats,players:[{id:'a',name:'Name',minutesValue:0,stats},{id:'b',name:'Name',minutesValue:20,stats}]},{name:'B',score:50,stats,players:[]}]};
 assert.equal(previousPlayerIdentity([game],{id:'new',name:'Name'}),null);
 assert.equal(previousPlayerIdentity([game],{id:'a',name:'Changed name'}),'a');
 assert.equal(changeRecords([game],{playerId:'a'}).length,0);
 assert.equal(changeRecords([{...game,verified:false}],{teamName:'A'}).length,0);
});
test('opening comparison takes exactly the first five appearances from each season without leaking later games',()=>{
 const previous=Array.from({length:10},(_,i)=>row(i,{points:i<5?10:100}));
 const current=Array.from({length:9},(_,i)=>row(i,{points:i<5?20:200,minutes:10}));
 const a=analyzeChange(current,previous,{mode:'firstFive'});
 assert.equal(a.ready,true);assert.equal(a.current.games,5);assert.equal(a.baseline.games,5);
 assert.equal(a.current.points,20);assert.equal(a.baseline.points,10);
 assert.equal(a.recent.at(-1).id,'4');assert.equal(a.earlier.at(-1).id,'4');
 assert.equal(analyzeChange(current.slice(0,4),previous,{mode:'firstFive'}).ready,false);
 assert.equal(analyzeChange(current,previous.slice(0,4),{mode:'firstFive'}).ready,false);
});

test('opening player context excludes later team results and undated games',()=>{
 const games=[{id:'early',date:'2026-01-01'},{id:'cutoff',date:'2026-01-05'},{id:'late',date:'2026-02-01'},{id:'unknown'}];
 assert.deepEqual(changeContextGames(games,[row(4)],'firstFive').map(g=>g.id),['early','cutoff']);
 assert.equal(changeContextGames(games,[row(4)],'season'),games);
});
