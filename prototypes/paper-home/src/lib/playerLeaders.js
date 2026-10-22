export function playerLeader(players, metric) {
 const eligible=players.filter(p=>p.games>0&&Number.isFinite(p[metric]));
 const leader=[...eligible].sort((a,b)=>b[metric]/b.games-a[metric]/a.games||b.games-a.games||a.name.localeCompare(b.name,'fi'))[0];
 const appearances=eligible.reduce((total,p)=>total+p.games,0);
 return {leader,average:appearances?eligible.reduce((total,p)=>total+p[metric],0)/appearances:null};
}
export function playerRecentGames(games,id,metric) {
 return games.filter(g=>g.verified).flatMap(g=>{
  const row=g.teams.flatMap(t=>t.players).find(p=>p.id===id&&(p.minutesValue>0||p.participated===true));
  if(!row)return [];
  const value=['points','assists','rebounds','steals'].includes(metric)?row.stats[metric]:metric==='minutes'?row.minutesValue:playerMetric({games:1,minutes:row.minutesValue??Number.NaN,points:row.stats.points,twoPA:row.stats.two_pa,threePA:row.stats.three_pa,fta:row.stats.fta,efficiency:row.stats.efficiency},metric);
  if(!Number.isFinite(value))return [];
  const home=g.teams.find(t=>t.side==='home'),away=g.teams.find(t=>t.side==='away');
  return [{id:g.id,date:g.date,home:home.name,away:away.name,homeScore:home.score,awayScore:away.score,[metric]:value}];
 }).sort((a,b)=>new Date(a.date)-new Date(b.date)||String(a.id).localeCompare(String(b.id))).slice(-5);
}

export function playerMetric(player,metric){
 if(['points','assists','rebounds','steals'].includes(metric))return player.games>0&&Number.isFinite(player[metric])?player[metric]/player.games:null;
 if(metric==='minutes')return Number.isFinite(player.minutes)?player.minutes:null;
 if(metric==='efficiencyPer40')return player.minutes>0&&Number.isFinite(player.efficiency)?40*player.efficiency/player.minutes:null;
 if(metric==='attemptsPer40')return player.minutes>0&&Number.isFinite(player.twoPA)&&Number.isFinite(player.threePA)?40*(player.twoPA+player.threePA)/player.minutes:null;
 if(metric==='trueShootingPct'){
  const attempts=player.twoPA+player.threePA+.44*player.fta;
  return attempts>0?100*player.points/(2*attempts):null;
 }
 return null;
}
export function metricLeader(players,metric,minimumGames){
 const eligible=players.filter(p=>Number.isFinite(playerMetric(p,metric))&&(metric==='minutes'||p.games>=minimumGames&&p.minutes>=minimumGames*15));
 const leader=[...eligible].sort((a,b)=>playerMetric(b,metric)-playerMetric(a,metric)||b.games-a.games||a.name.localeCompare(b.name,'fi'))[0];
 const available=players.filter(p=>p.games>0&&Number.isFinite(playerMetric(p,metric)));
 const total=key=>available.reduce((sum,p)=>sum+p[key],0),appearances=total('games');
 let average=null;
 if(available.length){
  if(metric==='minutes')average=total('minutes')/available.length;
  else if(metric==='efficiencyPer40')average=40*total('efficiency')/total('minutes');
  else if(metric==='attemptsPer40')average=40*(total('twoPA')+total('threePA'))/total('minutes');
  else if(metric==='trueShootingPct')average=100*total('points')/(2*(total('twoPA')+total('threePA')+.44*total('fta')));
  else average=total(metric)/appearances;
 }
 return {leader,average,trendAverage:metric==='minutes'&&appearances?total('minutes')/appearances:average};
}
