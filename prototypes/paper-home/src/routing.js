import {useEffect,useState} from 'react';
import {articleSlugs} from './lib/fiveGamesArticle.js';
// Same as the server's default scope, which leaves these out of its public addresses.
export const CANONICAL_SCOPE={leagueId:'women',seasonId:'2026-27'};
import {legacyPath} from '../server/seo.mjs';
export const sectionPaths={'Design system':'/design-system/','Haku':'/search/','Etusivu':'/','Yleiskatsaus':'/overview/','Ottelut':'/matches/','Joukkueet':'/teams/','Pelaajat':'/players/','Kausitrendit':'/season/','Analyysit':'/analysis/','Matchup Lab':'/matchup/','Sim Studio':'/sim/','Custom import':'/custom-import/','Datan tila':'/data/','Tietoa':'/about/'};
export const slug=name=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fi').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const decodeId=value=>{try{return decodeURIComponent(value);}catch{return null;}};
export function readRoute(defaults,location=window.location){
 const query=new URLSearchParams(location.search),path=(legacyPath(location.pathname)||location.pathname).replace(/\/+$/,'')||'/';
 let section=Object.keys(sectionPaths).find(key=>sectionPaths[key].replace(/\/+$/,'')===path)||(path==='/'?'Etusivu':'Sivua ei löytynyt');
 let matchId,playerId,teamId,matchPanel,articleId;
 const article=path.match(/^\/analysis\/([^/]+)$/);
 if(article){section=articleSlugs.includes(article[1])?'Analyysit':'Sivua ei löytynyt';articleId=article[1];}
 const match=path.match(/^\/matches\/(\d+)(?:\/(players|data|preview))?$/),player=path.match(/^\/players\/([^/]+)$/),team=path.match(/^\/teams\/(?:korisliiga\/|naisten-korisliiga\/)?([^/]+)$/);
 if(match){section='Ottelut';matchId=match[1];matchPanel=match[2];}else if(player){section='Pelaajat';playerId=decodeId(player[1]);if(playerId===null)section='Sivua ei löytynyt';}else if(team){section='Joukkueet';teamId=decodeId(team[1]);if(teamId===null)section='Sivua ei löytynyt';}
 else if(location.hash==='#overview')section='Yleiskatsaus';else if(location.hash==='#matches'||location.hash.startsWith('#match=')){section='Ottelut';matchId=location.hash.startsWith('#match=')?decodeId(location.hash.slice(7)):undefined;}
 // A game, player or team address means the same thing for everyone: without a scope it is the canonical one, whatever this browser last chose.
 const scope=match||player||team?CANONICAL_SCOPE:defaults;
 const seasonId=['2024-25','2025-26','2026-27'].includes(query.get('season'))?query.get('season'):scope.seasonId;
 const leagueId=query.has('league')?(query.get('league')==='korisliiga'?'men':'women'):path.includes('/korisliiga/')?'men':path.includes('/naisten-korisliiga/')?'women':scope.leagueId;
 return {...(section==='Haku'?{searchQuery:query.get('q')||''}:{}),section,matchId,matchPanel,playerId,teamId,articleId,seasonId,leagueId};
}
export function routeHref(route){let path=sectionPaths[route.section]||'/';if(route.matchId)path=`/matches/${encodeURIComponent(route.matchId)}/${route.matchPanel?route.matchPanel+'/':''}`;if(route.playerId)path=`/players/${encodeURIComponent(route.playerId)}/`;if(route.articleId&&route.section==='Analyysit')path=`/analysis/${encodeURIComponent(route.articleId)}/`;if(route.teamId)path=`/teams/${route.leagueId==='men'?'korisliiga':'naisten-korisliiga'}/${encodeURIComponent(route.teamId)}/`;const query=new URLSearchParams({season:route.seasonId});if(route.leagueId==='men')query.set('league','korisliiga');if(route.section==='Haku'&&route.searchQuery)query.set('q',route.searchQuery);return `${path}?${query}`;}
// Moving to a section opens its front page: an article is kept only when the move names it, or stays in place (a league or season change).
export const nextRoute=(route,next)=>({...route,...next,...('section' in next&&!('articleId' in next)?{articleId:undefined}:{})});
// Window scroll per history entry: a new page starts at the top, Back returns to where the reader was.
// The desktop data page scrolls its own content area; on mobile the window scrolls, so it needs this.
let restoreY=null;
export const takeScrollRestore=()=>{const y=restoreY;restoreY=null;return y;};
export function useRoutes(defaults){const [route,setRoute]=useState(()=>readRoute(defaults));useEffect(()=>{const moved=legacyPath(location.pathname);if(moved)history.replaceState(null,'',moved+location.search+location.hash);if(['#overview','#matches'].includes(location.hash)||location.hash.startsWith('#match='))history.replaceState(null,'',routeHref(route));if('scrollRestoration' in history)history.scrollRestoration='manual';const back=()=>{restoreY=history.state?.scrollY??0;setRoute(readRoute(defaults));};window.addEventListener('popstate',back);window.addEventListener('hashchange',back);return()=>{window.removeEventListener('popstate',back);window.removeEventListener('hashchange',back);};},[]);const navigate=(next,replace=false)=>{restoreY=null;const target=nextRoute(route,next);const href=routeHref(target);if(location.pathname+location.search+location.hash!==href){if(!replace)history.replaceState({...history.state,scrollY:window.scrollY},'');history[replace?'replaceState':'pushState'](null,'',href);}setRoute(target);};return {route,navigate};}
