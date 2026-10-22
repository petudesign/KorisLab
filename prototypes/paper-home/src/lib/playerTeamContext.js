const finite=Number.isFinite;
const total=(rows,read)=>rows.length&&rows.every(r=>finite(read(r)))?rows.reduce((s,r)=>s+read(r),0):null;
const percent=(a,b)=>finite(a)&&finite(b)&&b>0?100*a/b:null;
const attempts=s=>finite(s?.two_pa)&&finite(s?.three_pa)?s.two_pa+s.three_pa:null;

// Descriptive rankings in verified games, not the official league standings.
export function playerTeamContext(games,records,playerId){
 const verified=games.filter(g=>g.verified&&g.teams.length===2&&g.teams.every(t=>finite(t.score)));
 const standings=new Map();
 for(const g of verified)for(const own of g.teams){
  const other=g.teams.find(t=>t!==own),row=standings.get(own.name)||{name:own.name,games:0,wins:0,losses:0};
  row.games++;if(own.score>other.score)row.wins++;if(own.score<other.score)row.losses++;
  standings.set(own.name,row);
 }
 const teams=[...standings.values()];
 return [...new Set(records.map(r=>r.team))].map(name=>{
  const period=records.filter(r=>r.team===name),ids=new Set(period.map(r=>r.id));
  const sample=verified.filter(g=>ids.has(g.id)).map(g=>g.teams.find(t=>t.name===name));
  const roster=new Map();
  for(const team of sample)for(const p of team.players){
   if(!(p.minutesValue>0||p.participated===true))continue;
   const r=roster.get(p.id)||{id:p.id,minutes:0,points:0,attempts:0,pointsComplete:true,attemptsComplete:true};
   r.minutes+=p.minutesValue??Number.NaN;
   if(finite(p.stats.points))r.points+=p.stats.points;else r.pointsComplete=false;
   if(finite(attempts(p.stats)))r.attempts+=attempts(p.stats);else r.attemptsComplete=false;
   roster.set(p.id,r);
  }
  const player=roster.get(playerId),record=standings.get(name),winPct=record?percent(record.wins,record.games):null;
  const teamAttempts=total(sample,t=>attempts(t.stats)),teamPoints=total(sample,t=>t.score);
  return {name,games:record?.games||0,wins:record?.wins||0,losses:record?.losses||0,winPct,
   winRank:finite(winPct)?1+teams.filter(t=>100*t.wins/t.games>winPct+1e-9).length:null,teamCount:teams.length,
   sampleGames:sample.length,minutes:player&&sample.length?player.minutes/sample.length:null,
   minuteRank:player&&finite(player.minutes)&&[...roster.values()].every(p=>finite(p.minutes))?1+[...roster.values()].filter(p=>p.minutes>player.minutes+1e-6).length:null,
   shotShare:player?.attemptsComplete?percent(player.attempts,teamAttempts):null,
   pointShare:player?.pointsComplete?percent(player.points,teamPoints):null,
   pointRank:player?.pointsComplete&&[...roster.values()].every(p=>p.pointsComplete)?1+[...roster.values()].filter(p=>p.points>player.points).length:null,
   attempts:player?.attemptsComplete&&sample.length?player.attempts/sample.length:null};
 });
}
