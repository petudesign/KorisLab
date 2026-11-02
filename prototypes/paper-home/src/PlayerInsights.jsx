import {useEffect,useMemo,useState} from 'react';
import {locale,useI18n} from './i18n';
import {useSeason} from './SeasonContext';
import {goTo,routeHref} from './routing';
import {clockText,periodLabel} from './lib/gameStory';
import {SPLIT_MIN_GAMES,SPLIT_MIN_MINUTES,opponentSplit} from './lib/opponentSplit';
import {basketTotal} from './lib/playerEvents';
import {AGE_MIN_SHARE,seasonBests,shotBreakdown,teamAgeView} from './lib/gameBests';
import {matchupComparison} from './PlayerInsightsData';
import './matches.css';
import './player-insights.css';

const number=(value,digits=1)=>Number.isFinite(value)?value.toLocaleString(locale(),{minimumFractionDigits:digits,maximumFractionDigits:digits}):'—';
const percent=value=>Number.isFinite(value)?`${Math.round(value*100)} %`:'—';
const openLink=event=>{if(event.metaKey||event.ctrlKey||event.shiftKey)return;event.preventDefault();goTo(event.currentTarget.getAttribute('href'));};
// Each file holds a whole season or league, and the profile reads it for several sections.
const cache=new Map();
export function useSharedJson(url){
 const [state,setState]=useState(()=>cache.has(url)?{data:cache.get(url)}:{});
 useEffect(()=>{
  let live=true;
  if(cache.has(url)){setState({data:cache.get(url)});return;}
  setState({});
  fetch(url).then(response=>{if(!response.ok)throw Error();return response.json();}).then(data=>{cache.set(url,data);if(live)setState({data});}).catch(()=>{if(live)setState({failed:true});});
  return()=>{live=false;};
 },[url]);
 return state;
}
export const useSimilarPlayers=leagueId=>useSharedJson(`/data/similar/${leagueId}.json`);

const signedBest=(metric,value)=>metric==='plus_minus'&&value>0?`+${value}`:String(value);
const BEST_ACCENTS={points:'#df945b',rebounds:'#91b4c8',assists:'#44d17a',steals:'#44d17a',blocks:'#91b4c8',three_pm:'#df945b',plus_minus:'#df945b'};
// Every game of the season as one small column, so the best stands out against the rest.
function GameColumns({values,best}){
 const low=Math.min(0,...values),span=(best-low)||1;
 return <span className="player-best-columns" aria-hidden="true">{values.map((value,index)=><i key={index} className={value===best?'is-best':''} style={{height:`${Math.max(6,(value-low)/span*100)}%`}}/>)}</span>;
}
export function PlayerSeasonBests({games,player,onOpenMatch}){
 const {language}=useI18n(),lang=language==='fi'?'fi':'en',say=(fi,en)=>lang==='fi'?fi:en,{leagueId,seasonId}=useSeason();
 const rows=useMemo(()=>seasonBests(games,player.id).filter(row=>row.game),[games,player.id]);
 if(!rows.length)return null;
 const open=(event,id)=>{if(!event.metaKey&&!event.ctrlKey&&!event.shiftKey){event.preventDefault();onOpenMatch(id);}};
 return <section className="player-bests" aria-label={say('Kauden parhaat','Season highs')}>
  <h3>{say('Kauden parhaat','Season highs')}</h3>
  <div className="player-bests-grid">{rows.map(({metric,average,best,times,game,opponent,values})=><article key={metric.key} className="dash-card player-best" style={{'--highlight-accent':BEST_ACCENTS[metric.key]}}>
   <header><span className="dash-card-label">{metric[lang]}</span><small>{say('KA','Avg')} <b>{number(average)}</b></small></header>
   <strong>{signedBest(metric.key,best)}</strong>
   <GameColumns values={values} best={best}/>
   <a href={routeHref({section:'Ottelut',matchId:game.id,leagueId,seasonId})} onClick={event=>open(event,game.id)}>{say('vastassa','against')} {opponent.name}<small>{new Date(game.date).toLocaleDateString(locale())}{times>1?say(` · ${times} kertaa, viimeisin`,` · ${times} times, latest`):''}</small></a>
  </article>)}</div>
 </section>;
}

const SHOT_COLORS={two:'#df945b',three:'#e8dcc8',free:'#6db8e8'};
export function PlayerSeasonShots({player,players}){
 const {language}=useI18n(),say=(fi,en)=>language==='fi'?fi:en;
 const {rows,points}=useMemo(()=>shotBreakdown(player,players),[player,players]);
 const name={two:say('Kakkoset','Twos'),three:say('Kolmoset','Threes'),free:say('Vapaaheitot','Free throws')};
 return <article className="dash-card player-season-shots">
  <h3>{say('Heitot kaudella','Shots this season')}</h3>
  {points>0&&<section className="shot-points">
   <p className="shot-points-title"><strong>{points}</strong> {say('pistettä, mistä ne tulivat','points, and where they came from')}</p>
   <div className="shot-points-bar" role="img" aria-label={rows.map(row=>`${name[row.key]} ${row.points}`).join(', ')}>{rows.map(row=>row.points?<i key={row.key} title={`${name[row.key]}: ${row.points} ${say('pistettä','points')}`} style={{flexGrow:row.points,background:SHOT_COLORS[row.key]}}/>:null)}</div>
   <ul className="shot-points-legend">{rows.map(row=><li key={row.key}><i style={{background:SHOT_COLORS[row.key]}} aria-hidden="true"/>{name[row.key]} <b>{row.points}</b></li>)}</ul>
  </section>}
  <div className="shot-rates">{rows.map(row=><div key={row.key} className="shot-rate">
   <span className="shot-rate-label">{row.label}</span>
   <strong><b className="shot-made-count">{row.made}</b><span className="shot-attempt-count"> / {row.attempts}</span></strong>
   <div className="shot-rate-track" title={Number.isFinite(row.leagueRate)?say(`Sarjan keskiarvo ${number(row.leagueRate)} %`,`League average ${number(row.leagueRate)} %`):undefined}><i style={{width:`${row.rate??0}%`,background:SHOT_COLORS[row.key]}}/>{Number.isFinite(row.leagueRate)&&<u style={{left:`${row.leagueRate}%`}} aria-hidden="true"/>}</div>
   <span className="shot-rate-value">{row.rate==null?'—':`${number(row.rate)} %`}</span>
   <small>{say('Sarja','League')} {Number.isFinite(row.leagueRate)?`${number(row.leagueRate)} %`:'—'}</small>
  </div>)}</div>
  <p className="shot-rate-note">{say('Pystyviiva palkissa on sarjan keskiarvo.','The vertical line in each bar is the league average.')}</p>
 </article>;
}

export function TeamAge({teamName}){
 const {language}=useI18n(),say=(fi,en)=>language==='fi'?fi:en,{leagueId,seasonId}=useSeason(),{data}=useSharedJson(`/data/team-ages/${leagueId}-${seasonId}.json`);
 const age=useMemo(()=>teamAgeView(data?.teams,teamName),[data,teamName]);
 if(!age)return null;
 const start=seasonId.slice(0,4);
 return <article className="dash-card player-insight">
  <header className="player-insight-heading"><h3>{say('Joukkueen ikä','Team age')}</h3></header>
  <dl className="team-age">
   <div><dt>{say('Keski-ikä minuuteilla painotettuna','Average age, weighted by minutes')}</dt><dd>{number(age.average_age)}</dd><small>{say(`${age.youngestRank}. nuorin ${age.teams} joukkueesta`,`#${age.youngestRank} youngest of ${age.teams} teams`)}</small></div>
   <div><dt>{say('Kaikkien pelanneiden keski-ikä','Average age of everyone who played')}</dt><dd>{number(age.roster_average_age)}</dd><small>{age.players_known} / {age.players} {say('pelaajaa','players')}</small></div>
   <div><dt>{say('Sarjan joukkueiden keskiarvo','League team average')}</dt><dd>{number(age.leagueAverage)}</dd><small>{say('painotetuista iästä','of the weighted ages')}</small></div>
  </dl>
  <details className="player-insight-method"><summary>{say('Näin ikä lasketaan','How age is worked out')}</summary><p>{say(`Ikä on vuosi ${start} miinus Basket.fi:hin kirjattu syntymävuosi, joten se on likimääräinen. Painotettu luku antaa eniten pelaaville suurimman painon. Ikä tiedetään ${Math.round(age.known_minutes_share*100)} %:lle joukkueen minuuteista, ja arvio näytetään vain, jos osuus on vähintään ${AGE_MIN_SHARE*100} %. Luku kuvaa joukkueen ikää, ei sen tulevaa kehitystä.`,`Age is ${start} minus the birth year recorded at Basket.fi, so it is approximate. The weighted number counts those who play most the most. Age is known for ${Math.round(age.known_minutes_share*100)} % of the team’s minutes, and is shown only when that share is at least ${AGE_MIN_SHARE*100} %. It describes the team’s age, not how it will develop.`)}</p></details>
 </article>;
}

export function PlayerOpponentSplit({games,player}){
 const {language}=useI18n(),say=(fi,en)=>language==='fi'?fi:en,{leagueId}=useSeason();
 const split=useMemo(()=>opponentSplit(games,player.id,leagueId),[games,player.id,leagueId]);
 if(!split)return null;
 const {upper,lower}=split;
 const rows=[[say('Pisteet / 40 min','Points / 40 min'),upper.pointsPer40,lower.pointsPer40],['TS %',upper.trueShooting,lower.trueShooting],[say('Min / ottelu','Min / game'),upper.minutesPerGame,lower.minutesPerGame]];
 return <article className="dash-card player-insight player-split-card">
  <header className="player-insight-heading"><h3>{say('Kovia ja heikkoja vastaan','Against strong and weak teams')}</h3></header>
  {split.enough?<>
   <div className="comparison-legend"><span className="home-ink">{say('Ylempi puolisko','Upper half')}<small>{upper.games} {say('ottelua','games')}</small></span><span className="away-ink">{say('Alempi puolisko','Lower half')}<small>{lower.games} {say('ottelua','games')}</small></span></div>
   {rows.map(([label,a,b])=>{const total=(a||0)+(b||0);return <div className="match-compare-row" key={label}><b className={a>b?'is-higher':''}>{number(a)}</b><span>{label}</span><b className={b>a?'is-higher':''}>{number(b)}</b><div className="compare-track"><i style={{width:`${total>0?100*(a||0)/total:50}%`}}/></div></div>;})}
   {split.small&&<p className="player-split-caution">{say('Pieni otos · suuntaa antava havainto','Small sample · exploratory observation')}</p>}
  </>:<p className="player-insight-empty">{say(`Jakoa ei näytetä, koska kummastakin ryhmästä tarvitaan vähintään ${SPLIT_MIN_GAMES} ottelua ja ${SPLIT_MIN_MINUTES} minuuttia. Nyt otteluita on ${upper.games} ja ${lower.games}.`,`Not shown: each group needs at least ${SPLIT_MIN_GAMES} games and ${SPLIT_MIN_MINUTES} minutes. There are ${upper.games} and ${lower.games} games so far.`)}</p>}
  <details className="player-insight-method"><summary>{say('Mitä tästä voi päätellä','What this tells you')}</summary><p>{say('Muut joukkueet on jaettu vahvuusjärjestyksen nykyisen sijan mukaan kahteen puoliskoon. Jos niitä on pariton määrä, keskimmäinen kuuluu alempaan. Sarjataulukkoa ei käytetä, koska se on alkukaudesta kohinaa, eikä ottelun aikaista vahvuutta, koska se on kauden alussa lähes tyhjä. Vahvuusjärjestys ei ole ennuste, ja sen välit ovat leveitä, joten puoliskojen rajalla olevat joukkueet voivat olla lähes tasoissa. Ero ryhmien välillä ei osoita, että se johtuu vastustajasta: mukana voivat vaikuttaa myös koti- ja vierasottelut, joukkuetoverit ja sattuma.','The other teams are split into two halves by their current power ranking. With an odd number, the middle team goes to the lower half. The standings are not used because they are noise early in a season, and strength on the day is not used because it is almost empty at the start of a season. The ranking is not a forecast and its ranges are wide, so teams near the line can be almost level. A difference between the groups does not show the opponent caused it: home and away games, teammates and chance can all play a part.')}</p></details>
 </article>;
}

export function PlayerBaskets({player}){
 const {language}=useI18n(),say=(fi,en)=>language==='fi'?fi:en,{leagueId,seasonId}=useSeason(),{data}=useSharedJson(`/data/player-events/${leagueId}-${seasonId}.json`);
 const row=data?.players[player.id],total=row?basketTotal(row.baskets):0;
 if(!total)return null;
 const kinds=[['assisted',say('Syötetyt','Assisted'),'#df945b'],['rebound',say('Levypallon jälkeen','After a rebound'),'#e8dcc8'],['other',say('Muut','Other'),'#6db8e8']];
 return <article className="dash-card player-insight">
  <header className="player-insight-heading"><h3>{say('Miten korit syntyvät','How the baskets came')}</h3><span className="player-analysis-coverage">{row.games} / {player.games} {say('ottelua','games')}</span></header>
  <div className="player-basket-bar" aria-hidden="true">{kinds.map(([key,,color])=>{const count=row.baskets[key].two+row.baskets[key].three;return count?<i key={key} style={{flexGrow:count,background:color}}/>:null;})}</div>
  <table className="player-basket-table"><thead><tr><th scope="col">{say('Tapa','Type')}</th><th scope="col">{say('Koreja','Baskets')}</th><th scope="col">2P</th><th scope="col">3P</th></tr></thead><tbody>
   {kinds.map(([key,label,color])=><tr key={key}><th scope="row"><i style={{background:color}} aria-hidden="true"/>{label}</th><td>{row.baskets[key].two+row.baskets[key].three}</td><td>{row.baskets[key].two}</td><td>{row.baskets[key].three}</td></tr>)}
   <tr className="player-basket-total"><th scope="row">{say('Yhteensä','Total')}</th><td>{total}</td><td>{kinds.reduce((sum,[key])=>sum+row.baskets[key].two,0)}</td><td>{kinds.reduce((sum,[key])=>sum+row.baskets[key].three,0)}</td></tr>
  </tbody></table>
  <details className="player-insight-method"><summary>{say('Näin luokat lasketaan','How the types are counted')}</summary><p>{say('Syötetyissä korissa on kirjattu syöttäjä. Levypallon jälkeen tarkoittaa koria ilman kirjattua syöttöä samassa hyökkäyksessä joukkueen hyökkäyslevypallon jälkeen. Muut ovat loput: esimerkiksi nopeat hyökkäykset, omat ratkaisut ja korit, joihin syöttöä ei ole kirjattu, joten ne eivät ole sama asia kuin itse luodut korit. Vapaaheitot eivät ole mukana. Mukana ovat ottelut, joissa pelitapahtumat täsmäävät pöytäkirjaan.','Assisted baskets have a recorded passer. After a rebound means a basket with no recorded pass in the same attack, after the team’s offensive rebound. Other is the rest: fast breaks, a player’s own offense and baskets with no pass recorded, so it does not mean self-created. Free throws are left out. Only games whose play-by-play matches the box score are included.')}</p></details>
 </article>;
}

const MOMENT_KIND={'2pt':{fi:'Kahden pisteen kori',en:'Two-pointer'},'3pt':{fi:'Kolmonen',en:'Three-pointer'},free_throw:{fi:'Vapaaheitto',en:'Free throw'}};
export function PlayerMoments({player}){
 const {language}=useI18n(),lang=language==='fi'?'fi':'en',say=(fi,en)=>lang==='fi'?fi:en,{leagueId,seasonId}=useSeason(),{data}=useSharedJson(`/data/player-events/${leagueId}-${seasonId}.json`);
 const moments=data?.players[player.id]?.moments;
 if(!moments?.length)return null;
 return <article className="dash-card player-insight">
  <header className="player-insight-heading"><h3>{say('Isoimmat hetket','Biggest moments')}</h3></header>
  <ol className="player-moments">{moments.map(moment=>{const opponent=moment.side==='h'?moment.away:moment.home;return <li key={`${moment.game}-${moment.t}`}><a href={`${routeHref({section:'Ottelut',matchId:moment.game,leagueId,seasonId})}&t=${moment.t}`} onClick={openLink}>
   <strong>{MOMENT_KIND[moment.kind][lang]}</strong>
   <span>{moment.home} {moment.scoreHome}–{moment.scoreAway} {moment.away}</span>
   <small>{periodLabel(moment.period,lang)} {clockText(moment.clock)} · {say('vastassa','against')} {opponent}{moment.date?` · ${new Date(moment.date).toLocaleDateString(locale())}`:''} · {percent(moment.from)} → {percent(moment.to)}</small>
  </a></li>;})}</ol>
  <details className="player-insight-method"><summary>{say('Näin hetket valitaan','How the moments are chosen')}</summary><p>{say('Mukana ovat pelaajan tekemät pisteet, jotka nostivat joukkueen voittotodennäköisyyttä eniten, enintään viisi. Prosentit ovat suuntaa antavia: malli oli testissä miesten sarjassa liian varma kotijoukkueen suuntaan. Suuret muutokset painottuvat ottelun loppuun ja tasaisiin otteluihin, joten lista ei kuvaa pelaajan arvoa.','These are the points by this player that raised the team’s win probability most, up to five. The percentages are rough: in testing the model was too sure of the home team in the men’s league. Large changes cluster at the end of close games, so the list does not measure a player’s value.')}</p></details>
 </article>;
}

export function PlayerNextSteps({games,player}){
 const {language}=useI18n(),say=(fi,en)=>language==='fi'?fi:en,{leagueId,seasonId}=useSeason(),{data}=useSimilarPlayers(leagueId);
 const comparison=useMemo(()=>matchupComparison(games,player.id,leagueId,seasonId),[games,player.id,leagueId,seasonId]);
 const own=data?.players.find(row=>row.id===player.id&&row.season===seasonId),named=own?.similar.slice(0,3).map(row=>data.players[row.at]);
 const profile=row=>routeHref({section:'Pelaajat',playerId:row.id,leagueId,seasonId:row.season});
 if(!comparison&&!named?.length)return null;
 return <div className="player-next-steps">
  {comparison&&<p><a href={`${routeHref({section:'Matchup Lab',leagueId,seasonId})}&mode=${comparison.mode}&team=${encodeURIComponent(comparison.teamId)}&player=${encodeURIComponent(player.id)}`} onClick={openLink}>{comparison.mode==='onoff'?say('Vertaa joukkueen tuloksia hänen ollessaan kentällä ja penkillä →','Compare the team with this player on and off the floor →'):say('Vertaa joukkueen tuloksia hänen kanssaan ja ilman →','Compare the team’s results with and without this player →')}</a></p>}
  {named?.length>0&&<p><span>{say('Samantyylisiä:','Plays like:')}</span> {named.map((row,index)=><span key={row.id}>{index>0&&', '}<a href={profile(row)} onClick={openLink}>{row.name}</a> <small>{row.season.replace('-','–')}</small></span>)} · <a href={`${routeHref({section:'Samankaltaiset',leagueId,seasonId})}&player=${encodeURIComponent(player.id)}`} onClick={openLink}>{say('Katso lisää →','See more →')}</a></p>}
 </div>;
}
