import {useId,useMemo,useState} from 'react';
import {useI18n} from './i18n';
import {playerRatings,ratingAxes,typeLabels} from './lib/playerRatings';
import {useSeason} from './SeasonContext';
import reference from '../source/rating-reference.json';
import './matchup-radar.css';
import './player-ratings.css';
const point=(index,score)=>{const angle=index*Math.PI/3-Math.PI/2,r=score/100*126;return [210+Math.cos(angle)*r,195+Math.sin(angle)*r];};
const polygon=values=>values.map((v,i)=>point(i,v).join(',')).join(' ');
const labels=[[210,39],[352,116],[352,285],[210,359],[68,285],[68,116]];

export function PlayerRatings({player,players}){
 const {language}=useI18n(),say=(fi,en)=>language==='fi'?fi:en,id=useId();
 const [active,setActive]=useState(null),{leagueId}=useSeason();
 const result=useMemo(()=>playerRatings(player,players,reference[leagueId]),[player,players,leagueId]);
 if(!result)return null;
 const n=(value,decimals=1)=>Number.isFinite(value)?value.toLocaleString(language==='fi'?'fi-FI':'en-GB',{minimumFractionDigits:decimals,maximumFractionDigits:decimals}):'—';
 const heading=<header><h2 id={id}>{say('Pelaajaprofiili','Player profile')}</h2></header>;
 if(!result.qualified)return <section className="dash-card matchup-radar player-ratings" aria-labelledby={id}>{heading}
  <p className="player-ratings-pending">{Number.isFinite(result.minutes)?say(`Profiili lasketaan, kun pelaaja on pelannut vähintään ${n(result.threshold,0)} minuuttia. Nyt ${n(result.minutes,0)} minuuttia.`,`The profile appears after ${n(result.threshold,0)} minutes played. Now ${n(result.minutes,0)} minutes.`):say('Peliaika puuttuu lähteestä, joten profiilia ei lasketa.','Playing time is missing from the source, so there is no profile.')}</p></section>;
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
 const season=value=>value.replace('-','–');
 const seasons=result.reference.seasons.map(season).join(say(' ja ',' and '));
 const confidence={early:say('alustava','early'),moderate:say('kohtalainen','moderate'),settled:say('vakiintunut','settled')}[result.reliability];
 return <section className="dash-card matchup-radar player-ratings" aria-labelledby={id}>
  {heading}
  {result.types.length>0&&<p className="player-ratings-types">{result.types.map(type=><span key={type}>{say(...typeLabels[type])}</span>)}</p>}
  <p className="player-ratings-sample" data-reliability={result.reliability}>{say('Otos','Sample')} {n(result.minutes,0)} min · {n(result.minutesPerGame)} {say('min / ottelu','min / game')} · {say('Luotettavuus','Reliability')} <b>{confidence}</b></p>
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
   <span className="player-ratings-name">{language==='fi'?axis.fi:axis.en}<small>{axis.key==='defense'&&axis.rating==null?say('Lähde ei kirjaa riistoja tai torjuntoja','Steals or blocks are missing from the source'):detail[axis.key]}</small>{axis.rank!=null&&<small className="player-ratings-rank">{say(`Sarjan ${axis.rank}. / ${axis.count}`,`League rank ${axis.rank} / ${axis.count}`)}</small>}</span>
   <strong data-band={axis.rating==null?'none':axis.rating>=80?'high':axis.rating>=60?'good':axis.rating>=40?'mid':'low'}>{axis.rating??'—'}</strong>
   <i aria-hidden="true"><b style={{width:`${axis.rating??0}%`}}/></i>
  </li>)}</ul></div>
  <div className="player-ratings-reading"><h3>{say('Mitä tästä voi päätellä','What this tells you')}</h3><ul>
   <li>{say(`Arvio vertaa pelaajan tämän kauden tuotantoa sarjan vakiopelaajiin kausilta ${seasons}. 50 on tyypillinen vakiopelaaja, ja 100:aa ei anneta kenellekään. Asteikko on kiinteä, joten 90 tarkoittaa samaa joka kaudella, ja selvä kärki näkyy selvänä erona. Sarjasija kertoo erikseen järjestyksen tämän kauden ${result.pool} vakiopelaajan joukossa.`,`The rating compares this season's production with the league's regular players in ${seasons}. 50 is a typical regular, and nobody gets 100. The scale is fixed, so 90 means the same every season and a clear lead shows as a clear gap. The league rank gives the order among this season's ${result.pool} regulars.`)}</li>
   <li>{say('Per 40 min -luvut olettavat, että tahti kestäisi pidempään. Lyhyet minuutit pelataan usein toisia vaihtopelaajia vastaan tai ratkaistussa ottelussa, joten pieni otos ja lyhyet vaihdot vedetään vahvemmin kohti tyypillistä tasoa. Luotettavuus kertoo, kuinka paljon minuutteja luvun takana on.','Per-40 numbers assume the pace would hold for longer. Short minutes are often against other benches or in decided games, so small samples and short shifts are pulled harder toward the typical level. Reliability says how many minutes stand behind the number.')}</li>
   <li>{say('Arvio ei kerro roolista, vastustajista tai puolustuksesta riistojen ja torjuntojen ulkopuolella, eikä se ennusta, miten pelaaja pärjäisi isommalla vastuulla.','The rating does not see role, opponents or defence beyond steals and blocks, and it does not predict how a player would do with a bigger role.')}</li>
  </ul></div>
 </section>;
}

// Two players on the same fixed scale: same season (A vs B) or the same player across seasons.
export function PlayerRatingsCompare({entries,leagueId}){
 const {language}=useI18n(),say=(fi,en)=>language==='fi'?fi:en,id=useId();
 const [active,setActive]=useState(null);
 const results=useMemo(()=>entries.map(entry=>entry.player&&playerRatings(entry.player,entry.players,reference[leagueId])),[entries,leagueId]);
 if(results.some(result=>!result))return null;
 const n=(value,decimals=0)=>Number.isFinite(value)?value.toLocaleString(language==='fi'?'fi-FI':'en-GB',{minimumFractionDigits:decimals,maximumFractionDigits:decimals}):'—';
 const confidence={early:say('alustava','early'),moderate:say('kohtalainen','moderate'),settled:say('vakiintunut','settled')};
 return <section className="panel matchup-radar player-ratings-compare" aria-labelledby={id}>
  <header><h2 id={id}>{say('Pelaajaprofiilit','Player profiles')}</h2><p>{say('Samat 1–99-arviot kuin pelaajasivulla. Asteikko on kiinteä, joten eri kausien arviot ovat vertailukelpoisia. 50 on tyypillinen vakiopelaaja.','The same 1–99 ratings as on the player page. The scale is fixed, so ratings from different seasons compare directly. 50 is a typical regular.')}</p></header>
  <div className="matchup-radar-key">{entries.map((entry,i)=><span key={i} data-side={i}><i/>{i?'B':'A'} · <strong>{entry.name}</strong><small>{results[i].qualified?`${n(results[i].minutes)} min · ${confidence[results[i].reliability]}`:say('ei arviota','no rating')}</small></span>)}</div>
  {results.some(result=>!result.qualified)&&<p className="player-ratings-pending">{entries.map((entry,i)=>results[i].qualified?null:<span key={i}>{Number.isFinite(results[i].minutes)?say(`${entry.name}: arvio lasketaan, kun pelaaja on pelannut vähintään ${n(results[i].threshold)} minuuttia (nyt ${n(results[i].minutes)}). `,`${entry.name}: a rating needs at least ${n(results[i].threshold)} minutes (now ${n(results[i].minutes)}). `):say(`${entry.name}: peliaika puuttuu lähteestä, joten arviota ei lasketa. `,`${entry.name}: playing time is missing from the source, so there is no rating. `)}</span>)}</p>}
  <div className="matchup-radar-body"><svg viewBox="0 0 420 390" role="img" aria-label={say('Tutkakaavio kahden pelaajan arvioista. Luvut viereisessä taulukossa.','Radar chart of two players. Values in the adjacent table.')}>
   {[25,50,75,100].map(score=><polygon key={score} points={polygon(ratingAxes.map(()=>score))} className={score===50?'radar-grid radar-grid-mid':'radar-grid'}/>)}
   {ratingAxes.map((axis,i)=>{const end=point(i,100);return <g key={axis.key}><line x1="210" y1="195" x2={end[0]} y2={end[1]} className={active===i?'radar-spoke is-active':'radar-spoke'}/><text x={labels[i][0]} y={labels[i][1]} textAnchor="middle" className={active===i?'is-active':''}>{language==='fi'?axis.fi:axis.en}</text></g>;})}
   {results.map((result,side)=>result.qualified&&<g key={side} className={`radar-series radar-series-${side}`}>
    {result.axes.every(axis=>axis.rating!=null)&&<polygon points={polygon(result.axes.map(axis=>axis.rating))}/>}
    {result.axes.map((axis,i)=>{if(axis.rating==null)return null;const p=point(i,axis.rating);return <circle key={axis.key} cx={p[0]} cy={p[1]} r={active===i?5:3}/>;})}
   </g>)}
   <text x="216" y="128" className="radar-scale">50</text><text x="216" y="67" className="radar-scale">99</text>
  </svg><div className="matchup-radar-values"><table><caption className="sr-only">{say('Pelaajaprofiilien arviot','Player profile ratings')}</caption><thead><tr><th>{say('Osa-alue','Dimension')}</th><th>A</th><th>B</th></tr></thead><tbody>{ratingAxes.map((axis,i)=><tr key={axis.key} className={active===i?'is-active':''} onPointerEnter={()=>setActive(i)} onPointerLeave={()=>setActive(null)}>
   <th scope="row">{language==='fi'?axis.fi:axis.en}</th>
   {results.map((result,side)=>{const value=result.qualified?result.axes[i]:null;return <td key={side} data-side={side}><strong>{value?.rating??'—'}</strong>{value?.rank!=null&&<small>{say(`Sarjan ${value.rank}. / ${value.count}`,`Rank ${value.rank} / ${value.count}`)}</small>}</td>;})}
  </tr>)}</tbody></table></div></div>
  <p className="matchup-radar-note">{say('Sarjasija kertoo järjestyksen saman kauden vakiopelaajien joukossa. Per 40 min -luvut on kutistettu kohti tyypillistä tasoa sitä vahvemmin, mitä pienempi otos ja lyhyemmät minuutit per ottelu. Puolustusta mitataan vain riistoilla ja torjunnoilla.','The rank is among the same season’s regular players. Per-40 numbers are pulled toward the typical level more for smaller samples and shorter minutes per game. Defence is measured only by steals and blocks.')}</p>
 </section>;
}
