import {useEffect,useRef,useState} from 'react';
export function useHomeMotion(target){
 const root=useRef(null),[number,setNumber]=useState(target);
 useEffect(()=>{
  const el=root.current,media=matchMedia('(prefers-reduced-motion: reduce)');
  let frame=0,observer,started=false;
  const finish=()=>{cancelAnimationFrame(frame);observer?.disconnect();el.classList.remove('motion-ready');setNumber(target);};
  if(media.matches||!('IntersectionObserver' in window)){finish();return;}
  setNumber(0);el.classList.add('motion-ready');
  const count=()=>{
   if(started)return;started=true;
   let start;
   const tick=time=>{start??=time;const progress=Math.min(1,(time-start)/600);setNumber(target*progress);if(progress<1)frame=requestAnimationFrame(tick);};
   frame=requestAnimationFrame(tick);
  };
  observer=new IntersectionObserver(entries=>{
   for(const entry of entries)if(entry.isIntersecting&&entry.intersectionRatio>=.25){entry.target.dataset.visible='true';observer.unobserve(entry.target);if(entry.target.classList.contains('insight-data'))count();}
  },{threshold:.25,rootMargin:'0px 0px -80px 0px'});
  for(const section of el.querySelectorAll('.home-insight>div,.home-analysis>header,.analysis-example,.home-explore>header,.explore-options>button,.site-footer')){section.classList.add('home-reveal');delete section.dataset.visible;observer.observe(section);}
  const keyboard=e=>{if(e.key==='Tab'||e.key==='End'||e.key==='Home')finish();};
  const preference=()=>{if(media.matches)finish();};
  document.addEventListener('keydown',keyboard);media.addEventListener('change',preference);
  return()=>{cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('keydown',keyboard);media.removeEventListener('change',preference);};
 },[target]);
 return {root,number};
}
