import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseReplay,eventAtTime,replayMoments} from '../src/lib/replayStats.ts';
import {parseShotChart,filterShots,summarizeShots} from '../src/lib/shotStats.ts';
const root=new URL('../',import.meta.url),manifest=JSON.parse(readFileSync(new URL('source/match-analysis.json',root)));
const read=url=>JSON.parse(readFileSync(new URL('public'+url,root)));
test('every imported match replay/shot asset preserves original source and passes original validation',()=>{
 for(const [key,entry] of Object.entries(manifest)){
  const [league,id]=key.split('-');
  for(const kind of ['shots','replays'])if(entry[kind]){
   const data=read(entry[kind]),original=JSON.parse(readFileSync(new URL(`../../web/public/${league==='men'?'korisliiga/':''}${kind}/${id}.json`,root)));
   assert.deepEqual(data,original);
   if(kind==='replays')parseReplay(data,id,entry.season);else parseShotChart(data,id);
  }
 }
});
test('timeline seeking, turning points and shot filters use actual game data',()=>{
 const entry=manifest['women-968971'],replay=parseReplay(read(entry.replays),'968971','2025-26');
 assert.equal(eventAtTime(replay.events,replay.duration),replay.events.length-1);
 assert.equal(replay.events.at(-1).home,91);assert.equal(replay.events.at(-1).away,85);
 const moments=replayMoments(replay);assert.ok(moments.changes>0);
 const shots=parseShotChart(read(entry.shots),'968971'),team=shots.teams[0].id;
 const filtered=filterShots(shots.shots,{team,player:'all',period:'1',type:'3'});
 assert.ok(filtered.length);assert.ok(filtered.every(s=>s.team_id===team&&s.period===1&&s.points===3));
 assert.equal(summarizeShots(filtered).made,filtered.filter(s=>s.made).length);
 assert.throws(()=>parseReplay(replay,'wrong','2025-26'));
});
