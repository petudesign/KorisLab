import {AbsoluteFill,Interactive,interpolate,useCurrentFrame,useVideoConfig} from 'remotion';
import {Background,Brand,colors,ease} from '../design';
const HookSceneInner=()=>{const frame=useCurrentFrame(),{fps}=useVideoConfig();return <AbsoluteFill style={{fontFamily:'Inter',color:colors.text}}><Background/>
 <Interactive.Div name="Opening brand" style={{position:'absolute',left:144,top:100,opacity:interpolate(frame,[0,.16*fps],[0,1],ease)}}><Brand size={52} animated/></Interactive.Div>
 <Interactive.Div name="Opening question" style={{position:'absolute',left:144,top:334,fontFamily:'Cal Sans',fontSize:154,lineHeight:1.03,letterSpacing:'-.04em',opacity:interpolate(frame,[0,.2*fps],[0,1],ease),translate:interpolate(frame,[0,.35*fps],['0px 30px','0px 0px'],ease)}}>Pelkkä tulos ei<br/>kerro kaikkea.</Interactive.Div>
 <Interactive.Div name="Opening accent" style={{position:'absolute',left:150,top:755,fontFamily:'Array',fontSize:56,fontWeight:600,color:colors.orange,opacity:interpolate(frame,[.25*fps,.5*fps],[0,1],ease)}}>Katso pintaa syvemmälle.</Interactive.Div>
 </AbsoluteFill>;};
export const HookScene=Interactive.withSchema({Component:HookSceneInner,componentName:'HookScene',schema:{},wrapInSequence:true,layout:'absolute-fill'});
