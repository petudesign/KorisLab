import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recentResults} from '../src/lib/recentResults.js';
test('results rail uses the four newest scored games, excluding fixtures and missing scores',()=>{
 const game=(id,date,status='played',score=72)=>({id,date,status,verified:true,venue:'Arena',teams:[{side:'away',name:'Away',score:score===null?null:65},{side:'home',name:'Home',score}]});
 const input=[game('1','2026-01-01'),game('6','2026-02-06','fixture'),game('3','2026-01-03'),game('7','2026-02-07','played',null),game('2','2026-01-02'),game('5','2026-01-05'),game('4','2026-01-04')];
 const results=recentResults(input);
 assert.deepEqual(results.map(g=>g.id),['5','4','3','2']);
 assert.equal(results[0].home,'Home');assert.equal(results[0].value,'72 - 65');
 assert.equal(input[0].id,'1');
});
