// Single-game bests, for one player and for the whole league. Only verified games count, so the numbers match the game pages.
export const BEST_METRICS=[
 {key:'points',fi:'Pisteet',en:'Points',short:{fi:'Pisteet',en:'Points'}},
 {key:'rebounds',fi:'Levypallot',en:'Rebounds',short:{fi:'Levypallot',en:'Rebounds'}},
 {key:'assists',fi:'Syötöt',en:'Assists',short:{fi:'Syötöt',en:'Assists'}},
 {key:'steals',fi:'Riistot',en:'Steals',short:{fi:'Riistot',en:'Steals'}},
 {key:'blocks',fi:'Torjunnat',en:'Blocks',short:{fi:'Torjunnat',en:'Blocks'}},
 {key:'three_pm',fi:'Kolmoset',en:'Threes',short:{fi:'Kolmoset',en:'Threes'}},
 {key:'plus_minus',fi:'Plus/miinus',en:'Plus/minus',short:{fi:'+/−',en:'+/−'}},
];
export const RECORD_METRICS=BEST_METRICS.filter(metric=>metric.key!=='plus_minus');
export const RECORDS_SHOWN=5;
const played=player=>player.minutesValue>0||player.participated===true;
const newest=(a,b)=>String(b.game.date).localeCompare(String(a.game.date));
function appearances(games){
 const rows=[];
 for(const game of games){
  if(!game.verified)continue;
  for(const team of game.teams)for(const player of team.players)if(played(player))rows.push({game,team,opponent:game.teams.find(other=>other!==team),player});
 }
 return rows;
}
// The average and best of each stat. When the best came more than once, the newest game is shown and the count is kept.
export function seasonBests(games,playerId){
 const own=appearances(games).filter(row=>row.player.id===playerId).sort((a,b)=>String(a.game.date).localeCompare(String(b.game.date)));
 return BEST_METRICS.map(metric=>{
  const known=own.filter(row=>Number.isFinite(row.player.stats?.[metric.key]));
  if(!known.length)return {metric,average:null,best:null,times:0,game:null,opponent:null,values:[]};
  const values=known.map(row=>row.player.stats[metric.key]),best=Math.max(...values),games=known.filter(row=>row.player.stats[metric.key]===best).sort(newest);
  return {metric,average:values.reduce((sum,value)=>sum+value,0)/values.length,best,times:games.length,game:games[0].game,opponent:games[0].opponent,values};
 });
}
// Best single games in the league. A player can appear more than once, since the list is about games.
// When more games tie with the last row than fit, the row count stays and the rest are counted, not dropped silently.
export function leagueRecords(games,metric,limit=RECORDS_SHOWN){
 const rows=appearances(games).filter(row=>Number.isFinite(row.player.stats?.[metric])).map(row=>({...row,value:row.player.stats[metric]}))
  .sort((a,b)=>b.value-a.value||newest(a,b)||a.player.name.localeCompare(b.player.name,'fi'));
 const shown=rows.slice(0,limit),last=shown.at(-1);
 return {rows:shown,tiedBeyond:last?rows.slice(limit).filter(row=>row.value===last.value).length:0};
}
// Average age is shown only when enough of the team's minutes have a known age, otherwise it would describe only part of the team.
export const AGE_MIN_SHARE=.7;
export function teamAgeRows(teams,metric='average_age'){
 const rows=Object.entries(teams??{}).filter(([,row])=>row.known_minutes_share>=AGE_MIN_SHARE).map(([name,row])=>({...row,name,age:row[metric]})).sort((a,b)=>a.age-b.age||a.name.localeCompare(b.name,'fi'));
 return rows.map(row=>({...row,rank:rows.findIndex(other=>other.age===row.age)+1}));
}
export function teamAgeView(teams,name){
 const usable=Object.entries(teams??{}).filter(([,row])=>row.known_minutes_share>=AGE_MIN_SHARE);
 const own=usable.find(([team])=>team===name)?.[1];
 if(!own)return null;
 const ordered=usable.map(([,row])=>row.average_age).sort((a,b)=>a-b);
 return {...own,youngestRank:ordered.indexOf(own.average_age)+1,teams:ordered.length,leagueAverage:ordered.reduce((sum,age)=>sum+age,0)/ordered.length};
}
// Where a player's points came from and how each shot type compares with the league's rate.
const SHOT_TYPES=[{key:'two',label:'2P',made:'twoPM',attempts:'twoPA',value:2},{key:'three',label:'3P',made:'threePM',attempts:'threePA',value:3},{key:'free',label:'FT',made:'ftm',attempts:'fta',value:1}];
export function shotBreakdown(player,players){
 const total=key=>players.reduce((sum,row)=>sum+(row[key]||0),0);
 const rows=SHOT_TYPES.map(type=>{
  const made=player[type.made]||0,attempts=player[type.attempts]||0,leagueAttempts=total(type.attempts);
  return {key:type.key,label:type.label,made,attempts,points:made*type.value,rate:attempts?100*made/attempts:null,leagueRate:leagueAttempts?100*total(type.made)/leagueAttempts:null};
 });
 return {rows,points:rows.reduce((sum,row)=>sum+row.points,0)};
}
