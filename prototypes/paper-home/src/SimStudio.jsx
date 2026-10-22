import {useEffect,useRef,useState} from 'react';
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded';
import PauseRounded from '@mui/icons-material/PauseRounded';
import {t,locale} from './i18n';
import {LoadingSkeleton,StateCard} from './PageStates';
import {createSimCourt,TEAM_COLORS} from './lib/simCourt';
import './sim-studio.css';

const BASE='/data/sims/';
const CAMERAS=[['broadcast','Lähetys'],['tactical','Taktinen'],['baseline','Päätyviiva'],['orbit','Vapaa']];
const SPEEDS=[1,4,12,30];
const fmt=(v,d=0)=>Number(v).toLocaleString(locale(),{minimumFractionDigits:d,maximumFractionDigits:d});
const pct=v=>`${fmt(v*100)} %`;
const titleCase=name=>name.split(/\s+/).map(w=>w.charAt(0)+w.slice(1).toLocaleLowerCase('fi')).join(' ');
const shortName=name=>titleCase(name.split(/\s+/).at(-1)??name);
const dateLabel=(date,options)=>new Date(`${date}T12:00:00`).toLocaleDateString(locale(),options);

function describe(e,players,teams){
 const n=pid=>players[pid]?.short??t('Joukkue');
 if(e.type==='2pt'||e.type==='3pt'){
  const what=e.type==='3pt'?t('kolmonen'):e.zone==='rim'?t('lähiheitto'):t('kakkonen');
  return `${n(e.player)} ${what} ${e.made?t('sisään'):t('ohi')}${e.assist?` · ${t('syöttö')} ${n(e.assist)}`:''}${e.block?` · ${t('blokki')} ${n(e.block)}`:''}`;
 }
 return {free_throw:`${n(e.player)} ${t('vapaaheitto')} ${e.made?t('sisään'):t('ohi')}`,turnover:e.player?`${n(e.player)} ${t('menetys')}`:`${teams[e.team]} ${t('menetys')}`,
  steal:`${n(e.player)} ${t('riisto')}`,offensive_rebound:`${n(e.player)} ${t('hyökkäyslevypallo')}`,defensive_rebound:`${n(e.player)} ${t('puolustuslevypallo')}`,foul:`${n(e.player)} ${t('virhe')}`}[e.type]??'';
}

function Court({pack,game,players}){
 const host=useRef(null),court=useRef(null);
 const [tick,setTick]=useState({t:0,duration:2400,playing:false,period:1,clock:600,home:0,away:0,eventIndex:-1});
 const [camera,setCamera]=useState('broadcast'),[speed,setSpeed]=useState(4);
 useEffect(()=>{
  let lastPush=0;
  // Re-render the overlay a few times per second, and at once when an event happens.
  court.current=createSimCourt(host.current,{onTick:state=>{const now=performance.now();if(state.changed||now-lastPush>200){lastPush=now;setTick(state);}}});
  return()=>court.current.dispose();
 },[]);
 useEffect(()=>{court.current.load(players,game.log);court.current.setPlaying(!matchMedia('(prefers-reduced-motion: reduce)').matches);},[game,players]);
 useEffect(()=>court.current.setSpeed(speed),[speed]);
 useEffect(()=>court.current.setCamera(camera),[camera]);
 const actions=court.current?.actions()??[],teams={home:pack.match.home.name,away:pack.match.away.name};
 const recent=actions.slice(Math.max(0,tick.eventIndex-4),tick.eventIndex+1);
 const spark=actions.map(e=>`${(e.t/tick.duration*1000).toFixed(1)},${(20-Math.max(-19,Math.min(19,(e.home_score-e.away_score)*.9))).toFixed(1)}`).join(' ');
 const toggle=()=>{court.current.setPlaying(!tick.playing);setTick({...tick,playing:!tick.playing});};
 return <div className="sim-stage panel">
  <div className="sim-viewport">
   <div ref={host} className="sim-court" aria-label={t('Simuloitu ottelu kolmiulotteisella kentällä')} role="img"/>
   <span className="sim-badge">{t('Simulaatio')}</span>
   <div className="sim-scoreboard">
    <span className="sim-sb-team"><i style={{background:TEAM_COLORS.home}}/>{teams.home}</span><b>{tick.home}</b>
    <span className="sim-sb-clock"><small>{tick.period<=4?`${tick.period}. ${t('nelj.')}`:`${tick.period-4}. ${t('jatko')}`}</small>{Math.floor(tick.clock/60)}:{String(Math.floor(tick.clock%60)).padStart(2,'0')}</span>
    <b>{tick.away}</b><span className="sim-sb-team">{teams.away}<i style={{background:TEAM_COLORS.away}}/></span>
   </div>
   <ol className="sim-ticker" aria-live="polite">{recent.map((e,i)=><li key={tick.eventIndex-recent.length+i}><i style={{background:TEAM_COLORS[e.team]}}/>{describe(e,players,teams)}</li>)}</ol>
  </div>
  <div className="sim-controls">
   <button className="sim-play" onClick={toggle} aria-label={t(tick.playing?'Tauko':'Toista')}>{tick.playing?<PauseRounded/>:<PlayArrowRounded/>}</button>
   <div className="sim-scrub">
    <svg viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="20" x2="1000" y2="20"/><polyline points={`0,20 ${spark}`}/><rect x={tick.t/tick.duration*1000-1} y="0" width="2" height="40"/></svg>
    <input type="range" min="0" max={tick.duration} step=".1" value={tick.t} aria-label={t('Pelin aika')} onChange={e=>{const value=Number(e.target.value);court.current.seek(value);setTick({...tick,t:value});}}/>
   </div>
   <div className="sim-toggle" role="group" aria-label={t('Kamera')}>{CAMERAS.map(([id,label])=><button key={id} aria-pressed={camera===id} onClick={()=>setCamera(id)}>{t(label)}</button>)}</div>
   <div className="sim-toggle" role="group" aria-label={t('Nopeus')}>{SPEEDS.map(s=><button key={s} aria-pressed={speed===s} onClick={()=>setSpeed(s)}>{s}×</button>)}</div>
  </div>
 </div>;
}

function Summary({pack}){
 const {home,away}=pack.match,s=pack.summary,hp=s.home_win_probability,bins=pack.margin_histogram,peak=Math.max(...bins.map(b=>b.share));
 return <section className="sim-panel panel">
  <h3>{t('Voittotodennäköisyys')}</h3>
  <div className="sim-prob"><span style={{width:`${hp*100}%`,background:TEAM_COLORS.home}}>{pct(hp)}</span><span style={{width:`${(1-hp)*100}%`,background:TEAM_COLORS.away}}>{pct(1-hp)}</span></div>
  <div className="sim-legend"><span>{home.name}</span><span>{away.name}</span></div>
  <dl className="sim-facts">
   <div><dt>{t('Keskimääräinen tulos')}</dt><dd>{fmt(s.mean_score[home.id])}–{fmt(s.mean_score[away.id])}</dd></div>
   <div><dt>{t('Kotijoukkueen ero, 80 %')}</dt><dd>{s.margin.p10>0?'+':''}{s.margin.p10}…{s.margin.p90>0?'+':''}{s.margin.p90}</dd></div>
   <div><dt>{t('Jatkoaika')}</dt><dd>{pct(s.overtime_probability)}</dd></div>
  </dl>
  <h3>{t('Piste-ero')} {fmt(pack.simulations)} {t('simulaatiossa')}</h3>
  <svg className="sim-hist" viewBox="0 0 360 110" role="img" aria-label={`${t('Piste-erojen jakauma. Kotijoukkueen keskimääräinen ero')} ${fmt(s.margin.mean,1)}.`}>
   {bins.map((b,i)=>{const h=b.share/peak*100;return <rect key={b.margin} x={i*360/bins.length} y={104-h} width={360/bins.length-.6} height={h} fill={b.margin>0?TEAM_COLORS.home:b.margin<0?TEAM_COLORS.away:'#929297'}><title>{`${b.margin>0?'+':''}${b.margin}: ${pct(b.share)}`}</title></rect>;})}
   <line x1="180" y1="0" x2="180" y2="106"/>
  </svg>
  <div className="sim-legend"><span>← {away.name} {t('voittaa')}</span><span>{home.name} {t('voittaa')} →</span></div>
 </section>;
}

function HowWins({pack}){
 const {home,away}=pack.match;
 return <section className="sim-panel panel"><h3>{t('Miten voitot syntyvät')}</h3><div className="sim-ways">{[[home,'home'],[away,'away']].map(([team,side])=>{
  const w=pack.how_wins_happen[team.id];
  if(!w.wins)return <p key={team.id}>{team.name}: {t('ei voittoja simulaatioissa')}</p>;
  const [quarter,share]=Object.entries(w.best_quarter)[0];
  const rows=[['Voittoja',`${fmt(w.wins)} / ${fmt(pack.simulations)}`],['Keskimääräinen voittomarginaali',`+${fmt(w.mean_margin,1)}`],['Johti jo 3. neljänneksen jälkeen',pct(w.led_after_three)],
   ['Nousi takaa 4. neljänneksellä',pct(w.comeback_after_three)],['Tiukka voitto (≤ 5)',pct(w.close)],['Selvä voitto (≥ 15)',pct(w.comfortable)],['Useimmin ratkaiseva neljännes',`${quarter} · ${pct(share)}`]];
  return <div key={team.id}><h4><i style={{background:TEAM_COLORS[side]}}/>{team.name}</h4><dl>{rows.map(([k,v])=><div key={k}><dt>{t(k)}</dt><dd>{v}</dd></div>)}</dl></div>;
 })}</div></section>;
}

function Players({pack,players}){
 const {home,away}=pack.match,[team,setTeam]=useState(home.id);
 const name=pid=>players[pid]?.short??'';
 return <section className="sim-panel panel">
  <h3>{t('Pelaajat simulaatioissa')}</h3>
  <div className="sim-toggle sim-team-toggle" role="group" aria-label={t('Joukkue')}>{[home,away].map(x=><button key={x.id} aria-pressed={team===x.id} onClick={()=>setTeam(x.id)}>{x.name}</button>)}</div>
  <div className="sim-table-wrap"><table className="sim-table"><thead><tr><th>{t('Pelaaja')}</th><th>{t('Pisteet')}</th><th>20+</th><th>{t('Syötöt')}</th><th>{t('Levypallot')}</th></tr></thead>
   <tbody>{pack.players.filter(p=>p.team===team).slice(0,10).map(p=><tr key={p.id}><th>{p.number&&<small>#{p.number} </small>}{titleCase(p.name)}</th><td>{fmt(p.points.mean,1)} <small>{p.points.p10}–{p.points.p90}</small></td><td>{pct(p.points.twenty_plus)}</td><td>{fmt(p.assists,1)}</td><td>{fmt(p.rebounds,1)}</td></tr>)}</tbody></table></div>
  <h3>{t('Syöttöparit')}</h3>
  <ul className="sim-pairs">{pack.assist_pairs.slice(0,8).map(p=><li key={p.passer+p.scorer}><span><i style={{background:TEAM_COLORS[p.team===home.id?'home':'away']}}/>{name(p.passer)} → {name(p.scorer)}</span><b>{fmt(p.per_game,1)} / {t('peli')}</b></li>)}</ul>
 </section>;
}

export function SimStudio(){
 const [index,setIndex]=useState(null),[matchId,setMatchId]=useState(()=>new URLSearchParams(location.search).get('match')),[pack,setPack]=useState(null),[gameIndex,setGameIndex]=useState(0),[error,setError]=useState(null);
 useEffect(()=>{fetch(`${BASE}index.json`).then(r=>{if(!r.ok)throw Error(r.status);return r.json();}).then(data=>{setIndex(data);setMatchId(id=>data.games.some(g=>g.id===id)?id:data.games[0]?.id);}).catch(setError);},[]);
 useEffect(()=>{
  if(!matchId)return;
  let live=true;setPack(null);setGameIndex(0);
  fetch(`${BASE}${matchId}.json`).then(r=>{if(!r.ok)throw Error(r.status);return r.json();}).then(data=>{if(live)setPack(data);}).catch(setError);
  const url=new URL(location.href);url.searchParams.set('match',matchId);history.replaceState(history.state,'',url);
  return()=>{live=false;};
 },[matchId]);
 if(error)return <StateCard title={t('Simulaatioita ei voitu ladata')} description={t('Tarkista yhteys ja yritä uudelleen.')} onAction={()=>location.reload()}/>;
 if(!index||!pack)return <LoadingSkeleton variant="comparison" label={t('Ladataan simulaatiota…')}/>;
 const players=Object.fromEntries(pack.players.map(p=>[p.id,{...p,short:shortName(p.name)}]));
 const {home,away}=pack.match,game=pack.games[gameIndex];
 const variant={typical_home_win:`${home.name} ${t('voittaa')}`,typical_away_win:`${away.name} ${t('voittaa')}`,closest:t('Tiukin')};
 return <div className="sim-studio">
  <p className="sim-intro">{t('Malli pelaa Miesten Korisliigan tulevan ottelun hallinta kerrallaan oikeilla pelaajilla tuhat kertaa. Alla yksi simuloiduista peleistä kentällä ja se, mitä kaikki simulaatiot yhdessä sanovat.')}</p>
  <div className="sim-toolbar">
   <label className="sim-control">{t('Ottelu')}<select value={matchId} onChange={e=>setMatchId(e.target.value)}>{index.games.map(g=><option key={g.id} value={g.id}>{dateLabel(g.date,{day:'numeric',month:'numeric'})} {g.home.name} – {g.away.name}</option>)}</select></label>
   <div className="sim-chips">{[`${dateLabel(pack.match.date,{weekday:'short',day:'numeric',month:'numeric'})}${pack.match.time?` ${t('klo')} ${pack.match.time.slice(0,5)}`:''}`,pack.match.venue,`${fmt(pack.simulations)} ${t('simulaatiota')}`,`${t('Data')} ${dateLabel(pack.data_cutoff)} ${t('asti')}`,pack.model].filter(Boolean).map(text=><span key={text}>{text}</span>)}</div>
  </div>
  <div className="sim-toggle sim-variants" role="group" aria-label={t('Simuloitu peli')}>{pack.games.map((g,i)=><button key={g.label} aria-pressed={gameIndex===i} onClick={()=>setGameIndex(i)}>{variant[g.label]??g.label} {g.score[home.id]}–{g.score[away.id]}</button>)}</div>
  <div className="sim-layout">
   <Court key={`${matchId}-${gameIndex}`} pack={pack} game={game} players={players}/>
   <div className="sim-side"><Summary pack={pack}/><HowWins pack={pack}/></div>
  </div>
  <div className="sim-bottom"><Players key={matchId} pack={pack} players={players}/>
   <section className="sim-panel panel sim-method"><h3>{t('Mitä tämä on')}</h3>
    <p>{t('Pelaajatason simulaattori: jokaisessa hallinnassa kentällä on oikea viisikko. Data määrää, kuka toimii, mistä hän heittää, millä onnistumisella, kenelle syöttää ja kuka ottaa levypallon. Vähäinen data kutistetaan kohti liigan keskitasoa.')}</p>
    <p>{t('Tapahtumat ovat mallin tuottamia. Pelaajien liike tapahtumien välillä on havainnollistus, joka perustuu pelaajien omiin heittopaikkoihin. Poissaoloja malli ei tiedä.')}</p>
    <p>{t('Ajallisesti oikeassa testissä kaudella 2025–26 (161 ottelua) Brier oli 0,2382. Elo sai 0,2386 ja lukittu piste-eromalli 0,2329, eli malli ei vielä ennusta voittajaa muita paremmin. Pienempi Brier on parempi.')}</p>
   </section>
  </div>
 </div>;
}
export default SimStudio;
