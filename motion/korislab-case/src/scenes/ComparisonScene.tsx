import {AbsoluteFill,CanvasImage,Interactive,interpolate,staticFile,useCurrentFrame,useVideoConfig} from 'remotion';
import {Background,Header,Footer,colors,ease,fi} from '../design';
import {data} from '../data';
const names=['Hyökkäys','Puolustus','Heittäminen','Hyökkäyslevyt','Pallonhallinta','Pelinrakennus'];
const position=(index:number,score:number)=>{const angle=index*Math.PI/3-Math.PI/2;return [450+Math.cos(angle)*score*2.25,330+Math.sin(angle)*score*2.25];};
const polygon=(values:readonly number[])=>values.map((value,index)=>position(index,value).join(',')).join(' ');
const labels=[[450,54],[710,183],[710,510],[450,622],[184,510],[184,183]];
const ComparisonSceneInner=({tempo=1}:{tempo?:number})=>{
 const frame=useCurrentFrame()*tempo,{fps}=useVideoConfig();
 const first=data.nokia.profile.map((axis,index)=>(axis.percentile??0)*interpolate(frame,[(.4+index*.025)*fps,(1.45+index*.025)*fps],[0,1],ease));
 const second=data.ebt.profile.map((axis,index)=>(axis.percentile??0)*interpolate(frame,[(.63+index*.025)*fps,(1.72+index*.025)*fps],[0,1],ease));
 return <AbsoluteFill style={{fontFamily:'Inter',color:colors.text}}><Background/><Header/>
  <Interactive.Div name="Comparison headline" style={{position:'absolute',left:144,top:274,fontFamily:'Cal Sans',fontSize:110,lineHeight:1.05,letterSpacing:'-.035em',opacity:interpolate(frame,[0,.45*fps],[0,1],ease),translate:interpolate(frame,[0,.65*fps],['0px 32px','0px 0px'],ease)}}>Enemmän kuin<br/>pistemäärä.</Interactive.Div>
  <Interactive.Div name="Team evidence" style={{position:'absolute',left:144,top:587,opacity:interpolate(frame,[.3*fps,.85*fps],[0,1],ease)}}>
   <div style={{display:'flex',alignItems:'center',gap:22,marginBottom:36}}><CanvasImage src={staticFile('logos/nokia.png')} premountFor={fps} style={{width:68,height:68,objectFit:'contain'}}/><div><div style={{fontSize:38}}>BC Nokia</div><div style={{fontSize:28,color:colors.orange,marginTop:8}}>ORtg {fi(data.nokia.profile[0].value??0)} · liigasija {data.nokia.profile[0].rank}/9</div></div></div>
   <div style={{display:'flex',alignItems:'center',gap:22}}><CanvasImage src={staticFile('logos/ebt.png')} premountFor={fps} style={{width:68,height:68,objectFit:'contain'}}/><div><div style={{fontSize:38}}>Espoo Basket Team</div><div style={{fontSize:28,color:colors.blue,marginTop:8}}>ORtg {fi(data.ebt.profile[0].value??0)} · liigasija {data.ebt.profile[0].rank}/9</div></div></div>
   <div style={{marginTop:36,fontSize:25,color:colors.muted}}>Matchup Lab · {data.ebt.games} ottelua / joukkue</div>
  </Interactive.Div>
  <Interactive.Div name="Radar profile" style={{position:'absolute',left:872,top:230,width:900,height:690,opacity:interpolate(frame,[.1*fps,.5*fps],[0,1],ease),scale:interpolate(frame,[0,1.4*fps],[.96,1],{...ease,output:'perceptual-scale'})}}>
   <svg width="900" height="660" viewBox="0 0 900 660" style={{overflow:'visible'}}>
    {[25,50,75,100].map((score,index)=><polygon key={score} points={polygon(Array(6).fill(score))} fill="none" stroke={score===50?'#ffffff36':'#ffffff10'} strokeWidth="1.5" strokeDasharray={score===50?'6 8':undefined} opacity={interpolate(frame,[index*.045*fps,(.5+index*.045)*fps],[0,1],ease)}/>)}
    {names.map((name,index)=>{const end=position(index,100);return <g key={name}><line x1="450" y1="330" x2={end[0]} y2={end[1]} stroke="#ffffff12" strokeWidth="1.5"/><text x={labels[index][0]} y={labels[index][1]} textAnchor="middle" fill={colors.muted} fontFamily="Inter" fontSize="30">{name}</text></g>;})}
    <polygon points={polygon(first)} fill={colors.orange} fillOpacity=".1" stroke={colors.orange} strokeWidth="3.5" strokeLinejoin="round"/>
    <polygon points={polygon(second)} fill={colors.blue} fillOpacity=".12" stroke={colors.blue} strokeWidth="3.5" strokeDasharray="8 7" strokeLinejoin="round"/>
    {first.map((value,index)=>{const p=position(index,value);return <circle key={index} cx={p[0]} cy={p[1]} r="5" fill={colors.orange}/>;})}
    {second.map((value,index)=>{const p=position(index,value);return <circle key={index} cx={p[0]} cy={p[1]} r="5" fill={colors.blue}/>;})}
    <text x="462" y="325" fill="#68686f" fontSize="20">0</text><text x="462" y="216" fill="#68686f" fontSize="20">50</text><text x="462" y="101" fill="#68686f" fontSize="20">100</text>
   </svg>
   <div style={{textAlign:'center',color:colors.muted,fontSize:25,marginTop:-8}}>Ulommas = parempi liigasijoitus</div>
  </Interactive.Div><Footer/>
 </AbsoluteFill>;
};
export const ComparisonScene=Interactive.withSchema({Component:ComparisonSceneInner,componentName:'ComparisonScene',schema:{tempo:{type:'number',default:1,hiddenFromList:false}},wrapInSequence:true,layout:'absolute-fill'});
