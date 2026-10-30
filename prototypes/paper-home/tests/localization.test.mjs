import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTranslator,preferredLanguage} from '../src/lib/localization.js';
const catalog=JSON.parse(readFileSync(new URL('../src/translations.en.json',import.meta.url)));
const translate=createTranslator(catalog);
test('Finnish presentation and non-text React values remain intact',()=>{
 const element={type:'span',props:{}};
 assert.equal(translate('Heittojen tehokkuus','fi'),'Heittojen tehokkuus');
 assert.equal(translate(element,'en'),element);
 assert.equal(translate(61,'en'),61);
});
test('dynamic copy preserves names, numbers and spaces',()=>{
 assert.equal(translate('Peli-Karhut · Naisten Korisliiga 2025–26','en'),"Peli-Karhut · Women's Korisliiga 2025–26");
 assert.equal(translate('24 tilastoitua ottelua','en'),'24 games with stats');
 assert.equal(translate('STL / O','en'),'STL / G');
 assert.equal(translate('  Sulje  ','en'),'  Close  ');
 assert.equal(translate('Sara Puckett','en'),'Sara Puckett');
});
test('long phrases translate atomically and include profile content',()=>{
 assert.equal(translate('Kenttäheitot ja vapaaheitot','en'),'Field goals and free throws');
 assert.equal(translate('Vuoden ulkomaalaispelaaja','en'),'International player of the year');
 // Award names translate whole; word-by-word fallback once produced "Vuoden player".
 for(const [fi,en] of [['Vuoden pelaaja','Player of the year'],['Vuoden puolustuspelaaja','Defensive player of the year'],['Vuoden tulokas','Rookie of the year'],['Vuoden kuudes pelaaja','Sixth player of the year'],['Vuoden kehittynein','Most improved player'],['Vapaaheittopalkinto','Free throw award']])assert.equal(translate(fi,'en'),en);
 assert.equal(translate('Mistä ero syntyy?','en'),'What makes the difference?');
});

test('first-visit language follows the browser, and search engines keep Finnish',()=>{
 assert.equal(preferredLanguage(['en-US','en'],'Mozilla/5.0 Chrome'),'en');
 assert.equal(preferredLanguage(['de-DE'],'Mozilla/5.0 Safari'),'en');
 assert.equal(preferredLanguage(['fi-FI','en'],'Mozilla/5.0'),'fi');
 assert.equal(preferredLanguage(['en-GB','fi'],'Mozilla/5.0'),'fi');
 assert.equal(preferredLanguage(['en-US'],'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'),'fi');
 assert.equal(preferredLanguage(['en-US'],'Mozilla/5.0 (compatible; bingbot/2.0)'),'fi');
 assert.equal(preferredLanguage([],''),'fi');
});
