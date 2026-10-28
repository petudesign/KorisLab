import {useId,useMemo,useState} from 'react';
import {useI18n} from './i18n';
import {playerRatings,ratingAxes,typeLabels} from './lib/playerRatings';
import './matchup-radar.css';
import './player-ratings.css';
const point=(index,score)=>{const angle=index*Math.PI/3-Math.PI/2,r=score/100*126;return [210+Math.cos(angle)*r,195+Math.sin(angle)*r];};
const polygon=values=>values.map((v,i)=>point(i,v).join(',')).join(' ');
const labels=[[210,39],[352,116],[352,285],[210,359],[68,285],[68,116]];

export function PlayerRatings({player,players}){
 const {language}=useI18n(),say=(fi,en)=>language==='fi'?fi:en,id=useId();
 const [active,setActive]=useState(null);
 const result=useMemo(()=>playerRatings(player,players),[player,players]);
 if(!result)return null;
 const n=(value,decimals=1)=>Number.isFinite(value)?value.toLocaleString(language==='fi'?'fi-FI':'en-GB',{minimumFractionDigits:decimals,maximumFractionDigits:decimals}):'—';
 const heading=<header><h2 id={id}>{say('Pelaajaprofiili','Player profile')}</h2></header>;
 if(!result.qualified)return <section className="dash-card matchup-radar player-ratings" aria-labelledby={id}>{heading}
  <p className="player-ratings-pending">{say(`Profiili lasketaan, kun pelaaja on pelannut vähintään ${n(result.threshold,0)} minuuttia. Nyt ${n(result.minutes,0)} minuuttia.`,`The profile appears after ${n(result.threshold,0)} minutes played. Now ${n(result.minutes,0)} minutes.`)}</p></section>;
 const s=result.shown;
 const detail={
  scoring:`${n(s.scoring)} ${say('pistettä / 40 min','points / 40 min')}`,
  efficiency:`TS ${n(s.efficiency)} %`,
  threes:`${n(s.threePct)} % · ${n(s.threePA)} ${say('yritystä / 40 min','attempts / 40 min')}`,
  playmaking:`${n(s.assists)} ${say('syöttöä / 40 min','assists / 40 min')} · AST/TO ${n(s.assistTurnover)}`,
  rebounding:`${n(s.rebounding)} ${say('levypalloa / 40 min','rebounds / 40 min')}`,
  defense:`${n(s.defense)} ${say('riistoa + torjuntaa / 40 min','steals + blocks / 40 min')}`,
 };
 const known=result.axes.filter(axis=>axis.rating!=null);
 return <section className="dash-card matchup-radar player-ratings" aria-labelledby={id}>
  {heading}
  {result.types.length>0&&<p className="player-ratings-types">{result.types.map(type=><span key={type}>{say(...typeLabels[type])}</span>)}</p>}
  <div className="matchup-radar-body"><svg viewBox="0 0 420 390" role="img" aria-label={say('Tutkakaavio pelaajan arvioista. Luvut viereisessä listassa.','Radar chart of the ratings. Values in the adjacent list.')}>
   {[25,50,75,100].map(score=><polygon key={score} points={polygon(ratingAxes.map(()=>score))} className={score===50?'radar-grid radar-grid-mid':'radar-grid'}/>)}
   {ratingAxes.map((axis,i)=>{const end=point(i,100);return <g key={axis.key}><line x1="210" y1="195" x2={end[0]} y2={end[1]} className={active===i?'radar-spoke is-active':'radar-spoke'}/><text x={labels[i][0]} y={labels[i][1]} textAnchor="middle" className={active===i?'is-active':''}>{language==='fi'?axis.fi:axis.en}</text></g>;})}
   <g className="radar-series radar-series-0">
    {known.length===result.axes.length&&<polygon points={polygon(result.axes.map(axis=>axis.rating))}/>}
    {result.axes.map((axis,i)=>{if(axis.rating==null)return null;const p=point(i,axis.rating);return <circle key={axis.key} cx={p[0]} cy={p[1]} r={active===i?5:3}/>;})}
   </g>
   <text x="216" y="128" className="radar-scale">50</text><text x="216" y="67" className="radar-scale">99</text>
  </svg>
  <ul className="player-ratings-list">{result.axes.map((axis,i)=><li key={axis.key} className={active===i?'is-active':''} onPointerEnter={()=>setActive(i)} onPointerLeave={()=>setActive(null)}>
   <span className="player-ratings-name">{language==='fi'?axis.fi:axis.en}<small>{axis.key==='defense'&&axis.rating==null?say('Lähde ei kirjaa riistoja tai torjuntoja','Steals or blocks are missing from the source'):detail[axis.key]}</small></span>
   <strong data-band={axis.rating==null?'none':axis.rating>=80?'high':axis.rating>=60?'good':axis.rating>=40?'mid':'low'}>{axis.rating??'—'}</strong>
   <i aria-hidden="true"><b style={{width:`${axis.rating??0}%`}}/></i>
  </li>)}</ul></div>
  <p className="matchup-radar-note">{say(
   `1–99 kertoo, kuinka suuren osan sarjan ${result.pool} vakiopelaajasta pelaaja ohittaa tällä kaudella. 50 on tyypillinen vakiopelaaja. 100:aa ei anneta kenellekään. Pienet otokset kutistetaan kohti tyypillistä tasoa ennen vertailua. Puolustusta mitataan vain riistoilla ja torjunnoilla, eli se ei näe aitaamista tai sijoittumista.`,
   `1–99 is the share of the league's ${result.pool} regular players this player is ahead of this season. 50 is a typical regular. Nobody gets 100. Small samples are pulled toward the typical level before comparison. Defence is measured only by steals and blocks, so it does not see on-ball defence or positioning.`)}</p>
 </section>;
}
