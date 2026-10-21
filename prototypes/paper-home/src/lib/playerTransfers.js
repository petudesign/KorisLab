const playerNameKey=name=>String(name||'').normalize('NFC').trim().toLocaleLowerCase('fi-FI');

function teamStints(games){
 const players=new Map();
 const ordered=[...games].filter(game=>game.verified&&game.date).sort((a,b)=>a.date.localeCompare(b.date)||String(a.id).localeCompare(String(b.id)));
 for(const game of ordered)for(const team of game.teams||[])for(const player of team.players||[]){
  if(!player.id||!(player.minutesValue>0||player.participated===true))continue;
  let record=players.get(player.id);
  if(!record){record={id:player.id,name:player.name,stints:[]};players.set(player.id,record);}
  record.name=player.name||record.name;
  const previous=record.stints.at(-1);
  if(previous?.teamId===team.id){previous.lastDate=game.date;previous.games++;previous.points+=player.stats?.points||0;previous.minutes+=player.minutesValue;}
  else record.stints.push({teamId:team.id,teamName:team.name,firstDate:game.date,lastDate:game.date,firstGameId:game.id,games:1,points:player.stats?.points||0,minutes:player.minutesValue});
 }
 return players;
}

const nameIndex=players=>{
 const index=new Map();
 for(const player of players.values()){
  const key=playerNameKey(player.name),rows=index.get(key)||[];
  rows.push(player);index.set(key,rows);
 }
 return index;
};

export function detectPlayerTransfers(currentGames,previousGames=[]){
 const current=teamStints(currentGames),previous=teamStints(previousGames),transfers=[];
 const priorNames=nameIndex(previous),currentNames=nameIndex(current),matchedPrevious=new Set();
 const hasPrevious=previousGames.some(game=>game.verified);
 const priorFor=player=>{
  const byId=previous.get(player.id);
  if(byId)return byId;
  const candidates=priorNames.get(playerNameKey(player.name))||[];
  return candidates.length===1&&currentNames.get(playerNameKey(player.name))?.length===1?candidates[0]:null;
 };

 for(const player of current.values()){
  const stints=player.stints,prior=hasPrevious?priorFor(player):null;
  if(prior)matchedPrevious.add(prior.id);
  const first=stints[0];
  if(prior&&first){
   const old=prior.stints.at(-1);
   if(old&&old.teamId!==first.teamId)transfers.push({id:`${player.id}:${old.teamId}:${first.teamId}:${first.firstDate}`,playerId:player.id,name:player.name,from:{id:old.teamId,name:old.teamName},to:{id:first.teamId,name:first.teamName},date:first.firstDate,type:'season',appearances:first.games});
  }else if(hasPrevious&&first){
   transfers.push({id:`${player.id}:tbd:${first.teamId}:${first.firstDate}`,playerId:player.id,name:player.name,from:{id:null,name:'TBD'},to:{id:first.teamId,name:first.teamName},date:first.firstDate,type:'new',appearances:first.games});
  }
  for(let index=1;index<stints.length;index++){
   const from=stints[index-1],to=stints[index];
   transfers.push({id:`${player.id}:${from.teamId}:${to.teamId}:${to.firstDate}`,playerId:player.id,name:player.name,from:{id:from.teamId,name:from.teamName},to:{id:to.teamId,name:to.teamName},date:to.firstDate,type:'midseason',appearances:to.games});
  }
 }

 if(hasPrevious)for(const player of previous.values()){
  if(matchedPrevious.has(player.id))continue;
  const sameName=currentNames.get(playerNameKey(player.name));
  if(sameName?.length)continue;
  const last=player.stints.at(-1);
  if(!last)continue;
  transfers.push({id:`${player.id}:${last.teamId}:tbd:missing`,playerId:player.id,name:player.name,from:{id:last.teamId,name:last.teamName},to:{id:null,name:'TBD'},date:null,type:'missing',appearances:last.games,previousPointsPerGame:last.games?last.points/last.games:null,previousMinutes:last.minutes,previousSeason:true});
 }

 const priority={midseason:0,season:1,new:2,missing:3};
 return transfers.sort((a,b)=>priority[a.type]-priority[b.type]||(a.type==='missing'?(b.previousPointsPerGame||0)-(a.previousPointsPerGame||0):String(b.date||'').localeCompare(String(a.date||'')))||a.name.localeCompare(b.name,'fi'));
}
