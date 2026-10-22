import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sortTableRows} from '../src/lib/tableSort.js';
const columns=[{key:'minutes',value:p=>p.minutes},{key:'name',value:p=>p.name}];
test('sorts numeric minutes in both directions without changing the source',()=>{
 const rows=[{minutes:9.5},{minutes:30.2},{minutes:12}];
 assert.deepEqual(sortTableRows(rows,columns,{key:'minutes',direction:'desc'}).map(r=>r.minutes),[30.2,12,9.5]);
 assert.deepEqual(sortTableRows(rows,columns,{key:'minutes',direction:'asc'}).map(r=>r.minutes),[9.5,12,30.2]);
 assert.deepEqual(rows.map(r=>r.minutes),[9.5,30.2,12]);
});
test('missing stats stay last regardless of direction',()=>{
 const rows=[{minutes:null},{minutes:0},{minutes:NaN},{minutes:15}];
 for(const direction of ['asc','desc'])assert.deepEqual(sortTableRows(rows,columns,{key:'minutes',direction}).slice(0,2).map(r=>r.minutes),direction==='asc'?[0,15]:[15,0]);
});
test('names use Finnish alphabetical order',()=>{
 assert.deepEqual(sortTableRows([{name:'Öhman'},{name:'Aalto'},{name:'Äijälä'}],columns,{key:'name',direction:'asc'}).map(r=>r.name),['Aalto','Äijälä','Öhman']);
});
