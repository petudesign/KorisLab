import {t as translate,locale} from './i18n';
import {HighlightTrend} from './SeasonHighlights';
import {metricLeader,playerMetric,playerRecentGames} from './lib/playerLeaders';
import {slug} from './routing';
const fmt=n=>Number.isFinite(n)?n.toLocaleString(locale(),{minimumFractionDigits:1,maximumFractionDigits:1}):'—';
const definitions=[
 {metric:'points',label:'Pisteet / ottelu',unit:'PPG',accent:'#df945b'},
 {metric:'assists',label:'Syötöt / ottelu',unit:'AST/G',accent:'#44d17a'},
 {metric:'rebounds',label:'Levypallot / ottelu',unit:'REB/G',accent:'#91b4c8'},
 {metric:'steals',label:'Riistot / ottelu',unit:'STL/G',accent:'#44d17a'},
 {metric:'efficiencyPer40',label:'Tehokkuus / 40 min',unit:'Eff/40',accent:'#df945b'},
 {metric:'trueShootingPct',label:'Pisteiden tehokkuus',unit:'TS %',accent:'#91b4c8'},
 {metric:'attemptsPer40',label:'Heittomäärä / 40 min',unit:'FGA/40',accent:'#df945b'},
 {metric:'minutes',label:'Peliminuutit kaudella',unit:'MIN',accent:'#44d17a'},
];
export function PlayerLeaders({players,games,link}){
 if(!players.length)return null;
 const minimumGames=Math.max(1,Math.ceil(Math.max(...players.map(p=>p.games))/3));
 return <section className="season-highlights player-leaders" aria-label={translate("Kauden kärjet")}><header><h3>{translate("Kauden kärjet")}</h3><span>{translate("Vähintään ")}{translate(minimumGames)} {translate(minimumGames===1?'ottelu':'ottelua')}</span></header><div className="season-highlight-grid">{translate(definitions.map(({metric,label,unit,accent})=>{
  const {leader:p,average,trendAverage}=metricLeader(players,metric,minimumGames);
  return <article className="season-highlight" key={metric} style={{'--highlight-accent':accent}}>
   <span className="highlight-label">{translate(label)}</span>
   <span className="highlight-average">{translate("Liigan KA ")}<b>{translate(fmt(average))} {translate(unit)}</b></span>
   {translate(p?<><div className="player-leader-summary"><img className="player-leader-portrait" src="/ppg-silhouette.png" alt={translate("")} title={translate("Pelaajakuva puuttuu")} width="40" height="40"/><div><span className="player-leader-name">{translate(link('Pelaajat',p.id,p.name))}</span><span className="player-leader-team">{translate(link('Joukkueet',slug(p.team),p.team))}{translate(" · ")}{translate(p.games)} {translate(p.games===1?'ottelu':'ottelua')}</span></div></div>
   <strong className="highlight-value">{translate(fmt(playerMetric(p,metric)))}<small>{translate(unit)}</small></strong>
   <HighlightTrend games={playerRecentGames(games,p.id,metric)} metric={metric} average={trendAverage} unit={metric==='minutes'?'MIN / ottelu':unit}/>
   </>:<p className="player-leader-empty">{translate("Ei riittävää tilastoaineistoa.")}</p>)}
  </article>;
 }))}</div><p className="player-leaders-method" title={translate("Liigan KA lasketaan kaikista pelanneista: per-game luvut ottelukertapainotettuina, per-40 luvut kokonaisminuuteista ja TS % yhteenlasketuista heitoista. Minuuttikortissa liigan KA on kokonaisminuuttien keskiarvo per pelaaja, käyrän vertailutaso minuutteja per ottelu.")}>{translate("Kärjet: vähintään ")}{translate(minimumGames)} {translate(minimumGames===1?'ottelu':'ottelua')}{translate(" ja ")}{translate(minimumGames*15)}{translate(" min. Käyrät: viimeiset enintään 5 ottelua. MIN: kauden kokonaisminuutit, ilman otosrajaa.")}</p></section>;
}
