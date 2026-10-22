import {useId,useState} from 'react';
import {useI18n} from './i18n';
import {radarAxes,radarProfile} from './lib/matchupRadar';
import './matchup-radar.css';
const point=(index,score)=>{const angle=index*Math.PI/3-Math.PI/2,r=score/100*126;return [210+Math.cos(angle)*r,195+Math.sin(angle)*r];};
const polygon=values=>values.map((v,i)=>point(i,v).join(',')).join(' ');
export function MatchupRadar({entries,league}){
 const {language}=useI18n(),say=(fi,en)=>language==='fi'?fi:en,id=useId();
 const [selected,setSelected]=useState(null),[hover,setHover]=useState(null);
 const active=selected??hover;
 const profiles=entries.map(entry=>radarProfile(entry,league));
 const format=value=>Number.isFinite(value)?value.toLocaleString(language==='fi'?'fi-FI':'en-GB',{minimumFractionDigits:1,maximumFractionDigits:1}):'—';
 const labels=[[210,39],[352,116],[352,285],[210,359],[68,285],[68,116]];
 return <section className="panel matchup-radar" aria-labelledby={id}>
  <header><h2 id={id}>{say('Joukkueiden peliprofiili','Team playing profiles')}</h2><p>{say('Ulommas = parempi sijoitus saman kauden liigassa. Katkoviiva näyttää sijoitusasteikon keskikohdan, ei liigan keskiarvoa.','Further out = a better rank in the same-season league. The dashed line marks the rank-scale midpoint, not the league average.')}</p></header>
  <div className="matchup-radar-key">{entries.map((entry,i)=><span key={entry.id} data-side={i}><i/>{i?'B':'A'} · <strong>{entry.name}</strong><small>{entry.games} {say('ottelua','games')}</small></span>)}</div>
  <div className="matchup-radar-body"><svg viewBox="0 0 420 390" role="img" aria-label={say('Tutkakaavio. Tarkat luvut viereisessä taulukossa.','Radar chart. Exact values in the adjacent table.')}>
   {[25,50,75,100].map(score=><polygon key={score} points={polygon(radarAxes.map(()=>score))} className={score===50?'radar-grid radar-grid-mid':'radar-grid'}/>)}
   {radarAxes.map((axis,i)=>{const end=point(i,100);return <g key={axis.key}><line x1="210" y1="195" x2={end[0]} y2={end[1]} className={active===i?'radar-spoke is-active':'radar-spoke'}/><text x={labels[i][0]} y={labels[i][1]} textAnchor="middle" className={active===i?'is-active':''}>{language==='fi'?axis.fi:axis.en}</text></g>;})}
   {profiles.map((profile,side)=><g key={entries[side].id} className={`radar-series radar-series-${side}`}>
    {profile.every(axis=>axis.percentile!=null)&&<polygon points={polygon(profile.map(axis=>axis.percentile))}/>}
    {profile.map((axis,i)=>{if(axis.percentile==null)return null;const p=point(i,axis.percentile);return <circle key={axis.key} cx={p[0]} cy={p[1]} r={active===i?5:3}><title>{entries[side].name}: {language==='fi'?axis.fi:axis.en} {format(axis.value)} {axis.unit} · {say('Liigasija','League rank')} {axis.rank}/{axis.count}</title></circle>;})}
   </g>)}
   <text x="215" y="191" className="radar-scale">0</text><text x="216" y="128" className="radar-scale">50</text><text x="216" y="67" className="radar-scale">100</text>
  </svg><div className="matchup-radar-values"><table><caption className="sr-only">{say('Peliprofiilin tarkat arvot','Exact playing profile values')}</caption><thead><tr><th>{say('Osa-alue','Dimension')}</th><th>A</th><th>B</th></tr></thead><tbody>{radarAxes.map((axis,i)=><tr key={axis.key} className={active===i?'is-active':''}><th scope="row"><button type="button" aria-pressed={selected===i} onClick={()=>setSelected(selected===i?null:i)} onPointerEnter={()=>setHover(i)} onPointerLeave={()=>setHover(null)} onFocus={()=>setHover(i)} onBlur={()=>setHover(null)}>{language==='fi'?axis.fi:axis.en}<small>{axis.unit}{axis.lower?` · ${say('pienempi parempi','lower is better')}`:''}</small></button></th>{profiles.map((profile,side)=><td key={side} data-side={side}><strong>{format(profile[i].value)}</strong><small>{profile[i].rank==null?'—':`${say('Liigasija','League rank')} ${profile[i].rank}/${profile[i].count}`}</small></td>)}</tr>)}</tbody></table><p>{say('Pienempi luku tarkoittaa parempaa puolustusta ja vähemmän menetyksiä. Kaavion 0–100-asteikko perustuu liigasijoituksiin: 100 on paras. Taulukossa näkyvät alkuperäiset tilastot ja liigasijat.','Lower values mean better defense and fewer turnovers. The chart’s 0–100 scale is based on league ranks: 100 is best. The table shows original statistics and league ranks.')}</p></div></div>
  <p className="matchup-radar-note">{say(`Vertailussa ${league.length} joukkuetta. Hyökkäyslevyt = osuus saatavilla olevista hyökkäyspään levypalloista. TO / 100 perustuu arvioituihin pallonhallintoihin.`,`Reference: ${league.length} teams. Offensive boards = share of available offensive rebounds. TO / 100 uses estimated possessions.`)} {Math.min(...entries.map(entry=>entry.games))<5&&say('Alle viiden ottelun otos: profiili on vielä suuntaa antava.','Fewer than five games: this profile is preliminary.')} {profiles.some(profile=>profile.some(axis=>axis.percentile==null))&&say('Puuttuvaa arvoa ei piirretä nollaksi; vajaa profiili näytetään pisteinä.','Missing values are not plotted as zero; incomplete profiles use points only.')}</p>
 </section>;
}
