const possessions=stats=>['two_pa','three_pa','fta','offensive_rebounds','turnovers'].every(key=>Number.isFinite(stats?.[key]))?stats.two_pa+stats.three_pa+.44*stats.fta-stats.offensive_rebounds+stats.turnovers:null;
// Points per 100 possessions in each of the latest games: the league's scoring, or a team's margin.
export function overviewRecentRatings(games,teamId='league'){
 return overviewRecentPoints(games,teamId).map(row=>{
  const game=games.find(g=>g.id===row.id),[a,b]=game.teams,own=possessions(a.stats),other=possessions(b.stats),shared=Number.isFinite(own)&&Number.isFinite(other)?(own+other)/2:null;
  if(!(shared>0))return {...row,rating:null};
  const team=game.teams.find(t=>t.id===teamId),opponent=game.teams.find(t=>t!==team);
  return {...row,rating:teamId==='league'?100*(a.score+b.score)/2/shared:100*(team.score-opponent.score)/shared};
 });
}
export function overviewRecentPoints(games,teamId='league'){
 return games.filter(g=>g.verified&&g.teams.length===2&&g.teams.every(t=>Number.isFinite(t.score))&&(teamId==='league'||g.teams.some(t=>t.id===teamId)))
 .sort((a,b)=>`${a.date||''} ${a.time||''}`.localeCompare(`${b.date||''} ${b.time||''}`)||String(a.id).localeCompare(String(b.id)))
 .slice(-5).map(g=>{
  const home=g.teams.find(t=>t.side==='home'),away=g.teams.find(t=>t.side==='away');
  return {id:g.id,date:g.date,home:home.name,away:away.name,homeScore:home.score,awayScore:away.score,points:teamId==='league'?(home.score+away.score)/2:g.teams.find(t=>t.id===teamId).score};
 });
}
