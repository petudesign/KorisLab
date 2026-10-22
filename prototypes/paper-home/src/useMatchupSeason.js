import {useCallback,useEffect,useState} from 'react';
import {useSeason,getSeason} from './SeasonContext';
import {matchupRecords} from './lib/matchupRecords';
const requests=new Map();
export function useMatchupSeason(){
 const selected=useSeason();
 const [attempt,setAttempt]=useState(0),[state,setState]=useState(null);
 const loadMatchesForSeason=useCallback((season,phase='regular')=>{
  if(season==='2026-27'&&phase==='playoffs')return Promise.resolve([]);
  const url=`/data/${selected.leagueId}-${season}-${phase==='playoffs'?'playoffs':'matches'}.json`;
  if(!requests.has(url))requests.set(url,fetch(url).then(r=>{if(!r.ok)throw Error('Comparison data unavailable');return r.json();}).then(rows=>phase==='regular'?matchupRecords(rows):rows).catch(e=>{requests.delete(url);throw e;}));
  return requests.get(url);
 },[selected.leagueId,attempt]);
 useEffect(()=>{
  let cancelled=false;
  loadMatchesForSeason('2026-27').then(matches=>{if(!cancelled)setState({league:selected.leagueId,matches});}).catch(()=>{if(!cancelled)setState({league:selected.leagueId,error:true});});
  return()=>{cancelled=true;};
 },[loadMatchesForSeason,selected.leagueId]);
 const current=state?.league===selected.leagueId&&state.matches?{matches:state.matches,schedule:getSeason(selected.leagueId,'2026-27').schedule}:null;
 const assetPath=useCallback(filename=>`/data/${selected.leagueId}-${filename.replace('onoff-','').replace('.json','')}-onoff.json`,[selected.leagueId]);
 return {...selected,leagueId:selected.leagueId==='men'?'korisliiga':'naisten-korisliiga',current,loading:state?.league!==selected.leagueId,loadMatchesForSeason,assetPath,historicalSummaries:{'2024-25':getSeason(selected.leagueId,'2024-25'),'2025-26':getSeason(selected.leagueId,'2025-26')},refreshCurrent:()=>{requests.delete(`/data/${selected.leagueId}-2026-27-matches.json`);setState(null);setAttempt(n=>n+1);}};
}
