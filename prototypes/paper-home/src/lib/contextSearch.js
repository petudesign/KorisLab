import {normalize,mentionedPlayers,mentionedTeams,seasonFromQuery} from './basketballQuery.js';
import {aggregateSeasonPlayers} from './playerStats.ts';
import {searchRecords} from './searchData.js';
import {analyzeChange,changeRecords,previousPlayerIdentity} from './changeAnalysis.js';
import {playerTeamContext} from './playerTeamContext.js';

export function contextIntent(raw){
 const q=normalize(raw);
 if(raw.length>200)return null;
 if(/\b(seuraav\w*|next|upcoming)\b/.test(q)&&/\b(seurat\w*|seuraam\w*|seurann\w*|avai[nm]\w*|watch\w*|key|preview|ennak\w*)\b/.test(q))return 'preview';
 if(/\b(rool\w*|vastuu\w*|muuttu\w*|muutos\w*|vire\w*|huonom\w*|heikom\w*|parem\w*|why|change\w*|role|form|worse|improv\w*)\b/.test(q))return 'change';
 return null;
}
export function performanceDirection(analysis){
 if(!analysis.ready)return 'insufficient';
 const offense=analysis.rows.find(r=>r.key==='offensive'),defense=analysis.rows.find(r=>r.key==='defensive');
 if(!Number.isFinite(offense?.delta)||!Number.isFinite(defense?.delta))return 'insufficient';
 const net=offense.delta-defense.delta;
 return net<=-5?'down':net>=5?'up':'stable';
}
export async function resolveContextSearch(raw,{seasonId,seasonIds,loadGames,now=new Date()}){
 const intent=contextIntent(raw);if(!intent)return null;
 const q=normalize(raw),season=seasonFromQuery(q,intent==='preview'?seasonIds[0]:seasonId);
 const games=await loadGames(season),players=aggregateSeasonPlayers(searchRecords(games));
 const teams=[...new Map(games.flatMap(g=>g.teams.map(t=>[t.id,{source_team_id:t.id,name:t.name}]))).values()];
 const matches=mentionedPlayers(q,players),teamMatches=mentionedTeams(q,teams);
 const options=intent==='preview'?teamMatches:matches.length?matches:teamMatches;
 if(options.length!==1)return {kind:'clarify',season,intent,candidates:options.map(p=>({name:p.name,query:intent==='preview'?`Seuraavan ottelun avaimet ${p.name} ${season}`:`Miten ${p.name} muuttui ${season}?`})),reason:options.length?'ambiguous':'unknown'};
 const subject=options[0],player=intent!=='preview'&&matches.length?subject:null;
 const previousSeason=seasonIds[seasonIds.indexOf(season)+1];
 const previousGames=previousSeason?await loadGames(previousSeason):[];
 if(intent==='preview'){
  const fixture=games.filter(g=>!g.verified&&!['live','playing','break'].includes(g.status)&&g.teams.every(t=>t.score==null)&&g.teams.some(t=>t.name===subject.name)&&Date.parse(g.date)>now.getTime()).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date))[0];
  if(!fixture)return {kind:'no-fixture',season,subject};
  const opponent=fixture.teams.find(t=>t.name!==subject.name);
  const ownRows=changeRecords(games,{teamName:subject.name}),otherRows=changeRecords(games,{teamName:opponent.name});
  const comparison=analyzeChange(ownRows,otherRows,{type:'team',mode:'season'});
  const headToHead=[...games.map(g=>({...g,season})),...previousGames.map(g=>({...g,season:previousSeason}))].filter(g=>g.verified&&g.teams.some(t=>t.name===subject.name)&&g.teams.some(t=>t.name===opponent.name)).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).slice(0,3);
  // Compare both current-season teams after at least two verified games each.
  const ready=ownRows.length>=2&&otherRows.length>=2;
  return {kind:'preview',season,subject,opponent,fixture,comparison,ready,headToHead,ownRows,otherRows};
 }
 const records=changeRecords(games,{playerId:player?.id,teamName:player?undefined:subject.name});
 let previousPlayerId=player?previousPlayerIdentity(previousGames,player):null;
 if(player&&previousPlayerId!==player.id&&players.filter(p=>normalize(p.name)===normalize(player.name)).length!==1)previousPlayerId=null;
 const oldRecords=changeRecords(previousGames,{playerId:player?previousPlayerId:undefined,teamName:player?undefined:subject.name});
 const explicitRecent=/\b(viime\w*|recent|last)\b/.test(q),explicitSeason=/\b(edelli\w*|viime\w* kaus\w*|viime\w* kaute\w*|tall\w* kaud\w*|previous|last season|this season)\b/.test(q);
 const mode=explicitSeason?'season':explicitRecent?'recent':records.length>=8?'recent':'season';
 const analysis=analyzeChange(records,oldRecords,{type:player?'player':'team',mode});
 const roleAsked=!!player&&/\b(rool\w*|vastuu\w*|role)\b/.test(q);
 const roleBefore=player?playerTeamContext(mode==='season'?previousGames:games,analysis.earlier,mode==='season'?previousPlayerId:player.id):[];
 const roleAfter=player?playerTeamContext(games,analysis.recent,player.id):[];
 return {kind:player?'player-change':'team-change',season,subject,player,games,previousGames,previousSeason,previousPlayerId,mode,analysis,roleAsked,roleBefore,roleAfter,direction:player?null:performanceDirection(analysis),asksWorse:/\b(huonom\w*|heikom\w*|worse|declin\w*)\b/.test(q)};
}
