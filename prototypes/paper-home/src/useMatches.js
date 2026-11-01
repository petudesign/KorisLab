import {useEffect,useState} from 'react';
import {fetchMatches,sharedRequests,visibleMatchState} from './lib/matchRequest';
const cache=new Map();
// Several components on one page ask for the same season; the request outlives any one of them.
const loadMatches=sharedRequests(url=>fetchMatches(url).then(games=>{cache.set(url,games);return games;}));
export function useMatches(url){
 const [state,setState]=useState(()=>({url,games:cache.get(url)||null,error:false})),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  if(!url){setState({url,games:null,error:false});return;}
  let active=true;
  setState({url,games:cache.get(url)||null,error:false});
  if(!cache.has(url))loadMatches(url).then(games=>{if(active)setState({url,games,error:false});}).catch(()=>{if(active)setState({url,games:null,error:true});});
  return()=>{active=false;};
 },[url,attempt]);
 // Never flash the previous season while an effect switches to a new request.
 return {...visibleMatchState(state,url,cache),retry:()=>{cache.delete(url);setState({url,games:null,error:false});setAttempt(n=>n+1);}};
}
