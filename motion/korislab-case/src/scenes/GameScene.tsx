import {Interactive,interpolate,useCurrentFrame,useVideoConfig} from 'remotion';
import {AdFrame,cardStyle} from '../AdFrame';
import {colors,ease} from '../design';
import {data} from '../data';
const GameSceneInner=()=>{
 const frame=useCurrentFrame(),{fps}=useVideoConfig();
 const home=[0],away=[0];for(const period of data.game.periods){home.push(home[home.length-1]+period.home_score);away.push(away[away.length-1]+period.away_score);}
 const x=(i:number)=>65+i*145,y=(n:number)=>270-n*2.2;
 const path=(values:number[])=>values.map((n,i)=>`${i?'L':'M'}${x(i)},${y(n)}`).join(' ');
 return <AdFrame title="Seuraa ottelun kulkua."><Interactive.Div name="Game analysis" style={{...cardStyle,position:'absolute',left:280,top:430,width:1360,height:465,opacity:interpolate(frame,[0,.2*fps],[0,1],ease),translate:interpolate(frame,[0,.3*fps],['0px 30px','0px 0px'],ease)}}>
 <div style={{position:'absolute',left:54,top:55,width:470}}><div style={{fontSize:38}}>{data.game.home}</div><div style={{fontWeight:600,fontVariantNumeric:'tabular-nums',letterSpacing:'-.045em',fontSize:126,marginTop:22}}><span style={{color:data.game.homeScore>data.game.awayScore?colors.text:colors.muted}}>{data.game.homeScore}</span><span style={{fontWeight:400,fontSize:68,color:colors.muted}}> – </span><span style={{color:data.game.awayScore>data.game.homeScore?colors.text:colors.muted}}>{data.game.awayScore}</span></div><div style={{fontSize:35,color:colors.muted,marginTop:18}}>{data.game.away}</div><div style={{fontSize:27,color:colors.muted,marginTop:36}}>Neljännesten lopputilanteet</div></div>
 <svg width="680" height="320" viewBox="0 0 710 330" style={{position:'absolute',right:48,top:55}}><defs><clipPath id="game-line-reveal"><rect width={interpolate(frame,[.25*fps,1.3*fps],[0,710],ease)} height="330"/></clipPath></defs>{[0,45,90].map(n=><g key={n}><line x1="65" x2="645" y1={y(n)} y2={y(n)} stroke="#ffffff10"/><text x="43" y={y(n)+7} textAnchor="end" fill={colors.muted} fontSize="23">{n}</text></g>)}<g clipPath="url(#game-line-reveal)"><path d={path(home)} stroke={colors.orange} strokeWidth="3.5" fill="none"/><path d={path(away)} stroke={colors.blue} strokeWidth="3.5" fill="none"/>{home.map((n,i)=><circle key={i} cx={x(i)} cy={y(n)} r="4.5" fill={colors.orange}/>)}{away.map((n,i)=><circle key={i} cx={x(i)} cy={y(n)} r="4.5" fill={colors.blue}/>)}</g>{home.map((_,i)=><text key={i} x={x(i)} y="308" textAnchor="middle" fill={colors.muted} fontSize="24">{i?`${i}.`:'Alku'}</text>)}</svg>
 <div style={{position:'absolute',right:48,top:394,display:'flex',gap:25,fontSize:23}}><span style={{color:colors.orange}}>● {data.game.home}</span><span style={{color:colors.blue}}>● {data.game.away}</span></div>
 </Interactive.Div></AdFrame>;
};
export const GameScene=Interactive.withSchema({Component:GameSceneInner,componentName:'GameScene',schema:{},wrapInSequence:true,layout:'absolute-fill'});
