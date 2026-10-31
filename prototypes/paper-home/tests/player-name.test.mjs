import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {playerDisplayName as shown} from '../src/lib/playerName.ts';
import {withShownNames} from '../src/lib/gameStory.js';

test('a name the source already spells correctly stays as it is',()=>{
 for(const name of ['Jalen McCoy',"De'Vion Harmon","Ze'Rik Onyema","D'Marco Dunn","Viont'e Daniels",'Craig LeCesne','KeShawn Curry','Gage Davis-McMurrin','Thomas Gipson III','Wesley Cardet Jr.','Emma Lampén'])assert.equal(shown(name),name);
});
test('names in capitals become normal names',()=>{
 for(const [raw,name] of [['TOPIAS KUUKKANEN','Topias Kuukkanen'],['EMMA LAMPÉN','Emma Lampén'],['SANNI NELSKYLÄ','Sanni Nelskylä'],['JALEN MCCOY','Jalen McCoy'],["DE'VION HARMON","De'Vion Harmon"],["VIONT'E DANIELS","Viont'e Daniels"],["SHAQ O’NEILL","Shaq O’Neill"],['THOMAS GIPSON III','Thomas Gipson III'],['AJ HARRIS II','AJ Harris II']])assert.equal(shown(raw),name);
});
test('hyphenated names capitalise each part',()=>{
 for(const [raw,name] of [['TINO YLI-JUNNILA','Tino Yli-Junnila'],['JUHO-MATTI HENTTONEN','Juho-Matti Henttonen'],['Linda-Lotta LEHTORANTA','Linda-Lotta Lehtoranta'],['Lotta Vehka-aho','Lotta Vehka-Aho'],['Lotta Vehka-Aho','Lotta Vehka-Aho'],['TYLER MCCLIMENT-CALL','Tyler McCliment-Call']])assert.equal(shown(raw),name);
});
test('the two spellings the source uses for one person come out the same',()=>{
 for(const [a,b] of [['Aj Harris II','AJ Harris II'],['Dj Jeffries','DJ Jeffries'],['Erik SAJANTILA','Erik Sajantila']])assert.equal(shown(a),shown(b));
});
test('empty names stay empty, and ordinary names ending in j are untouched',()=>{
 assert.equal(shown(null),'');assert.equal(shown('  '),'');assert.equal(shown('Aleksandar Raj'),'Aleksandar Raj');
});
test('Machol and Mace are not read as Mc names',()=>{
 assert.equal(shown('ALUEL MACHOL'),'Aluel Machol');assert.equal(shown('ERIKA MACE'),'Erika Mace');
});
test('every player name in the published season data has no shouting word left',()=>{
 for(const file of fs.readdirSync(new URL('../public/data/',import.meta.url)).filter(f=>f.endsWith('-matches.json'))){
  const games=JSON.parse(fs.readFileSync(new URL(`../public/data/${file}`,import.meta.url)));
  for(const game of games)for(const team of game.teams||[])for(const player of team.players||[]){
   const words=shown(player.name).split(/[\s\-]+/).filter(word=>word.length>3&&word===word.toLocaleUpperCase('fi'));
   assert.deepEqual(words,[],`${file}: ${player.name}`);
  }
 }
});
test('a game replay shows names the same way as the rest of the site',()=>{
 const story=withShownNames({events:[{k:'3pt',n:'Linda-Lotta LEHTORANTA',as:'ERIK SAJANTILA'},{k:'period'}],chapters:[{leader:{name:'JALEN MCCOY',points:9}},{leader:null}],biggest_play:{player:'TINO YLI-JUNNILA'}});
 assert.equal(story.events[0].n,'Linda-Lotta Lehtoranta');assert.equal(story.events[0].as,'Erik Sajantila');assert.equal(story.chapters[0].leader.name,'Jalen McCoy');assert.equal(story.chapters[1].leader,null);assert.equal(story.biggest_play.player,'Tino Yli-Junnila');
});
