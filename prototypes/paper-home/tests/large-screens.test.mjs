import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';

const root=new URL('../',import.meta.url),read=path=>readFileSync(new URL(path,root),'utf8');

test('big screens scale in rising steps and 1920 × 1080 stays at its designed size',()=>{
 const steps=[...read('src/large-screens.css').matchAll(/min-width:(\d+)px\) and \(min-height:(\d+)px\)\)\{:root\{--ui-zoom:([\d.]+)\}/g)].map(m=>m.slice(1).map(Number));
 assert.ok(steps.length>=4);
 assert.ok(steps[0][0]>1920);
 for(let i=1;i<steps.length;i++)assert.ok(steps[i][0]>steps[i-1][0]&&steps[i][2]>steps[i-1][2]);
});

test('viewport heights account for page zoom, or the app shell would overflow on big screens',()=>{
 for(const name of readdirSync(new URL('src/',root)).filter(file=>file.endsWith('.css'))){
  for(const match of read(`src/${name}`).matchAll(/(?:^|[;{])\s*(?:max-)?height:([^;}]*\bdvh[^;}]*)/gm))assert.match(match[1],/--ui-zoom|145px/,`${name}: ${match[1]}`);
 }
});
