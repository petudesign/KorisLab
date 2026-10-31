import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readRoute,routeHref} from '../src/routing.js';
const defaults={leagueId:'women',seasonId:'2026-27'};
const read=url=>readRoute(defaults,new URL(url,'http://127.0.0.1:5174'));
test('game links preserve league, season and original ID',()=>{const route={section:'Ottelut',matchId:'1000914',seasonId:'2025-26',leagueId:'men'};assert.deepEqual(read(routeHref(route)),{...route,articleId:undefined,matchPanel:undefined,playerId:undefined,teamId:undefined});});
test('player and team deep links are routable',()=>{assert.equal(read('/players/abc/?season=2024-25').playerId,'abc');assert.equal(read('/teams/korisliiga/salon-vilpas/?season=2026-27').leagueId,'men');assert.equal(read('/teams/korisliiga/salon-vilpas/').teamId,'salon-vilpas');});
test('legacy prototype hash links and unknown routes',()=>{assert.equal(read('/#match=1000914').matchId,'1000914');assert.equal(read('/#overview').section,'Yleiskatsaus');assert.equal(read('/does-not-exist/').section,'Sivua ei löytynyt');});

test('match subviews preserve their canonical game ID',()=>{const route=read('/matches/1000914/data/?season=2025-26&league=korisliiga');assert.equal(route.matchPanel,'data');assert.equal(route.matchId,'1000914');assert.equal(routeHref(route),'/matches/1000914/data/?season=2025-26&league=korisliiga');});

test('explicit women team path overrides previously selected men league',()=>{
 const route=readRoute({leagueId:'men',seasonId:'2026-27'},new URL('http://127.0.0.1:5174/teams/naisten-korisliiga/espoo-basket-team/?season=2026-27'));
 assert.equal(route.leagueId,'women');assert.equal(route.teamId,'espoo-basket-team');
});

test('search deep links round-trip Finnish question, season and league',()=>{const route={section:'Haku',searchQuery:'milloin Honka pelaa seuraavaksi?',leagueId:'men',seasonId:'2025-26'};const parsed=read(routeHref(route));assert.equal(parsed.section,'Haku');assert.equal(parsed.searchQuery,route.searchQuery);assert.equal(parsed.leagueId,'men');assert.equal(parsed.seasonId,'2025-26');assert.ok(!routeHref({...route,section:'Etusivu'}).includes('q='));});

test('malformed entity URLs recover to 404 instead of throwing',()=>{for(const path of ['/players/%E0%A4%A/','/teams/korisliiga/%E0%A4%A/'])assert.equal(read(path).section,'Sivua ei löytynyt');});
test('unavailable records keep their entity route and season context',()=>{assert.equal(read('/players/not-in-this-season/?season=2025-26').section,'Pelaajat');assert.equal(read('/matches/999999999/').section,'Ottelut');assert.equal(read('/matches/123/unrecognised-panel/').section,'Sivua ei löytynyt');});

test('article links are routable and unknown articles are not found',()=>{const route=read('/analysis/first-five-games/');assert.equal(route.section,'Analyysit');assert.equal(route.articleId,'first-five-games');assert.ok(routeHref(route).startsWith('/analysis/first-five-games/?'));assert.equal(read('/analysis/').section,'Analyysit');assert.equal(read('/analysis/ei-ole/').section,'Sivua ei löytynyt');assert.ok(routeHref({section:'Tietoa',seasonId:'2026-27',leagueId:'women'}).startsWith('/about/?'));});

test('old Finnish addresses still open the right page without a server redirect',()=>{const article=read('/analyysit/viisi-ottelua/?season=2025-26');assert.equal(article.section,'Analyysit');assert.equal(article.articleId,'first-five-games');assert.equal(article.seasonId,'2025-26');assert.equal(read('/analyysit/').section,'Analyysit');assert.equal(read('/analyysit/').articleId,undefined);assert.equal(read('/tietoa/').section,'Tietoa');});
