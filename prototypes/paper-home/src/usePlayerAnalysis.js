import {useEffect,useState} from 'react';
import manifest from '../source/player-analysis.json';
import {parsePlayerShotIndex} from './lib/playerShots';
import {parseAssistStats} from './lib/assistStats';
const cache=new Map();
export function usePlayerAnalysis(leagueId,seasonId,kind){
 const key=`${leagueId}-${seasonId}-${kind}`,url=manifest[`${leagueId}-${seasonId}`]?.[kind];
 const [attempt,setAttempt]=useState(0),[state,setState]=useState(null);
 useEffect(()=>{
  if(!url)return;
  let cancelled=false;
  const request=cache.get(key)||fetch(url).then(response=>{if(!response.ok)throw new Error('Analysis unavailable');return response.json();}).then(value=>kind==='shots'?parsePlayerShotIndex(value,seasonId):parseAssistStats(value,seasonId));
  cache.set(key,request);
  request.then(data=>{if(!cancelled)setState({key,data,status:'ready'});}).catch(()=>{cache.delete(key);if(!cancelled)setState({key,data:null,status:'error'});});
  return()=>{cancelled=true;};
 },[key,url,seasonId,kind,attempt]);
 return {status:!url?'missing':state?.key===key?state.status:'loading',data:state?.key===key?state.data:null,retry:()=>{setState(null);setAttempt(n=>n+1);}};
}
