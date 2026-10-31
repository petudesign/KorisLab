import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import test from 'node:test';
import {gameColors,clockAt,eventFlag,eventLine,eventPlace,flagAlign,indexAt,statsAt,storyChapters,topPlayers,wpPercent} from '../src/lib/gameStory.js';

const story=JSON.parse(readFileSync(new URL('../public/data/stories/men-2025-26-968748.json',import.meta.url)));

test('counting the whole replay reaches the box score totals that are in the events',()=>{
 const stats=statsAt(story.events,story.events.length-1);
 const scored=side=>Object.values(stats[side].players).reduce((sum,row)=>sum+row.pts,0);
 // Technical free throws are outside the possessions, so players can be short of the final by those points only.
 assert.ok(story.home.score-scored('h')>=0&&story.home.score-scored('h')<=3);
 assert.ok(story.away.score-scored('a')>=0&&story.away.score-scored('a')<=3);
 assert.equal(topPlayers(stats.h).length,5);
});
test('flags say what happened and never fall silent on a real event',()=>{
 assert.deepEqual(eventFlag({k:'3pt',m:true,n:'Mikael Aalto',s:'h'},'fi'),{big:'+3',tag:'Kolmonen',name:'M. Aalto',tone:'score'});
 assert.equal(eventFlag({k:'3pt',m:false,n:'Mikael Aalto',s:'h'},'en').big,'Miss');
 assert.equal(eventFlag({k:'foul',st:'technical',n:'A B',s:'a'},'fi').big,'Tekninen virhe');
 assert.equal(eventFlag({k:'period'},'fi'),null);
 for(const event of story.events)if(event.s){assert.ok(eventFlag(event,'fi'),event.k);assert.ok(eventFlag(event,'en'),event.k);assert.ok(eventLine(event,'fi',{h:'A',a:'B'}),event.k);}
});
test('a shot keeps its real place and a rebound goes to the basket being attacked',()=>{
 const ends={1:'L'};
 assert.deepEqual(eventPlace({k:'2pt',x:12,y:40,p:1,s:'h'},{ends}),{x:12,y:40,end:'L',exact:true});
 assert.equal(eventPlace({k:'offensive_rebound',p:1,s:'h'},{ends}).end,'L');
 assert.equal(eventPlace({k:'defensive_rebound',p:1,s:'h'},{ends}).end,'R');
 assert.equal(eventPlace({k:'free_throw',p:1,s:'a'},{ends}).end,'R');
});
test('the clock never runs ahead of the next event and the index follows time',()=>{
 const events=[{t:0,p:1,c:600},{t:30,p:1,c:570},{t:31.5,p:1,c:570},{t:40,p:1,c:560}];
 assert.equal(indexAt(events,31),1);assert.equal(indexAt(events,1e4),3);
 assert.equal(clockAt(events,1,31),570);assert.equal(clockAt(events,0,15),585);
});
test('every chapter is in game order and starts inside the game, in both languages',()=>{
 for(const lang of ['fi','en']){const chapters=storyChapters(story,lang);
  chapters.forEach((chapter,i)=>{assert.ok(chapter.text.length>10);assert.ok(chapter.at>=(chapters[i-1]?.at??0));assert.ok(chapter.at<=story.duration);});}
});
test('only a finished game shows 0 or 100 percent',()=>{
 assert.equal(wpPercent(.999),99);assert.equal(wpPercent(.001),1);assert.equal(wpPercent(1),100);assert.equal(wpPercent(0),0);assert.equal(wpPercent(.634),63);
});
test('a flag opens inward at the edge of the court',()=>{
 assert.equal(flagAlign(5),'start');assert.equal(flagAlign(95),'end');assert.equal(flagAlign(50),'middle');
 assert.equal(flagAlign(10,true),'start');assert.equal(flagAlign(90,true),'end');assert.equal(flagAlign(50,true),'middle');
});
test('every team has a colour and the two teams of any game can be told apart',()=>{
 const colors=JSON.parse(readFileSync(new URL('../source/team-colors.json',import.meta.url))),names=Object.keys(colors);
 for(const home of names)for(const away of names){if(home===away)continue;const game=gameColors(home,away);
  assert.ok(game.home&&game.away,`${home} ${away}`);assert.notEqual(game.home,game.away,`${home} ${away}`);assert.ok(['#111113','#ffffff'].includes(game.awayInk));}
 const manifest=JSON.parse(readFileSync(new URL('../source/game-stories.json',import.meta.url)));
 for(const [scope,ids] of Object.entries(manifest))for(const id of ids){const game=JSON.parse(readFileSync(new URL(`../public/data/stories/${scope}-${id}.json`,import.meta.url)));assert.ok(colors[game.home.name]&&colors[game.away.name],game.home.name+game.away.name);}
});
