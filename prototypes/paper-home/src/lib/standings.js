// Order of a league table by the Finnish Basketball Federation's competition rules (Kilpailusäännöt 26–27 §).
// Two series points for a win. Teams level on points are compared on the games between them; once a team's place is
// settled the comparison starts again with those still level (27.4). The rules end in a draw, which cannot be computed:
// the name only keeps the order stable and is never presented as a ranking reason.
const POINTS_PER_WIN=2;
const ratio=(a,b)=>b?a/b:0;
function tally(names,games){
 const rows=new Map(names.map(name=>[name,{name,games:0,wins:0,pointsFor:0,pointsAgainst:0}]));
 for(const game of games){
  const [a,b]=game.teams;
  if(!rows.has(a.name)||!rows.has(b.name))continue;
  for(const [own,other] of [[a,b],[b,a]]){const row=rows.get(own.name);row.games++;row.pointsFor+=own.score;row.pointsAgainst+=other.score;if(own.score>other.score)row.wins++;}
 }
 return rows;
}
const difference=row=>row.pointsFor-row.pointsAgainst;
function splitBy(group,read){
 const values=[...new Set(group.map(read))].sort((a,b)=>b-a);
 return values.length>1?values.map(value=>group.filter(name=>read(name)===value)):null;
}
function resolveTie(group,season,games){
 if(group.length<2)return group;
 const between=tally(group,games),own=name=>between.get(name),all=name=>season.get(name);
 const even=new Set(group.map(name=>own(name).games)).size===1;
 // Uneven games between the level teams (27.5) use rates; otherwise the totals of 27.2–27.3.
 const criteria=even?[name=>own(name).wins,name=>difference(own(name)),name=>own(name).pointsFor,name=>difference(all(name)),name=>all(name).pointsFor]
  :[name=>ratio(own(name).wins,own(name).games),name=>ratio(own(name).pointsFor,own(name).pointsAgainst),name=>ratio(all(name).pointsFor,all(name).pointsAgainst)];
 for(const read of criteria){
  const parts=splitBy(group,read);
  if(parts)return parts.flatMap(part=>resolveTie(part,season,games));
 }
 return [...group].sort((a,b)=>a.localeCompare(b,'fi'));
}
export function leagueOrder(games){
 const played=games.filter(game=>game.verified&&game.teams?.length===2&&game.teams.every(team=>Number.isFinite(team.score)));
 const names=[...new Set(played.flatMap(game=>game.teams.map(team=>team.name)))];
 const season=tally(names,played);
 return (splitBy(names,name=>POINTS_PER_WIN*season.get(name).wins)||[names]).flatMap(group=>resolveTie(group,season,played));
}
