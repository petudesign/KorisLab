import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parsePlayerShotIndex} from '../src/lib/playerShots.ts';
import {parseAssistStats,assistValues} from '../src/lib/assistStats.ts';
import {projectPlayerShot} from '../src/lib/shotProjection.js';
const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url)));
const manifest=read('../source/player-analysis.json');
for(const [key,assets] of Object.entries(manifest))test(`${key}: player shot and assist assets preserve original source data`,()=>{
 const [league,start,end]=key.split('-'),season=`${start}-${end}`,prefix=league==='men'?'korisliiga/':'';
 for(const [kind,url] of Object.entries(assets)){
  const source=read(`../../../web/public/${prefix}${kind==='shots'?'player-shots':'assists'}-${season}.json`),copy=read('../public'+url);
  assert.deepEqual(copy,source);
  if(kind==='shots'){
   const data=parsePlayerShotIndex(copy,season);
   for(const row of data.players)for(const shot of row.shots){
    const p=projectPlayerShot(shot);
    if(shot.x==null||shot.y==null)assert.equal(p,null);else assert.ok(p.x>=0&&p.x<=300&&p.y>=0&&p.y<=280);
   }
  }else{
   const data=parseAssistStats(copy,season);
   for(const row of data.players){
    const values=assistValues(row);
    assert.equal(values.points,row.two*2+row.three*3);
    assert.equal(row.assists,values.baskets+row.free_throw+row.unlinked);
   }
  }
 }
});
test('half court rotates both attacking directions to the same basket without changing location',()=>{
 assert.deepEqual(projectPlayerShot({x:10,y:30}),projectPlayerShot({x:90,y:70}));
 assert.deepEqual(projectPlayerShot({x:10,y:30},'full'),{x:56,y:90});
 assert.equal(projectPlayerShot({x:null,y:30}),null);
});
test('unlinked and free-throw assists do not inflate created field-goal points',()=>{
 assert.deepEqual(assistValues({two:3,three:2,free_throw:5,unlinked:4}),{baskets:5,points:12,pointsPerAssist:2.4,threeShare:40});
 assert.deepEqual(assistValues({two:0,three:0,free_throw:2,unlinked:0}),{baskets:0,points:0,pointsPerAssist:null,threeShare:null});
 assert.throws(()=>parseAssistStats({schema_version:'0.1',season_id:'2025-26',expected_games:1,verified_games:1,match_ids:['1'],players:[{id:'p',games:1,assists:5,two:1,three:1,free_throw:1,unlinked:0}]},'2025-26'));
});
