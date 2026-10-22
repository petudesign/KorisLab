export function overviewRecentPoints(games,teamId='league'){
 return games.filter(g=>g.verified&&g.teams.length===2&&g.teams.every(t=>Number.isFinite(t.score))&&(teamId==='league'||g.teams.some(t=>t.id===teamId)))
 .sort((a,b)=>`${a.date||''} ${a.time||''}`.localeCompare(`${b.date||''} ${b.time||''}`)||String(a.id).localeCompare(String(b.id)))
 .slice(-5).map(g=>{
  const home=g.teams.find(t=>t.side==='home'),away=g.teams.find(t=>t.side==='away');
  return {id:g.id,date:g.date,home:home.name,away:away.name,homeScore:home.score,awayScore:away.score,points:teamId==='league'?(home.score+away.score)/2:g.teams.find(t=>t.id===teamId).score};
 });
}
