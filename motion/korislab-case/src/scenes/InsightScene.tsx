import {AbsoluteFill,CanvasImage,Interactive,interpolate,staticFile,useCurrentFrame,useVideoConfig} from 'remotion';
import {Background,Header,Footer,colors,ease,fi} from '../design';
import {data} from '../data';
const InsightSceneInner=({tempo=1}:{tempo?:number})=>{
 const frame=useCurrentFrame()*tempo,{fps}=useVideoConfig();
 const number=interpolate(frame,[.35*fps,1.2*fps],[0,data.ebt.orb],ease);
 const x=(index:number)=>80+index*110,y=(value:number)=>160-(value-20)*4;
 const line=data.series.map((game,index)=>index===0?`M${x(index)},${y(game.value??0)}`:`C${x(index-1)+55},${y(data.series[index-1].value??0)} ${x(index)-55},${y(game.value??0)} ${x(index)},${y(game.value??0)}`).join(' ');
 return <AbsoluteFill style={{fontFamily:'Inter',color:colors.text}}><Background/><Header/>
  <Interactive.Div name="Insight headline" style={{position:'absolute',left:144,top:231,fontFamily:'Cal Sans',fontSize:126,letterSpacing:'-.035em',opacity:interpolate(frame,[0,.45*fps],[0,1],ease),translate:interpolate(frame,[0,.7*fps],['0px 35px','0px 0px'],ease)}}>Toiset mahdollisuudet.</Interactive.Div>
  <Interactive.Div name="Season highlight card" style={{position:'absolute',left:320,top:428,width:1280,height:474,padding:'48px 58px',borderRadius:28,border:`1px solid ${colors.line}`,background:'linear-gradient(135deg,#1d1d20,#161617)',boxShadow:'0 28px 80px #0008,inset 0 1px 0 #ffffff06',opacity:interpolate(frame,[.08*fps,.5*fps],[0,1],ease),translate:interpolate(frame,[.08*fps,.85*fps],['0px 68px','0px 0px'],ease),scale:interpolate(frame,[.08*fps,.85*fps],[.97,1],{...ease,output:'perceptual-scale'})}}>
   <div style={{position:'absolute',right:0,top:0,width:'55%',height:'100%',backgroundImage:'radial-gradient(#df945b3b .8px,transparent .8px)',backgroundSize:'7px 7px',maskImage:'linear-gradient(110deg,transparent,#000)',opacity:.5}}/>
   <div style={{fontSize:34,color:colors.muted}}>Paras hyökkäyslevypalloprosentti</div>
   <div style={{marginTop:22,display:'flex',alignItems:'baseline',gap:20}}><span style={{fontSize:170,fontWeight:600,letterSpacing:'-.05em',fontVariantNumeric:'tabular-nums',color:colors.orange,lineHeight:1}}>{fi(number)}</span><span style={{fontSize:36,color:colors.muted}}>ORB %</span></div>
   <div style={{display:'flex',alignItems:'center',gap:18,marginTop:24,fontSize:36}}><CanvasImage src={staticFile('logos/ebt.png')} premountFor={fps} style={{width:55,height:55,objectFit:'contain'}}/>{data.ebt.name}<span style={{color:colors.muted,fontSize:26}}>· {data.ebt.games} ottelua</span></div>
   <svg width="550" height="220" viewBox="0 0 600 220" style={{position:'absolute',right:58,top:122,overflow:'visible'}}>
    <defs><linearGradient id="insight-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={colors.orange} stopOpacity=".27"/><stop offset="1" stopColor={colors.orange} stopOpacity="0"/></linearGradient><clipPath id="curve-reveal"><rect width={interpolate(frame,[.6*fps,1.7*fps],[0,600],ease)} height="220"/></clipPath></defs>
    <g clipPath="url(#curve-reveal)"><path d={`${line}L520,190L80,190Z`} fill="url(#insight-fill)"/><path d={line} fill="none" stroke={colors.orange} strokeWidth="3" strokeLinejoin="round" style={{filter:'drop-shadow(0px 0px 5px #df945b44)'}}/>{data.series.map((game,index)=><circle key={game.date} cx={x(index)} cy={y(game.value??0)} r="4" fill={colors.orange}/>)}</g>
   </svg>
   <div style={{position:'absolute',right:75,top:330,fontSize:24,color:colors.muted}}>Viimeiset 5 ottelua</div>
   <div style={{position:'absolute',left:58,right:58,bottom:31,display:'flex',justifyContent:'space-between',borderTop:'1px solid #ffffff12',paddingTop:20,fontSize:26,color:colors.muted}}><span>Liigan KA</span><span style={{color:colors.text}}>{fi(data.leagueOrb)} %</span></div>
  </Interactive.Div><Footer/>
 </AbsoluteFill>;
};
export const InsightScene=Interactive.withSchema({Component:InsightSceneInner,componentName:'InsightScene',schema:{tempo:{type:'number',default:1,hiddenFromList:false}},wrapInSequence:true,layout:'absolute-fill'});
