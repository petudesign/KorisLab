// How a player's baskets came about and their biggest moments, worked out from the game stories.
// Baskets: assisted first, then unassisted in the same attack after the team's offensive rebound, then the rest.
const name=value=>String(value??'').trim().toLocaleLowerCase('fi').replace(/\s+/g,' ');
// A win probability swing below this is ordinary play: half of all made shots move it about five points.
export const MOMENT_MIN_SWING=.1;
export const MOMENTS_SHOWN=5;
const ENDS_ATTACK=new Set(['turnover','steal','defensive_rebound','period']);
const isFieldGoal=event=>event.k==='2pt'||event.k==='3pt';
const blankBaskets=()=>({assisted:{two:0,three:0},rebound:{two:0,three:0},other:{two:0,three:0}});

export function basketKinds(events){
 const open={h:false,a:false},kinds=[];
 for(const event of events){
  if(ENDS_ATTACK.has(event.k)||(isFieldGoal(event)&&event.m)){
   const made=isFieldGoal(event)&&event.m;
   if(made)kinds.push({event,kind:event.as?'assisted':open[event.s]?'rebound':'other'});
   open.h=false;open.a=false;
  }
  if(event.k==='offensive_rebound')open[event.s]=true;
 }
 return kinds;
}
function roster(game){
 const sides={};
 for(const team of game.teams){
  const key=team.side==='home'?'h':'a',players=new Map();
  for(const player of team.players)players.set(name(player.name),player);
  sides[key]={team,players};
 }
 return sides;
}
// A game counts only when every player's made shots match the box score, so the split always adds up to it.
function reconciles(game,sides,kinds){
 const counts=new Map();
 for(const {event} of kinds){
  const player=sides[event.s].players.get(name(event.n));
  if(!player)return false;
  counts.set(player.id,(counts.get(player.id)||0)+1);
 }
 return game.teams.every(team=>team.players.every(player=>((player.stats?.two_pm||0)+(player.stats?.three_pm||0))===(counts.get(player.id)||0)));
}
function momentsOf(story,sides,game){
 const moments=[];
 story.events.forEach((event,index)=>{
  if(!index||!event.m||!(isFieldGoal(event)||event.k==='free_throw'))return;
  const player=sides[event.s]?.players.get(name(event.n));
  if(!player)return;
  const before=story.events[index-1].w,from=event.s==='h'?before:1-before,to=event.s==='h'?event.w:1-event.w;
  if(Math.round((to-from)*1000)/1000<MOMENT_MIN_SWING)return;
  moments.push({player:player.id,moment:{game:game.id,date:game.date?.slice(0,10)??null,t:event.t,period:event.p,clock:event.c,kind:event.k,home:story.home.name,away:story.away.name,scoreHome:event.h,scoreAway:event.a,side:event.s,from:Math.round(from*1000)/1000,to:Math.round(to*1000)/1000}});
 });
 return moments;
}
export function playerEventsFromSeason(matches,stories){
 const byId=new Map(matches.filter(game=>game.verified).map(game=>[String(game.id),game])),players={},excluded=[];
 let games=0;
 const row=id=>players[id]??={games:0,baskets:blankBaskets(),moments:[]};
 for(const story of stories){
  const game=byId.get(String(story.match_id));
  if(!game)continue;
  const sides=roster(game),kinds=basketKinds(story.events);
  if(!sides.h||!sides.a||!reconciles(game,sides,kinds)){excluded.push(String(story.match_id));continue;}
  games++;
  for(const team of game.teams)for(const player of team.players)if(player.minutesValue>0||player.participated===true)row(player.id).games++;
  for(const {event,kind} of kinds)row(sides[event.s].players.get(name(event.n)).id).baskets[kind][event.k==='3pt'?'three':'two']++;
  for(const {player,moment} of momentsOf(story,sides,game))row(player).moments.push(moment);
 }
 for(const value of Object.values(players))value.moments=value.moments.sort((a,b)=>(b.to-b.from)-(a.to-a.from)).slice(0,MOMENTS_SHOWN);
 return {games,excluded,players};
}
export const basketTotal=baskets=>Object.values(baskets).reduce((sum,kind)=>sum+kind.two+kind.three,0);
