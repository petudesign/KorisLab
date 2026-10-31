import {useMemo} from 'react';
import {useI18n,locale} from './i18n';
import {useSeason} from './SeasonContext';
import {useMatches} from './useMatches';
import {TeamLogo} from './TeamLogo';
import {POWER_PARAMS,powerRanking,rangeVerdict,resultsFromGames} from './lib/powerRating';
import './power-ranking.css';

const signed=n=>{const value=Math.abs(n)<.05?0:n;return `${value>0?'+':value<0?'−':''}${Math.abs(value).toLocaleString(locale(),{minimumFractionDigits:1,maximumFractionDigits:1})}`;};
export function PowerRanking(){
 const {language}=useI18n(),say=(fi,en)=>language==='fi'?fi:en,{data,leagueId}=useSeason(),{games}=useMatches(data.matchesUrl);
 const rows=useMemo(()=>{const results=games?resultsFromGames(games):[];return results.length?powerRanking(results,POWER_PARAMS[leagueId]??POWER_PARAMS.men):[];},[games,leagueId]);
 if(!rows.length)return null;
 const extent=Math.max(...rows.map(r=>Math.abs(r.rating)+r.spread),1),x=v=>50+v/extent*50;
 const verdicts={above:say('selvästi keskitason yläpuolella','clearly above average'),below:say('selvästi keskitason alapuolella','clearly below average'),open:say('ero keskitasoon vielä epävarma','difference from average still unclear')};
 return <article className="dash-card power-ranking"><header><h3>{say('Vahvuusjärjestys','Power ranking')}</h3><p>{say('Kuinka monta pistettä joukkue voittaisi keskimääräisen joukkueen neutraalilla kentällä, kun vastustajien taso on huomioitu.','How many points a team would beat an average team by on a neutral court, with the opponents faced taken into account.')}</p></header>
  <ul className="power-legend"><li><i className="power-key-dot"/>{say('arvio','estimate')}</li><li><i className="power-key-line"/>{say('todennäköinen väli (80 %)','likely range (80%)')}</li><li><i className="power-key-clear"/>{say('väri: selvä ero keskitasoon','colour: clear difference from average')}</li><li><i className="power-key-open"/>{say('harmaa: ero vielä epävarma','grey: difference still unclear')}</li></ul>
  <div className="power-head" aria-hidden="true"><span className="power-head-team">{say('Joukkue','Team')}</span><span className="power-axis"><b>{say('Heikompi','Weaker')}</b><b>{say('Keskitaso','Average')}</b><b>{say('Vahvempi','Stronger')}</b></span><span className="power-head-opp">{say('Vastustajat','Opponents')}</span><span className="power-head-value">{say('Vahvuus','Rating')}</span></div>
  <ol>{rows.map((row,i)=>{const verdict=rangeVerdict(row),low=x(row.rating-row.spread),high=x(row.rating+row.spread),opponents=signed(row.schedule);return <li key={row.team} className={`is-${verdict}`}><span className="power-rank">{i+1}</span><TeamLogo name={row.team} className="power-logo" decorative/><span className="power-name">{row.team}<small>{row.wins}–{row.games-row.wins}<span className="power-opp-inline"> · {say('vastustajat','opponents')} {opponents}</span></small></span>
   <span className="power-track" role="img" aria-label={say(`Vahvuus ${signed(row.rating)}, todennäköinen väli ${signed(row.rating-row.spread)} – ${signed(row.rating+row.spread)}, ${verdicts[verdict]}`,`Rating ${signed(row.rating)}, likely range ${signed(row.rating-row.spread)} to ${signed(row.rating+row.spread)}, ${verdicts[verdict]}`)}><i className="power-zero"/><i className="power-range" style={{left:`${low}%`,width:`${high-low}%`}}/><i className="power-dot" style={{left:`${x(row.rating)}%`}}/></span>
   <span className="power-opp">{opponents}</span><strong>{signed(row.rating)}</strong></li>;})}</ol>
  <p className="power-note">{say('Vastustajat: kohdattujen joukkueiden keskimääräinen vahvuus. Plus tarkoittaa keskimääräistä kovempaa ohjelmaa. Vahvuus on varovainen arvio pienen otoksen takia, joten se on pienempi kuin pelkkä piste-ero ottelua kohti, varsinkin miehillä. Lukuja ei voi verrata sarjojen välillä. Näkymä kuvaa pelattuja otteluita eikä ole ennuste. Lukitussa testissä kaudella 2025–26 vastustajakorjaus ei ennustanut seuraavia otteluita paremmin kuin tavallinen piste-ero: miehillä tulos oli lähes sama, naisilla hieman heikompi.','Opponents: the average rating of the teams faced. Plus means a tougher schedule than average. The rating is a cautious estimate because of the small sample, so it is smaller than plain point difference per game, especially for men. The numbers cannot be compared between leagues. This describes games played and is not a forecast. In a locked test on 2025–26 the schedule correction did not predict later games better than plain point difference: nearly equal for men, slightly worse for women.')}</p>
 </article>;
}
