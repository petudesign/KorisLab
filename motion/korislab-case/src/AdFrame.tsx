import type {ReactNode} from 'react';
import {AbsoluteFill,Interactive,interpolate,useCurrentFrame,useVideoConfig} from 'remotion';
import {Background,Footer,Header,colors,ease} from './design';
export function AdFrame({title,children}:{title:string;children:ReactNode}){
 const frame=useCurrentFrame(),{fps}=useVideoConfig();
 return <AbsoluteFill style={{fontFamily:'Inter',color:colors.text}}><Background/><Header/>
  <Interactive.Div name="Feature headline" style={{position:'absolute',left:144,top:232,fontFamily:'Cal Sans',fontSize:120,letterSpacing:'-.035em',opacity:interpolate(frame,[0,.22*fps],[0,1],ease),translate:interpolate(frame,[0,.3*fps],['0px 24px','0px 0px'],ease)}}>{title}</Interactive.Div>
  {children}<Footer/>
 </AbsoluteFill>;
}
export const cardStyle={background:'linear-gradient(135deg,#1d1d20,#161617)',border:`1px solid ${colors.line}`,borderRadius:28,boxShadow:'0 24px 80px #0007,inset 0 1px 0 #ffffff06'};
