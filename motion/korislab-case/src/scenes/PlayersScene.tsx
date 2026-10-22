import {CanvasImage,Interactive,interpolate,staticFile,useCurrentFrame,useVideoConfig} from 'remotion';
import {AdFrame,cardStyle} from '../AdFrame';
import {colors,ease,fi} from '../design';
import {data} from '../data';
const labels=['Pisteet / ottelu','Syötöt / ottelu','Levypallot / ottelu'],units=['PTS / O','AST / O','REB / O'];
const PlayersSceneInner=()=>{const frame=useCurrentFrame(),{fps}=useVideoConfig();return <AdFrame title="Löydä kauden kärjet.">
 {data.leaders.map((player,index)=><Interactive.Div name={`Leader ${player.metric}`} key={player.metric} style={{...cardStyle,position:'absolute',left:144+index*556,top:439,width:520,height:448,padding:'34px 36px',boxSizing:'border-box',opacity:interpolate(frame,[index*.055*fps,(.28+index*.055)*fps],[0,1],ease),translate:interpolate(frame,[index*.055*fps,(.38+index*.055)*fps],['0px 46px','0px 0px'],ease)}}><div style={{fontSize:28,color:colors.muted}}>{labels[index]}</div><div style={{display:'flex',alignItems:'center',gap:15,marginTop:25}}><CanvasImage src={staticFile('player-default.png')} premountFor={fps} style={{width:70,height:78,objectFit:'contain',opacity:.75}}/><div style={{fontSize:29,fontWeight:600,lineHeight:1.25}}>{player.name}</div></div><div style={{color:colors.muted,fontSize:24,marginTop:14}}>{player.team}</div><div style={{fontSize:111,color:index===0?colors.orange:colors.green,fontWeight:600,letterSpacing:'-.045em',fontVariantNumeric:'tabular-nums',marginTop:27,lineHeight:1}}>{fi(player.value)}</div><div style={{fontSize:25,color:colors.muted,marginTop:19}}>{units[index]} · {player.games} ottelua</div></Interactive.Div>)}
 </AdFrame>;};
export const PlayersScene=Interactive.withSchema({Component:PlayersSceneInner,componentName:'PlayersScene',schema:{},wrapInSequence:true,layout:'absolute-fill'});
