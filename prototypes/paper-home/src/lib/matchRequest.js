import {playerDisplayName} from './playerName.ts';

export async function fetchMatches(url,signal,request=fetch){
 const response=await request(url,{signal});
 if(!response.ok)throw new Error('Match data request failed');
 const games=await response.json();
 if(!Array.isArray(games))throw new Error('Invalid match data');
 // Normalize the display casing once at the data boundary; IDs and source files stay intact.
 return games.map(game=>{
  if(!Array.isArray(game?.teams))return game;
  return {...game,teams:game.teams.map(team=>{
   if(!Array.isArray(team?.players))return team;
   return {...team,players:team.players.map(player=>({...player,name:playerDisplayName(player?.name)}))};
  })};
 });
}
export function visibleMatchState(state,url,cache){
 return state.url===url?state:{games:cache.get(url)||null,error:false};
}
