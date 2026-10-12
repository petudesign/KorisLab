import {useEffect,useState} from 'react';
const cache=new Map();
export function usePlayerBio(leagueId,seasonId,playerId){
 const key=`${leagueId}-${seasonId}`;
 const [result,setResult]=useState(null);
 useEffect(()=>{
  let cancelled=false;
  const request=cache.get(key)||fetch(`/data/profiles/${key}.json`).then(response=>{if(!response.ok)throw new Error('Profile data unavailable');return response.json();}).then(data=>{
   if(data.schema_version!=='0.1'||data.season_id!==seasonId||data.league_id!==(leagueId==='men'?'korisliiga':'naisten-korisliiga'))throw new Error('Profile dataset mismatch');
   return data;
  });
  cache.set(key,request);
  request.then(data=>{if(!cancelled)setResult({key,data});}).catch(()=>{cache.delete(key);if(!cancelled)setResult({key,data:null});});
  return()=>{cancelled=true;};
 },[key,leagueId,seasonId]);
 return result?.key===key?result.data?.players[playerId]||null:null;
}
