export async function fetchMatches(url,signal,request=fetch){
 const response=await request(url,{signal});
 if(!response.ok)throw new Error('Match data request failed');
 const games=await response.json();
 if(!Array.isArray(games))throw new Error('Invalid match data');
 return games;
}
export function visibleMatchState(state,url,cache){
 return state.url===url?state:{games:cache.get(url)||null,error:false};
}
