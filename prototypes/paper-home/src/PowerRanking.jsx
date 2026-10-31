import {useMemo} from 'react';
import {useI18n,locale} from './i18n';
import {useSeason} from './SeasonContext';
import {useMatches} from './useMatches';
import {TeamLogo} from './TeamLogo';
import {POWER_PARAMS,powerRanking,resultsFromGames} from './lib/powerRating';
import './power-ranking.css';

const signed=n=>{const value=Math.abs(n)<.05?0:n;return `${value>0?'+':value<0?'−':''}${Math.abs(value).toLocaleString(locale(),{minimumFractionDigits:1,maximumFractionDigits:1})}`;};
export function PowerRanking(){
 const {language}=useI18n(),say=(fi,en)=>language==='fi'?fi:en,{data,leagueId}=useSeason(),{games}=useMatches(data.matchesUrl);
 const rows=useMemo(()=>{const results=games?resultsFromGames(games):[];return results.length?powerRanking(results,POWER_PARAMS[leagueId]??POWER_PARAMS.men):[];},[games,leagueId]);
 if(!rows.length)return null;
 const extent=Math.max(...rows.map(r=>Math.abs(r.rating)+r.spread),1),x=v=>50+v/extent*50;
 return <article className="dash-card power-ranking"><header><h3>{say('Vahvuusjärjestys','Power ranking')}</h3><p>{say('Piste-erot suhteessa vastustajien tasoon. Viiva näyttää 80 %:n epävarmuusvälin.','Point differences relative to the opponents faced. The line shows the 80% uncertainty range.')}</p></header>
  <ol>{rows.map((row,i)=><li key={row.team}><span className="power-rank">{i+1}</span><TeamLogo name={row.team} className="power-logo" decorative/><span className="power-name">{row.team}<small>{row.wins}–{row.games-row.wins} · {say('ohjelma','schedule')} {signed(row.schedule)}</small></span>
   <span className="power-track" role="img" aria-label={say(`Vahvuus ${signed(row.rating)}, väli ${signed(row.rating-row.spread)} – ${signed(row.rating+row.spread)}`,`Rating ${signed(row.rating)}, range ${signed(row.rating-row.spread)} to ${signed(row.rating+row.spread)}`)}><i className="power-zero"/><i className="power-range" style={{left:`${x(row.rating-row.spread)}%`,width:`${x(row.rating+row.spread)-x(row.rating-row.spread)}%`}}/><i className="power-dot" style={{left:`${x(row.rating)}%`}}/></span>
   <strong>{signed(row.rating)}</strong></li>)}</ol>
  <p className="power-note">{say('Luku kertoo, kuinka monta pistettä joukkue on keskimääräistä vastustajaa parempi neutraalilla kentällä. "Ohjelma" on kohdattujen vastustajien keskitaso, ja plus tarkoittaa kovaa ohjelmaa. Kuvaa pelattuja otteluita, ei ennusta. Lukitussa testissä kaudella 2025–26 vastustajakorjaus ei ennustanut seuraavia otteluita paremmin kuin tavallinen piste-ero: miehillä tulos oli lähes sama, naisilla hieman heikompi.','The number is how many points a team is better than an average opponent on a neutral court. "Schedule" is the average level of the opponents faced; plus means a tough schedule. It describes games played and is not a forecast. In a locked test on 2025–26 the schedule correction did not predict later games better than plain point difference: nearly equal for men, slightly worse for women.')}</p>
 </article>;
}
