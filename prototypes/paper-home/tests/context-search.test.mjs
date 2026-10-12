import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveContextSearch,contextIntent,performanceDirection} from '../src/lib/contextSearch.js';
const options={seasonId:'2026-27',seasonIds:['2026-27','2025-26','2024-25'],now:new Date('2026-10-12T12:00:00+03:00'),loadGames:s=>JSON.parse(readFileSync(new URL(`../public/data/women-${s}-matches.json`,import.meta.url)))};
test('contextual queries recognize Finnish inflection and English while normal search is preserved',async()=>{
 assert.equal(contextIntent('Lauren Heard pisteet 2526'),null);assert.equal(contextIntent('Milloin Honka pelaa seuraavaksi?'),null);
 assert.equal(contextIntent('How did Aarrejoki’s role change?'),'change');
 const r=await resolveContextSearch('Miten Aarrejoen rooli muuttui?',options);
 assert.equal(r.kind,'player-change');assert.equal(r.player.name,'Annika Aarrejoki');assert.equal(r.mode,'season');assert.equal(r.analysis.ready,true);
 assert.equal(new Set(r.analysis.recent.map(g=>g.id)).size,r.analysis.recent.length);
});
test('worse performance is checked rather than assumed',()=>{
 const analysis=(o,d)=>({ready:true,rows:[{key:'offensive',delta:o},{key:'defensive',delta:d}]});
 assert.equal(performanceDirection(analysis(8,1)),'up');assert.equal(performanceDirection(analysis(-2,1)),'stable');
 assert.equal(performanceDirection(analysis(-8,1)),'down');assert.equal(performanceDirection(analysis(null,1)),'insufficient');
 assert.equal(performanceDirection({...analysis(-8,1),ready:false}),'insufficient');
});
test('team decline question resolves to its actual verified comparison',async()=>{
 const r=await resolveContextSearch('Miksi Peli-Karhut on pelannut huonommin?',options);
 assert.equal(r.kind,'team-change');assert.equal(r.asksWorse,true);assert.equal(r.subject.name,'Peli-Karhut');assert.equal(r.direction,performanceDirection(r.analysis));
});
test('next-game keys find Hongan and keep historical meetings scoped to their season',async()=>{
 const r=await resolveContextSearch('Mitä Hongan seuraavassa ottelussa kannattaa seurata?',options);
 assert.equal(r.kind,'preview');assert.equal(r.subject.name,'Tapiolan Honka');
 assert.ok(Date.parse(r.fixture.date)>options.now.getTime());assert.equal(r.fixture.verified,false);
 assert.ok(r.headToHead.every(g=>g.verified&&options.seasonIds.includes(g.season)&&g.teams.some(t=>t.name===r.subject.name)&&g.teams.some(t=>t.name===r.opponent.name)));
});
test('explicit recent comparison does not silently substitute a different baseline',async()=>{
 const r=await resolveContextSearch('Miten Aarrejoen rooli muuttui viimeisissä 5 ottelussa?',options);
 assert.equal(r.mode,'recent');assert.equal(r.analysis.ready,false);
});
test('unknown names and unavailable future fixtures produce clear states',async()=>{
 assert.equal((await resolveContextSearch('Miten Tuntemattoman rooli muuttui?',options)).kind,'clarify');
 const r=await resolveContextSearch('Hongan seuraavan ottelun avaimet 2526',options);
 assert.equal(r.kind,'no-fixture');assert.equal(r.season,'2025-26');
});
