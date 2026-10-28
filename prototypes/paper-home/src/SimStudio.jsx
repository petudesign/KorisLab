import {useEffect,useRef,useState} from 'react';
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded';
import PauseRounded from '@mui/icons-material/PauseRounded';
import {useI18n,locale} from './i18n';
import {useSeason} from './SeasonContext';
import {LoadingSkeleton,StateCard} from './PageStates';
import {createSimCourt,TEAM_COLORS} from './lib/simCourt';
import './sim-studio.css';

// Text comes in both languages from this component's own fi/en layer.
function useTr(){const {language}=useI18n();return (fi,en)=>language==='en'?en:fi;}
const CAMERAS=[['broadcast','Lähetys','Broadcast'],['tactical','Taktinen','Tactical'],['baseline','Päätyviiva','Baseline'],['orbit','Vapaa','Free']];
const SPEEDS=[1,4,12,30];
const fmt=(v,d=0)=>Number(v).toLocaleString(locale(),{minimumFractionDigits:d,maximumFractionDigits:d});
const pct=v=>`${fmt(v*100)} %`;
const signed=v=>v>0?`+${v}`:String(v).replace('-','−');
const titleCase=name=>name.split(/\s+/).map(w=>w.charAt(0)+w.slice(1).toLocaleLowerCase('fi')).join(' ');
const shortName=name=>titleCase(name.split(/\s+/).at(-1)??name);
const dateLabel=(date,options)=>new Date(`${date}T12:00:00`).toLocaleDateString(locale(),options);
const clock=seconds=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;

function describe(e,players,teams,tr){
 const n=pid=>players[pid]?.short??'';
 if(e.type==='2pt'||e.type==='3pt'){
  const what=e.type==='3pt'?tr('kolmonen','three'):e.zone==='rim'?tr('lähiheitto','layup'):tr('kakkonen','two');
  let text=`${n(e.player)} ${what} ${e.made?tr('sisään','made'):tr('ohi','missed')}`;
  if(e.assist)text+=` · ${tr('syöttö','assist')} ${n(e.assist)}`;
  if(e.block)text+=` · ${tr('blokki','block')} ${n(e.block)}`;
  return text;
 }
 return {free_throw:`${n(e.player)} ${tr('vapaaheitto','free throw')} ${e.made?tr('sisään','made'):tr('ohi','missed')}`,
  turnover:`${e.player?n(e.player):teams[e.team]} ${tr('menetys','turnover')}`,steal:`${n(e.player)} ${tr('riisto','steal')}`,
  offensive_rebound:`${n(e.player)} ${tr('hyökkäyslevypallo','offensive rebound')}`,defensive_rebound:`${n(e.player)} ${tr('puolustuslevypallo','defensive rebound')}`,
  foul:`${n(e.player)} ${tr('virhe','foul')}`}[e.type]??'';
}

function Court({pack,games,players}){
 const tr=useTr(),host=useRef(null),court=useRef(null);
 const [gameIndex,setGameIndex]=useState(0),[camera,setCamera]=useState('broadcast'),[speed,setSpeed]=useState(4);
 const [tick,setTick]=useState({t:0,duration:2400,playing:false,period:1,clock:600,home:0,away:0,eventIndex:-1});
 const {home,away}=pack.match,teams={home:home.name,away:away.name},game=games[gameIndex];
 useEffect(()=>{
  let lastPush=0;
  // Re-render the overlay a few times per second, and at once when an event happens.
  court.current=createSimCourt(host.current,{onTick:state=>{const now=performance.now();if(state.changed||now-lastPush>250){lastPush=now;setTick(state);}}});
  return()=>court.current.dispose();
 },[]);
 useEffect(()=>{court.current.load(players,game.log);court.current.setPlaying(!matchMedia('(prefers-reduced-motion: reduce)').matches);},[game,players]);
 useEffect(()=>court.current.setSpeed(speed),[speed]);
 useEffect(()=>court.current.setCamera(camera),[camera]);
 const actions=court.current?.actions()??[];
 // The flat tactical view keeps more of the court visible with a shorter feed.
 const first=Math.max(0,tick.eventIndex-(camera==='tactical'?1:3)),recent=actions.slice(first,tick.eventIndex+1);
 const spark=actions.map(e=>`${(e.t/tick.duration*1000).toFixed(1)},${(20-Math.max(-19,Math.min(19,(e.home_score-e.away_score)*.9))).toFixed(1)}`).join(' ');
 const toggle=()=>{court.current.setPlaying(!tick.playing);setTick({...tick,playing:!tick.playing});};
 const variantLabel={typical_home_win:tr(`${home.name} voittaa`,`${home.name} win`),typical_away_win:tr(`${away.name} voittaa`,`${away.name} win`),closest:tr('Tiukin peli','Closest game')};
 return <section className="sim-stage panel">
  <div className="sim-viewport">
   <div ref={host} className="sim-court" role="img" aria-label={tr('Simuloitu ottelu kolmiulotteisella kentällä','Simulated game on a three-dimensional court')}/>
   <span className="sim-badge">{tr('Simulaatio','Simulation')}</span>
   <div className="sim-scoreboard" aria-hidden="true">
    <span className="sim-sb-team home"><i style={{background:TEAM_COLORS.home}}/><span>{home.name}</span></span>
    <b>{tick.home}</b>
    <span className="sim-sb-clock"><small>{tick.period<=4?tr(`${tick.period}. nelj.`,`Q${tick.period}`):tr(`${tick.period-4}. jatko`,`OT${tick.period-4}`)}</small>{clock(tick.clock)}</span>
    <b>{tick.away}</b>
    <span className="sim-sb-team away"><span>{away.name}</span><i style={{background:TEAM_COLORS.away}}/></span>
   </div>
   <ol className="sim-ticker">{recent.map((e,i)=><li key={first+i}><i style={{background:TEAM_COLORS[e.team]}}/><span>{describe(e,players,teams,tr)}</span></li>)}</ol>
  </div>
  <div className="sim-controls">
   <button className="sim-play" onClick={toggle} aria-label={tick.playing?tr('Tauko','Pause'):tr('Toista','Play')}>{tick.playing?<PauseRounded/>:<PlayArrowRounded/>}</button>
   <div className="sim-scrub">
    <svg viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="20" x2="1000" y2="20"/><polyline points={`0,20 ${spark}`}/><rect x={tick.t/tick.duration*1000-1} y="0" width="2" height="40"/></svg>
    <input type="range" min="0" max={tick.duration} step=".1" value={tick.t} aria-label={tr('Pelin aika','Game time')} onChange={e=>{const value=Number(e.target.value);court.current.seek(value);setTick({...tick,t:value});}}/>
   </div>
  </div>
  <div className="sim-controls sim-options">
   <div className="sim-toggle" role="group" aria-label={tr('Simuloitu peli','Simulated game')}>{games.map((g,i)=><button key={g.label} aria-pressed={gameIndex===i} onClick={()=>setGameIndex(i)}>{variantLabel[g.label]??g.label} <span className="sim-score">{g.score[home.id]}–{g.score[away.id]}</span></button>)}</div>
   <div className="sim-toggle" role="group" aria-label={tr('Kamera','Camera')}>{CAMERAS.map(([id,fi,en])=><button key={id} aria-pressed={camera===id} onClick={()=>setCamera(id)}>{tr(fi,en)}</button>)}</div>
   <div className="sim-toggle" role="group" aria-label={tr('Nopeus','Speed')}>{SPEEDS.map(s=><button key={s} aria-pressed={speed===s} onClick={()=>setSpeed(s)}>{s}×</button>)}</div>
  </div>
 </section>;
}

function Summary({pack}){
 const tr=useTr(),{home,away}=pack.match,s=pack.summary,hp=s.home_win_probability,bins=pack.margin_histogram,peak=Math.max(...bins.map(b=>b.share));
 return <section className="sim-panel panel">
  <h3>{tr('Voittotodennäköisyys','Win probability')}</h3>
  <div className="sim-prob"><span style={{width:`${hp*100}%`,background:TEAM_COLORS.home}}>{pct(hp)}</span><span style={{width:`${(1-hp)*100}%`,background:TEAM_COLORS.away}}>{pct(1-hp)}</span></div>
  <div className="sim-legend"><span>{home.name}</span><span>{away.name}</span></div>
  <dl className="sim-facts">
   <div><dt>{tr('Pisteet keskimäärin','Average points')}</dt><dd>{fmt(s.mean_score[home.id],1)}–{fmt(s.mean_score[away.id],1)}</dd></div>
   <div><dt>{tr('Kotijoukkueen ero, 80 %','Home margin, 80%')}</dt><dd>{signed(s.margin.p10)}…{signed(s.margin.p90)}</dd></div>
   <div><dt>{tr('Jatkoaika','Overtime')}</dt><dd>{pct(s.overtime_probability)}</dd></div>
  </dl>
  <h3>{tr(`Piste-ero ${fmt(pack.simulations)} simulaatiossa`,`Margin in ${fmt(pack.simulations)} simulations`)}</h3>
  <svg className="sim-hist" viewBox="0 0 360 110" role="img" aria-label={tr(`Piste-erojen jakauma. Kotijoukkueen keskimääräinen ero ${fmt(s.margin.mean,1)}.`,`Distribution of margins. Average home margin ${fmt(s.margin.mean,1)}.`)}>
   {bins.map((b,i)=>{const h=b.share/peak*100;return <rect key={b.margin} x={i*360/bins.length} y={104-h} width={360/bins.length-.6} height={h} fill={b.margin>0?TEAM_COLORS.home:b.margin<0?TEAM_COLORS.away:'#929297'}><title>{`${signed(b.margin)}: ${pct(b.share)}`}</title></rect>;})}
   <line x1="180" y1="0" x2="180" y2="106"/>
  </svg>
  <div className="sim-legend"><span>← {tr(`${away.name} voittaa`,`${away.name} win`)}</span><span>{tr(`${home.name} voittaa`,`${home.name} win`)} →</span></div>
 </section>;
}

function HowWins({pack}){
 const tr=useTr(),{home,away}=pack.match;
 return <section className="sim-panel panel"><h3>{tr('Miten voitot syntyvät','How the wins happen')}</h3><div className="sim-ways">{[[home,'home'],[away,'away']].map(([team,side])=>{
  const w=pack.how_wins_happen[team.id];
  if(!w.wins)return <p key={team.id}>{team.name}: {tr('ei voittoja simulaatioissa','no wins in the simulations')}</p>;
  const [quarter,share]=Object.entries(w.best_quarter)[0];
  const rows=[[tr('Voittoja','Wins'),`${fmt(w.wins)} / ${fmt(pack.simulations)}`],[tr('Keskimääräinen voittomarginaali','Average winning margin'),`+${fmt(w.mean_margin,1)}`],
   [tr('Johti jo 3. neljänneksen jälkeen','Led after three quarters'),pct(w.led_after_three)],[tr('Nousi takaa 4. neljänneksellä','Came from behind in Q4'),pct(w.comeback_after_three)],
   [tr('Tiukka voitto (≤ 5)','Close win (≤ 5)'),pct(w.close)],[tr('Selvä voitto (≥ 15)','Comfortable win (≥ 15)'),pct(w.comfortable)],
   [tr('Useimmin ratkaiseva neljännes','Most often decisive quarter'),`${quarter} · ${pct(share)}`]];
  return <div key={team.id}><h4><i style={{background:TEAM_COLORS[side]}}/>{team.name}</h4><dl>{rows.map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></div>;
 })}</div></section>;
}

function Players({pack,players}){
 const tr=useTr(),{home,away}=pack.match,[team,setTeam]=useState(home.id);
 return <section className="sim-panel panel">
  <div className="sim-panel-head"><h3>{tr('Pelaajat simulaatioissa','Players in the simulations')}</h3>
   <div className="sim-toggle" role="group" aria-label={tr('Joukkue','Team')}>{[home,away].map(x=><button key={x.id} aria-pressed={team===x.id} onClick={()=>setTeam(x.id)}>{x.name}</button>)}</div></div>
  <div className="sim-table-wrap"><table className="sim-table">
   <thead><tr><th>{tr('Pelaaja','Player')}</th><th>{tr('Pisteet','Points')}</th><th>{tr('80 % väli','80% range')}</th><th>20+</th><th>{tr('Syötöt','Assists')}</th><th>{tr('Levypallot','Rebounds')}</th></tr></thead>
   <tbody>{pack.players.filter(p=>p.team===team).slice(0,10).map(p=><tr key={p.id}><th>{p.number&&<small>#{p.number} </small>}{titleCase(p.name)}</th><td>{fmt(p.points.mean,1)}</td><td><small>{p.points.p10}–{p.points.p90}</small></td><td>{pct(p.points.twenty_plus)}</td><td>{fmt(p.assists,1)}</td><td>{fmt(p.rebounds,1)}</td></tr>)}</tbody>
  </table></div>
  <h3>{tr('Syöttöparit','Assist pairs')}</h3>
  <ul className="sim-pairs">{pack.assist_pairs.slice(0,8).map(p=><li key={p.passer+p.scorer}><span><i style={{background:TEAM_COLORS[p.team===home.id?'home':'away']}}/>{players[p.passer]?.short} → {players[p.scorer]?.short}</span><b>{fmt(p.per_game,1)} {tr('/ peli','per game')}</b></li>)}</ul>
 </section>;
}

// A two-line summary up front; each topic opens for a short, concrete explanation.
function Method({league}){
 const tr=useTr();
 const topics=[
  [tr('Mihin se perustuu','What it is based on'),[
   tr('Basket.fi:n viralliset pelitapahtumat kolmelta kaudelta: jokainen heitto paikkoineen, syöttö, levypallo, menetys ja vaihto. Ottelu otetaan mukaan vain, jos sen pisteet täsmäävät pöytäkirjaan.','Basket.fi’s official play-by-play from three seasons: every shot with its location, assist, rebound, turnover and substitution. A game is used only if its points match the official box score.'),
   tr('Jokaiselle pelaajalle lasketaan, kuinka usein hän toimii, mistä hän heittää, kuinka hyvin hän osuu kultakin alueelta, kenelle hän syöttää ja kuinka paljon levypalloja hän ottaa. Joukkueelle lasketaan puolustus ja tempo.','For each player: how often they act, where they shoot from, how well they hit from each area, who they pass to and how much they rebound. For each team: defence and pace.'),
   tr('Vähäinen näyttö vedetään kohti sarjan keskitasoa: 5/6 kolmosista ei tee kenestäkään 83 %:n heittäjää. Kuluva kausi painaa eniten.','Thin evidence is pulled towards the league average: 5 of 6 threes does not make anyone an 83% shooter. The current season counts the most.')]],
  [tr('Miten ottelu pelataan','How a game is played'),[
   tr('Hallinta kerrallaan pelikelloa vasten, noin 80 hallintaa joukkuetta kohden.','Possession by possession against the game clock, about 80 per team.'),
   tr('Kentällä olevista viidestä arvotaan toimija. Hän heittää, menettää pallon tai pääsee vapaaheittoon omien osuuksiensa mukaan. Heittopaikka arvotaan hänen oikeista heitoistaan, ja osuminen riippuu hänen tarkkuudestaan, vastustajan puolustuksesta ja kotiedusta.','One of the five on court is drawn to act. They shoot, turn it over or get to the line at their own rates. The shot location comes from their real shots; making it depends on their accuracy, the defence and home advantage.'),
   tr('Korin syöttäjä valitaan sen mukaan, kenelle pelaaja oikeasti syöttää. Ohi menneestä heitosta tulee levypallo, ja vaihdot seuraavat viimeisimpien otteluiden peliminuutteja.','The passer on a basket is chosen from who the player actually passes to. A miss leads to a rebound, and substitutions follow recent playing time.')]],
  [tr('Mitä luvut tarkoittavat','What the numbers mean'),[
   tr('Sama ottelu pelataan tuhat kertaa. 57 % tarkoittaa, että joukkue voitti 570 simulaatiota.','The same game is played a thousand times. 57% means the team won 570 of them.'),
   tr('Pisteet ovat simulaatioiden keskiarvoja, eivät ennustettu lopputulos. Välit (esim. 10–22 pistettä) kattavat 80 % simulaatioista.','Points are averages across the simulations, not a predicted final score. Ranges (e.g. 10–22 points) cover 80% of the simulations.'),
   tr('Kentällä näkyvä peli on yksi näistä tuhannesta.','The game on the court is one of those thousand.')]],
  [tr('Mitä malli ei tiedä','What the model does not know'),[
   tr('Poissaoloja ja loukkaantumisia: kokoonpano arvataan viimeisimmistä otteluista. Taktiikkaa ja valmentajan ratkaisuja. Pelaajien liikettä tapahtumien välillä: kentän liike on havainnollistus, ei seurantadataa.','Absences and injuries: the lineup is inferred from recent games. Tactics and coaching decisions. Movement between events: what you see on court is an illustration, not tracking data.')]],
  [tr('Kuinka luotettava se on','How reliable it is'),[
   league==='men'
    ?tr('Testattu ajallisesti oikein kaudella 2025–26 (161 ottelua): Brier 0,238, Elo 0,239 ja yksinkertainen piste-eromalli 0,233. Pienempi on parempi, ja kolikonheitto antaa 0,250. Malli on siis kolikkoa parempi, mutta ei vielä parempi kuin yksinkertaiset mallit.','Tested in time order on 2025–26 (161 games): Brier 0.238, against 0.239 for Elo and 0.233 for a simple margin model. Lower is better; a coin flip scores 0.250. So the model beats chance but not yet the simple models.')
    :tr('Naisten mallia ei ole vielä testattu menneitä otteluita vastaan, joten luvut ovat suuntaa antavia.','The women’s model has not yet been tested against past games, so treat the numbers as indicative.'),
   tr('Jokaisen ennusteen toteuma näkyy sivun yläosassa.','How every forecast turned out is shown at the top of the page.')]],
 ];
 return <section className="sim-panel panel sim-method"><h3>{tr('Miten simulaatio toimii','How the simulation works')}</h3>
  <p>{tr('Ottelu pelataan tuhat kertaa hallinta kerrallaan oikeilla pelaajilla ja heidän omalla datallaan. Luvut kertovat, mitä näissä tuhannessa pelissä tapahtui.','The game is played a thousand times, possession by possession, with real players and their own data. The numbers describe what happened in those thousand games.')}</p>
  {topics.map(([title,lines])=><details key={title} className="sim-method-topic"><summary>{title}</summary>{lines.map(line=><p key={line}>{line}</p>)}</details>)}
 </section>;
}

// Every pre-game forecast is archived and scored once the game is played; shown openly, misses included.
function TrackRecord({league}){
 const tr=useTr(),[archive,setArchive]=useState(null);
 useEffect(()=>{let live=true;setArchive(null);fetch(`/data/sims/archive/${league}.json`).then(r=>r.ok?r.json():null).then(data=>{if(live)setArchive(data);}).catch(()=>{});return()=>{live=false;};},[league]);
 const s=archive?.summary;
 if(!s)return null;
 const played=Object.values(archive.games).filter(g=>g.result).sort((a,b)=>b.match.date.localeCompare(a.match.date));
 const headline=s.games?tr(`Ennusteiden toteuma: suosikki voitti ${s.favourites_won}/${s.favourites} · Brier ${fmt(s.brier,3)} (kolikonheitto 0,250)`,`Forecast record: favourite won ${s.favourites_won}/${s.favourites} · Brier ${fmt(s.brier,3)} (coin flip 0.250)`)
  :tr('Ennusteiden toteuma näkyy, kun ensimmäinen simuloitu ottelu on pelattu.','The forecast record appears once the first simulated game has been played.');
 return <details className="sim-track panel">
  <summary><strong>{headline}</strong>{s.games>0&&<span>{tr('Näytä ottelut','Show games')}</span>}</summary>
  {s.games>0&&<div className="sim-track-body">
   <dl className="sim-facts">
    <div><dt>{tr('Pelattuja ennustettuja otteluita','Forecast games played')}</dt><dd>{s.games}</dd></div>
    <div><dt>{tr('Piste-eron keskivirhe','Average margin error')}</dt><dd>{fmt(s.margin_mae,1)}</dd></div>
    <div><dt>{tr('Pelaajan pisteet 80 %:n välillä','Player points inside 80% range')}</dt><dd>{s.player_interval_coverage==null?'—':pct(s.player_interval_coverage)}</dd></div>
   </dl>
   <p className="sim-track-note">{tr('Jokaisesta ottelusta näytetään viimeisin ennen ottelun alkua julkaistu ennuste. Ennustetta ei muuteta jälkikäteen. Pisteet ovat tuhannen simulaation keskiarvoja, eivät yksittäinen lopputulos, joten tasaväkisessä ottelussa ne voivat olla lähes samat. Pienellä otoksella osumaprosentti vaihtelee paljon; Brier mittaa myös sitä, olivatko prosentit oikean kokoisia.','Each game shows the last forecast published before tip-off. Forecasts are never changed afterwards. Points are averages over a thousand simulations, not a single final score, so in an even game they can be almost equal. With a small sample the hit rate swings a lot; the Brier score also measures whether the percentages were the right size.')}</p>
   <div className="sim-table-wrap"><table className="sim-table">
    <thead><tr><th>{tr('Ottelu','Game')}</th><th>{tr('Kotivoitto','Home win')}</th><th>{tr('Pisteet keskimäärin','Average points')}</th><th>{tr('Toteutunut','Result')}</th><th>{tr('Suosikki','Favourite')}</th></tr></thead>
    <tbody>{played.map(g=>{const m=g.match,r=g.result,p=g.home_win_probability,homeWon=r.home_score>r.away_score,hit=p===.5?null:(p>.5)===homeWon;
     return <tr key={m.id}><th><small>{dateLabel(m.date,{day:'numeric',month:'numeric'})}</small> {m.home.name} – {m.away.name}</th><td>{pct(p)}</td>
      <td>{fmt(g.mean_score[m.home.id],1)}–{fmt(g.mean_score[m.away.id],1)}</td><td>{r.home_score}–{r.away_score}</td>
      <td className={hit?'sim-hit':hit===false?'sim-miss':''}>{hit==null?'—':hit?tr('Osui','Correct'):tr('Ei osunut','Missed')}</td></tr>;})}</tbody>
   </table></div>
  </div>}
 </details>;
}

export function SimStudio(){
 const tr=useTr(),{leagueId}=useSeason(),base=`/data/sims/${leagueId}/`;
 const [index,setIndex]=useState(null),[matchId,setMatchId]=useState(()=>new URLSearchParams(location.search).get('match')),[pack,setPack]=useState(null),[error,setError]=useState(null);
 useEffect(()=>{
  let live=true;setIndex(null);setPack(null);setError(null);
  fetch(`${base}index.json`).then(r=>{if(!r.ok)throw Error(r.status);return r.json();})
   .then(data=>{if(!live)return;setIndex(data);setMatchId(id=>data.games.some(g=>g.id===id)?id:data.games[0]?.id);}).catch(e=>live&&setError(e));
  return()=>{live=false;};
 },[base]);
 useEffect(()=>{
  if(!matchId||!index?.games.some(g=>g.id===matchId))return;
  let live=true;setPack(null);
  fetch(`${base}${matchId}.json`).then(r=>{if(!r.ok)throw Error(r.status);return r.json();}).then(data=>{if(live)setPack(data);}).catch(e=>live&&setError(e));
  const url=new URL(location.href);url.searchParams.set('match',matchId);history.replaceState(history.state,'',url);
  return()=>{live=false;};
 },[matchId,index,base]);
 if(error)return <StateCard title={tr('Simulaatioita ei voitu ladata','Could not load the simulations')} description={tr('Tarkista yhteys ja yritä uudelleen.','Check your connection and try again.')} onAction={()=>location.reload()}/>;
 if(index&&!index.games.length)return <StateCard title={tr('Ei tulevia otteluita','No upcoming games')} description={tr('Seuraavan kahden viikon otteluohjelmassa ei ole simuloitavia otteluita.','There are no games to simulate in the next two weeks.')}/>;
 if(!index||!pack)return <LoadingSkeleton variant="comparison" label={tr('Ladataan simulaatiota…','Loading simulation…')}/>;
 const players=Object.fromEntries(pack.players.map(p=>[p.id,{...p,short:shortName(p.name)}]));
 const m=pack.match;
 const chips=[`${dateLabel(m.date,{weekday:'short',day:'numeric',month:'numeric'})}${m.time?` ${tr('klo','at')} ${m.time.slice(0,5)}`:''}`,m.venue,
  tr(`${fmt(pack.simulations)} simulaatiota`,`${fmt(pack.simulations)} simulations`),tr(`Data ${dateLabel(pack.data_cutoff)} asti`,`Data to ${dateLabel(pack.data_cutoff)}`)].filter(Boolean);
 return <div className="sim-studio">
  <div className="sim-toolbar">
   <label className="sim-control"><span className="sr-only">{tr('Ottelu','Game')}</span>
    <select value={matchId} onChange={e=>setMatchId(e.target.value)} aria-label={tr('Ottelu','Game')}>{index.games.map(g=><option key={g.id} value={g.id}>{dateLabel(g.date,{day:'numeric',month:'numeric'})} {g.home.name} – {g.away.name}</option>)}</select></label>
   <div className="sim-chips">{chips.map(text=><span key={text}>{text}</span>)}</div>
  </div>
  <TrackRecord league={leagueId}/>
  <div className="sim-layout">
   <div className="sim-main"><Court key={m.id} pack={pack} games={pack.games} players={players}/><Players key={`players-${m.id}`} pack={pack} players={players}/></div>
   <div className="sim-side"><Summary pack={pack}/><HowWins pack={pack}/><Method league={leagueId}/></div>
  </div>
 </div>;
}
export default SimStudio;
