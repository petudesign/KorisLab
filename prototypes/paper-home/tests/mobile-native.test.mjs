import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';

const root=new URL('../',import.meta.url),read=path=>readFileSync(new URL(path,root),'utf8');

test('the viewport keeps zoom and reaches the safe areas, with a theme colour per scheme',()=>{
 const html=read('index.html');
 assert.match(html,/viewport-fit=cover/);
 assert.doesNotMatch(html,/user-scalable|maximum-scale/);
 for(const scheme of ['light','dark'])assert.match(html,new RegExp(`theme-color" media="\\(prefers-color-scheme: ${scheme}\\)`));
});

test('nothing blocks scrolling or selects body text',()=>{
 for(const name of readdirSync(new URL('src/',root)).filter(file=>file.endsWith('.css'))){
  const css=read(`src/${name}`);
  assert.doesNotMatch(css,/touch-action:\s*none/,name);
  assert.doesNotMatch(css,/(^|\})\s*body\s*\{[^}]*user-select:\s*none/,name);
 }
});

test('every built hover rule is gated to devices that can hover',{skip:!existsSync(new URL('dist/client/assets/',root))},()=>{
 const dir=new URL('dist/client/assets/',root);
 const strip=css=>{let out='',at=0;const open=/@media\s*\(hover:\s*hover\)\s*and\s*\(pointer:\s*fine\)\s*\{/g;let match;while((match=open.exec(css))){out+=css.slice(at,match.index);let depth=1,i=open.lastIndex;for(;i<css.length&&depth;i++){if(css[i]==='{')depth++;else if(css[i]==='}')depth--;}at=i;open.lastIndex=i;}return out+css.slice(at);};
 const files=readdirSync(dir).filter(file=>file.endsWith('.css'));
 assert.ok(files.length>0);
 for(const file of files)assert.doesNotMatch(strip(readFileSync(new URL(file,dir),'utf8')),/:hover/,file);
});
