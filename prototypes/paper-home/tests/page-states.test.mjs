import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fetchMatches,visibleMatchState} from '../src/lib/matchRequest.js';
import {canReloadForRelease,isMissingPageFile,markReload} from '../src/lib/staleRelease.js';
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

test('a page file missing after a release reloads once, and only that error does',()=>{
 const store=new Map(),storage={getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,value)};
 for(const message of ['Failed to fetch dynamically imported module: https://x/assets/a.js','error loading dynamically imported module: https://x/a.js','Importing a module script failed.','Unable to preload CSS for /assets/a.css'])assert.ok(isMissingPageFile(new Error(message)),message);
 const missing=new Error('Failed to fetch dynamically imported module: /assets/HeroFog.js');
 assert.equal(canReloadForRelease(new TypeError('x is not a function'),{storage,now:1_000_000}),false);
 assert.equal(canReloadForRelease(undefined,{storage,now:1_000_000}),false);
 assert.equal(canReloadForRelease(missing,{storage,online:false,now:1_000_000}),false);
 assert.equal(canReloadForRelease(missing,{storage,now:1_000_000}),true);
 markReload(storage,1_000_000);
 assert.equal(canReloadForRelease(missing,{storage,now:1_030_000}),false);
 assert.equal(canReloadForRelease(missing,{storage,now:1_060_000}),true);
 assert.equal(canReloadForRelease(missing,{storage:{getItem(){throw new Error('blocked');}},now:1_000_000}),false);
});
