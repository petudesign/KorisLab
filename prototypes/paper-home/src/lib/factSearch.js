import {leagueOrder} from './standings.js';
import {normalize,mentionedPlayers,mentionedTeams,seasonFromQuery} from './basketballQuery.js';
import {aggregateSeasonPlayers,progressivePlayerQualification} from './playerStats.ts';
import {searchRecords} from './searchData.js';
import {teamResourceRows,resourceInfoForSeason} from './teamResources.js';
import {teamSeasonInfo} from './teamSeasonInfo.js';

// Vocabulary describes metrics and operators, not whole pre-written questions.
export const factMetrics=[
 {key:'efficiency',terms:/\b(euro\w*|100000|100 000)\b.*\b(voitto\w*|wins?)\b|\b(voitto\w*|wins?)\b.*\b(euro\w*|100000|100 000)\b/,fi:'Voittoja / 100 000 €',en:'Wins / €100,000',resource:true},
 {key:'payroll',terms:/\b(palkka\w*|payroll|wage\w*|salar\w*)\b/,fi:'Palkkakulut',en:'Payroll costs',resource:true,money:true},
 {key:'budget',terms:/\b(budjet\w*|budget\w*)\b/,fi:'Kausibudjetti',en:'Season budget',resource:true,money:true},
 {key:'points',terms:/\b(piste\w*|point\w*|scor\w*|ppg)\b/,fi:'Pisteet',en:'Points',player:true},
 {key:'assists',terms:/\b(syot\w*|assist\w*|apg)\b/,fi:'Syötöt',en:'Assists',player:true},
 {key:'rebounds',terms:/\b(levypall\w*|rebound\w*|rpg)\b/,fi:'Levypallot',en:'Rebounds',player:true},
 {key:'steals',terms:/\b(riisto\w*|steal\w*)\b/,fi:'Riistot',en:'Steals',player:true},
 {key:'blocks',terms:/\b(torjunt\w*|block\w*)\b/,fi:'Torjunnat',en:'Blocks',player:true},
 {key:'wins',terms:/\b(voitto(?:a|ja|jen|t)?|wins?)\b/,fi:'Voitot',en:'Wins'},
 {key:'losses',terms:/\b(tappio\w*|loss\w*|lost)\b/,fi:'Tappiot',en:'Losses'},
];
export function factIntent(raw){
 const q=normalize(raw);if(raw.length>200)return null;
 if(/\b(sarjatauluk\w*|sarja tauluk\w*|standings?|league table)\b/.test(q))return {kind:'standings'};
 if(/\bjoht\w*\b.*\b(sarj\w*|liig\w*)\b|\b(sarj\w*|liig\w*)\b.*\b(joht\w*|karj\w*)\b|\b(lead\w*|first)\b.*\b(league|standings?)\b/.test(q))return {kind:'league-leader'};
 const metric=factMetrics.find(m=>m.terms.test(q));
 if(!metric)return null;
 return {kind:'metric',metric,perGame:/\b(keskiarv\w*|ottel\w* kohti|per (game|ottel\w*)|average|ppg|apg|rpg)\b/.test(q),ascending:/\b(vahiten|pienin|lowest|fewest|least|smallest)\b/.test(q),player:/\b(pelaaj\w*|player\w*)\b/.test(q),team:/\b(joukkue\w*|seura\w*|teams?|clubs?)\b/.test(q),ranking:/\b(kuka|kenella|eniten|vahiten|suurin|pienin|most|least|highest|lowest|who|lead\w*|joht\w*)\b/.test(q)};
}
export function factTeamRows(games){
 const rows=new Map();
 for(const g of games){
  if(!g.verified||g.teams?.length!==2||!g.teams.every(t=>Number.isFinite(t.score)))continue;
  for(const own of g.teams){
   const other=g.teams.find(t=>t!==own),row=rows.get(own.name)||{id:own.id,name:own.name,games:0,wins:0,losses:0,points:0,allowed:0,assists:0,rebounds:0,steals:0,blocks:0};
   row.games++;row.wins+=Number(own.score>other.score);row.losses+=Number(own.score<other.score);row.points+=own.score;row.allowed+=other.score;
   for(const key of ['assists','rebounds','steals','blocks'])row[key]=Number.isFinite(row[key])&&Number.isFinite(own.stats?.[key])?row[key]+own.stats[key]:null;
   rows.set(own.name,row);
  }
 }
 const place=new Map(leagueOrder(games).map((name,index)=>[name,index]));
 return [...rows.values()].sort((a,b)=>place.get(a.name)-place.get(b.name));
}
const rank=(rows,ascending)=>[...rows].filter(r=>Number.isFinite(r.value)).sort((a,b)=>(ascending?a.value-b.value:b.value-a.value)||a.name.localeCompare(b.name,'fi')).map((row,_,ordered)=>({...row,rank:1+ordered.filter(other=>ascending?other.value<row.value:other.value>row.value).length}));
export async function resolveFactSearch(raw,{seasonId,leagueId,loadGames}){
 const intent=factIntent(raw);if(!intent)return null;
 const q=normalize(raw),league=/\b(naisten|women\w*)\b/.test(q)?'women':/\b(miesten|men|mens)\b/.test(q)?'men':leagueId;
 const season=seasonFromQuery(q,seasonId),games=await loadGames(season,league),teams=factTeamRows(games);
 const scope={season,leagueId:league,games,standings:teams};
 if(intent.kind!=='metric')return {...scope,kind:intent.kind};
 const {metric,perGame}=intent;
 const teamNames=[...new Map(games.flatMap(g=>g.teams.map(t=>[t.name,{name:t.name,source_team_id:t.id}]))).values()];
 const matched=mentionedTeams(q,teamNames);
 const noise=/^(?:kuka|kella|kenella|mika|milla|mitka|mita|kuinka|paljon|monta|montako|on|oli|ovat|sai|saan\w*|suhteessa|kaytet\w*|budjet\w*|kaus\w*|kauden|kaudella|sarj\w*|liig\w*|runkosarj\w*|naisten|miesten|joukkue\w*|pelaaj\w*|eniten|vahiten|suurin|pienin|joht\w*|keskiarv\w*|ottel\w*|pel\w*|per|kohti|kohden|nayta|avaa|tilasto\w*|euro\w*|who|what|which|how|many|much|has|have|had|did|get|got|the|in|of|for|and|a|an|is|are|this|season|league|women\w*|men\w*|players?|teams?|clubs?|most|least|highest|lowest|largest|smallest|fewest|lead\w*|average|games?|matches|spent|euros?|to|relative)$/;
 if(!matched.length&&q.split(' ').some(word=>!/^[0-9]+$/.test(word)&&!noise.test(word)&&!factMetrics.some(m=>m.terms.test(word))))return null;
 const players=metric.player?aggregateSeasonPlayers(searchRecords(games)):[];
 // Keep the existing named-player resolver and its name ambiguity safeguards.
 if(metric.player&&mentionedPlayers(q,players).length)return null;
 if(matched.length>1)return {...scope,kind:'clarify',candidates:matched.map(team=>({name:team.name,query:`${team.name} ${metric.fi} ${season}`}))};
 const resources=resourceInfoForSeason(teamSeasonInfo[league],season,teamNames.map(t=>t.name));
 const teamRows=metric.resource?teamResourceRows(resources,games).map(r=>({...r,id:teamNames.find(t=>t.name===r.name)?.source_team_id,value:r[metric.key]})):teams.map(r=>({...r,value:Number.isFinite(r[metric.key])?perGame?r[metric.key]/r.games:r[metric.key]:null}));
 if(matched.length&&!intent.player){const row=teamRows.find(r=>r.name===matched[0].name);return {...scope,kind:'metric',metric,perGame,groups:[{entity:'team',rows:row?[row]:[]}],sourceUrl:resources?.sourceUrl};}
 const qualification=progressivePlayerQualification(searchRecords(games));
 const pool=matched.length?players.filter(p=>p.team===matched[0].name):players;
 const playerRows=pool.filter(p=>!perGame||p.games>=qualification.minimumGames&&p.minutes>=qualification.minimumMinutes).map(p=>({...p,value:Number.isFinite(p[metric.key])?perGame?p[metric.key]/p.games:p[metric.key]:null}));
 const groups=[];
 if(metric.player&&!intent.team)groups.push({entity:'player',rows:rank(playerRows,intent.ascending).slice(0,5)});
 if(!intent.player||!metric.player)groups.push({entity:'team',rows:rank(teamRows,intent.ascending).slice(0,5)});
 return {...scope,kind:'metric',metric,perGame,groups,sourceUrl:resources?.sourceUrl};
}
