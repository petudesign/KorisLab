import {AbsoluteFill,Interactive,interpolate,useCurrentFrame,useVideoConfig} from 'remotion';
import {Background,Brand,colors,ease} from '../design';
const BrandSceneInner=()=>{
 const frame=useCurrentFrame(),{fps}=useVideoConfig();
 return <AbsoluteFill style={{fontFamily:'Inter',color:colors.text}}><Background/>
  <Interactive.Div name="KorisLab brand" style={{position:'absolute',left:interpolate(frame,[1.7*fps,2.1*fps],[960,144],ease),top:interpolate(frame,[1.7*fps,2.1*fps],[490,100],ease),translate:interpolate(frame,[1.7*fps,2.1*fps],['-50% -50%','0% 0%'],ease),opacity:interpolate(frame,[0,.22*fps],[0,1],ease),scale:interpolate(frame,[0,1.3*fps],[1.055,1],{...ease,output:'perceptual-scale'})}}><Brand size={interpolate(frame,[1.7*fps,2.1*fps],[208,52],ease)} animated/></Interactive.Div>
  <Interactive.Div name="Brand promise" style={{position:'absolute',top:652,width:'100%',textAlign:'center',fontFamily:'Array',fontSize:72,fontWeight:600,color:colors.orange,opacity:interpolate(frame,[.7*fps,1.15*fps,1.7*fps,2*fps],[0,1,1,0],ease),translate:interpolate(frame,[.7*fps,1.3*fps],['0px 26px','0px 0px'],ease)}}>Näe peli numeroiden takaa.</Interactive.Div>
 </AbsoluteFill>;
};
export const BrandScene=Interactive.withSchema({Component:BrandSceneInner,componentName:'BrandScene',schema:{},wrapInSequence:true,layout:'absolute-fill'});
