import {useEffect,useState} from 'react';
import {fetchMatches,visibleMatchState} from './lib/matchRequest';
const cache=new Map();
export function useMatches(url){
 const [state,setState]=useState(()=>({url,games:cache.get(url)||null,error:false})),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  if(!url){setState({url,games:null,error:false});return;}
  const controller=new AbortController();
  setState({url,games:cache.get(url)||null,error:false});
  if(!cache.has(url))fetchMatches(url,controller.signal).then(games=>{if(controller.signal.aborted)return;cache.set(url,games);setState({url,games,error:false});}).catch(e=>{if(!controller.signal.aborted)setState({url,games:null,error:true});});
  return()=>controller.abort();
 },[url,attempt]);
 // Never flash the previous season while an effect switches to a new request.
 return {...visibleMatchState(state,url,cache),retry:()=>{cache.delete(url);setState({url,games:null,error:false});setAttempt(n=>n+1);}};
}
