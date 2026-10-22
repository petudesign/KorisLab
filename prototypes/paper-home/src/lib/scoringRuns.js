/** Consecutive points without an opponent score; period boundaries do not end a run. */
export function longestScoringRuns(replay){
 const best=new Map(replay.teams.map(t=>[t.id,null]));
 let current=null;
 replay.events.forEach((event,index)=>{
  if(!event.points)return;
  if(!current||current.teamId!==event.team_id){
   const previous=replay.events[Math.max(0,index-1)];
   current={teamId:event.team_id,points:0,first:index,last:index,beforeHome:previous.home,beforeAway:previous.away};
  }
  current={...current,points:current.points+event.points,last:index};
  if(current.points>(best.get(event.team_id)?.points||0))best.set(event.team_id,current);
 });
 return replay.teams.map(team=>({team,run:best.get(team.id)}));
}
