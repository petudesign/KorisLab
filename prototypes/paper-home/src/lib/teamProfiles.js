export function seasonTeams(season,games){
 const teams=new Map(season.aggregate.teams.map(t=>[t.name,t]));
 for(const game of games)for(const team of game.teams)if(!teams.has(team.name))teams.set(team.name,{name:team.name,source_team_id:team.id,games:0,per_game:{},metrics:{}});
 return [...teams.values()].sort((a,b)=>a.name.localeCompare(b.name,'fi'));
}
export function teamSeasonSummary(games,name){
 const played=games.filter(g=>g.verified&&g.teams.some(t=>t.name===name)).sort((a,b)=>new Date(a.date)-new Date(b.date));
 let wins=0,losses=0,pointsFor=0,pointsAgainst=0;
 const recent=played.map(g=>{const own=g.teams.find(t=>t.name===name),other=g.teams.find(t=>t.name!==name);const won=own.score>other.score;if(won)wins++;else if(own.score<other.score)losses++;pointsFor+=own.score;pointsAgainst+=other.score;return {id:g.id,date:g.date,won,opponent:other.name,score:`${own.score}–${other.score}`};}).slice(-5);
 return {games:played.length,wins,losses,pointsFor,pointsAgainst,pointsPerGame:played.length?pointsFor/played.length:null,allowedPerGame:played.length?pointsAgainst/played.length:null,recent};
}

// Match ratings use the same shared possession estimate as the original TeamTrend.
export function teamRecentMetrics(games,name){
 const estimate=stats=>['two_pa','three_pa','fta','offensive_rebounds','turnovers'].every(k=>Number.isFinite(stats[k]))?stats.two_pa+stats.three_pa+.44*stats.fta-stats.offensive_rebounds+stats.turnovers:null;
 return games.filter(g=>g.verified&&g.teams.length===2&&g.teams.some(t=>t.name===name)).sort((a,b)=>new Date(a.date)-new Date(b.date)||String(a.id).localeCompare(String(b.id))).slice(-5).map(g=>{
  const home=g.teams.find(t=>t.side==='home'),away=g.teams.find(t=>t.side==='away'),own=g.teams.find(t=>t.name===name),other=g.teams.find(t=>t.name!==name);
  const ownPossessions=estimate(own.stats),otherPossessions=estimate(other.stats);
  const shared=Number.isFinite(ownPossessions)&&Number.isFinite(otherPossessions)?(ownPossessions+otherPossessions)/2:null;
  return {id:g.id,date:g.date,home:home.name,away:away.name,homeScore:home.score,awayScore:away.score,points:own.score,allowed:other.score,offensive:shared>0?100*own.score/shared:null,defensive:shared>0?100*other.score/shared:null};
 });
}
