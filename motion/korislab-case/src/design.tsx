import {AbsoluteFill,Easing,interpolate,useCurrentFrame,useVideoConfig} from 'remotion';
import './fonts';
export const colors={background:'#0b0b0b',surface:'#19191b',line:'#303033',text:'#f1f1f3',muted:'#929297',green:'#44d17a',orange:'#df945b',blue:'#91b4c8'};
export const ease={extrapolateLeft:'clamp' as const,extrapolateRight:'clamp' as const,easing:Easing.bezier(.16,1,.3,1)};
export const fi=(n:number)=>n.toLocaleString('fi-FI',{minimumFractionDigits:1,maximumFractionDigits:1});
export function Background(){return <AbsoluteFill style={{background:colors.background,color:colors.text,fontFamily:'Inter',overflow:'hidden'}}/>;}
export function Brand({size=56,animated=false}:{size?:number;animated?:boolean}){
 const frame=useCurrentFrame(),{fps}=useVideoConfig();
 return <div style={{display:'flex',alignItems:'center',gap:size*.19,fontFamily:'Cal Sans',fontSize:size,lineHeight:1,letterSpacing:'-.045em',whiteSpace:'nowrap'}}>
  <svg width={size*.88} height={size*.8} viewBox="0 0 28 24" fill={colors.green}><g transform="translate(5 2) skewX(-13)">
   <rect x="0" y="7" width="5" height="13" rx="2" opacity=".68" style={{transformOrigin:'2.5px 20px',scale:`1 ${animated?interpolate(frame,[.06*fps,.45*fps],[0,1],ease):1}`}}/>
   <rect x="8" y="0" width="5" height="20" rx="2" style={{transformOrigin:'10.5px 20px',scale:`1 ${animated?interpolate(frame,[.14*fps,.65*fps],[0,1],ease):1}`}}/>
   <rect x="16" y="10" width="5" height="10" rx="2" opacity=".84" style={{transformOrigin:'18.5px 20px',scale:`1 ${animated?interpolate(frame,[.24*fps,.75*fps],[0,1],ease):1}`}}/>
  </g></svg><span>Koris<span style={{color:colors.green}}>Lab</span></span>
 </div>;
}
export function Header({delayed=false}:{delayed?:boolean}){const frame=useCurrentFrame(),{fps}=useVideoConfig();return <div style={{position:'absolute',left:144,top:100,opacity:delayed?interpolate(frame,[.3*fps,.5*fps],[0,1],ease):1}}><Brand size={52}/></div>;}
export function Footer(){return <div style={{position:'absolute',left:144,right:144,bottom:66,display:'flex',justifyContent:'space-between',fontSize:25,color:colors.muted}}><span>Naisten Korisliiga · 2025–26</span><span>korislab.vercel.app</span></div>;}
