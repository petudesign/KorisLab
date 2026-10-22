import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fetchMatches,visibleMatchState} from '../src/lib/matchRequest.js';
test('match requests distinguish failed HTTP and malformed data from a valid empty season',async()=>{
 await assert.rejects(fetchMatches('/bad',undefined,async()=>({ok:false})),/request failed/);
 await assert.rejects(fetchMatches('/bad',undefined,async()=>({ok:true,json:async()=>({games:[]})})),/Invalid/);
 assert.deepEqual(await fetchMatches('/empty',undefined,async()=>({ok:true,json:async()=>[]})),[]);
});
test('request forwards cancellation signal and allows a failed fetch to be retried',async()=>{
 const controller=new AbortController();let calls=0;
 const request=async(url,options)=>{assert.equal(options.signal,controller.signal);if(++calls===1)throw Error('Offline');return {ok:true,json:async()=>[{id:'1'}]};};
 await assert.rejects(fetchMatches('/games',controller.signal,request),/Offline/);
 assert.deepEqual(await fetchMatches('/games',controller.signal,request),[{id:'1'}]);
});
test('switching season never exposes another season data or error',()=>{
 const old={url:'/old',games:[{id:'old'}],error:true};const cache=new Map([['/cached',[]]]);
 assert.deepEqual(visibleMatchState(old,'/new',cache),{games:null,error:false});
 assert.deepEqual(visibleMatchState(old,'/cached',cache),{games:[],error:false});
 assert.equal(visibleMatchState(old,'/old',cache),old);
});
