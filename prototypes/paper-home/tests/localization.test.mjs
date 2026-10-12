import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTranslator} from '../src/lib/localization.js';
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
 assert.equal(translate('Mistä ero syntyy?','en'),'What makes the difference?');
});
