import {lazy,Suspense,useEffect,useState} from 'react';
import {afterPageSettled,canShowHeroFog} from './lib/shaderBudget';
const HeroFog=lazy(()=>import('./HeroFog'));

// The static haze shows at once; the animated Fog replaces it only where it is visible and affordable.
export function HeroHaze({reduced}){
 const [fog,setFog]=useState(false);
 useEffect(()=>{
  if(reduced){setFog(false);return;}
  let active=true;
  const cancel=afterPageSettled(async()=>{
   const allowed=await canShowHeroFog({wide:matchMedia('(min-width:701px)').matches,saveData:navigator.connection?.saveData,gpu:navigator.gpu});
   if(active&&allowed)setFog(true);
  });
  return()=>{active=false;cancel();};
 },[reduced]);
 const haze=<div className="premium-fog" aria-hidden="true" data-shader-state="fallback"/>;
 return fog?<Suspense fallback={haze}><HeroFog/></Suspense>:haze;
}
