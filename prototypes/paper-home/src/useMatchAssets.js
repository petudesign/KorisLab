import {useEffect,useState} from 'react';
import {useSeason} from './SeasonContext';
import manifest from '../source/match-analysis.json';
import {parseReplay} from './lib/replayStats';
import {parseShotChart} from './lib/shotStats';
const cache=new Map();
export function useMatchAsset(id,kind){
 const {leagueId,seasonId}=useSeason();
 const entry=manifest[`${leagueId}-${id}`],url=entry?.[kind],key=`${leagueId}-${seasonId}-${id}-${kind}`;
 const [state,setState]=useState({key,status:'loading'}),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  let disposed=false;
  if(!url||(kind==='replays'&&entry.season!==seasonId)){setState({key,status:'missing'});return;}
  setState({key,status:'loading'});
  if(!cache.has(key))cache.set(key,fetch(url).then(r=>{if(!r.ok)throw Error('Asset unavailable');return r.json();}).then(json=>kind==='replays'?parseReplay(json,id,seasonId):parseShotChart(json,id)).catch(error=>{cache.delete(key);throw error;}));
  cache.get(key).then(data=>{if(!disposed)setState({key,status:'ready',data});}).catch(()=>{if(!disposed)setState({key,status:'error'});});
  return()=>{disposed=true;};
 },[key,url,attempt]);
 return {...(state.key===key?state:{status:'loading'}),retry:()=>setAttempt(n=>n+1)};
}
