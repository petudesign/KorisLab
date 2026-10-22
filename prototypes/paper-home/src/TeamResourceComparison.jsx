import {useMemo,useState} from 'react';
import {TeamLogo} from './TeamLogo';
import {routeHref,slug} from './routing';
import {locale,t} from './i18n';
import {teamResourceRows,rankTeamResources} from './lib/teamResources';
import './team-resources.css';

const money=value=>Number.isFinite(value)?new Intl.NumberFormat(locale(),{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(value):'—';
const number=value=>Number.isFinite(value)?value.toLocaleString(locale(),{minimumFractionDigits:1,maximumFractionDigits:1}):'—';
const options=[['budget','Kausibudjetti'],['payroll','Palkkakulut'],['efficiency','Voitot / euro']];
export function TeamResourceComparison({seasonInfo,games,selectedTeam,leagueId,seasonId}){
 const [metric,setMetric]=useState('budget');
 const rows=useMemo(()=>teamResourceRows(seasonInfo,games),[seasonInfo,games]);
 const ranked=useMemo(()=>rankTeamResources(rows,metric),[rows,metric]);
 const max=Math.max(0,...rows.map(row=>row[metric]||0));
 const selected=ranked.find(row=>row.name===selectedTeam),leader=ranked.find(row=>row.rank===1);
 const efficiency=metric==='efficiency',period=seasonId.replace('-','–');
 const count=ranked.filter(row=>row.rank!==null).length;
 return <article className="dash-card team-intel-card team-resource-comparison">
  <header className="team-resource-heading"><h4 className="team-intel-title">{t('Liigan resurssivertailu')}</h4><div className="team-resource-tabs" aria-label={t('Resurssivertailun mittari')}>{options.map(([key,label])=><button key={key} type="button" aria-pressed={metric===key} onClick={()=>setMetric(key)}>{t(label)}</button>)}</div></header>
  <p className="team-resource-period">{period}{efficiency&&<> · {t('Runkosarja')} · {t('Voittoja / 100 000 € kausibudjettia')}</>}</p>
   {leader&&<div className="team-resource-summary"><span>{t('Vertailun kärki')} <a href={routeHref({section:'Joukkueet',teamId:slug(leader.name),leagueId,seasonId})}>{leader.name}</a></span>{selected?.rank&&<span>{selectedTeam} <b>#{selected.rank}<small> / {count}</small></b></span>}{!selected&&<span>{count}/{ranked.length} {t('vertailukelpoista joukkuetta')}</span>}</div>}
   <ol className="team-resource-list" aria-label={t('Joukkueiden resurssijärjestys')}>{ranked.map(row=><li key={row.name} className={row.name===selectedTeam?'selected':''}>
    <span className="team-resource-rank">{row.rank??'—'}</span>
    <div className="team-resource-team"><a href={routeHref({section:'Joukkueet',teamId:slug(row.name),leagueId,seasonId})}><span className="team-intel-logo" aria-hidden="true"><TeamLogo name={row.name}/></span><span>{row.name}</span></a>{efficiency&&<small>{row.games!==null?<>{row.wins}–{row.losses} · {row.games} {t('ottelua')} · {money(row.budget)}</>:t('Ei vertailukauden liigatuloksia')}</small>}</div>
    <div className="team-resource-value"><strong>{efficiency?number(row.efficiency):money(row[metric])}</strong><span className="team-resource-bar" aria-hidden="true"><i style={{width:`${max>0&&Number.isFinite(row[metric])?100*row[metric]/max:0}%`}}/></span></div>
   </li>)}</ol>
   <p className="team-intel-note">{efficiency?t('Voitot / euro = valitun kauden tähän mennessä tarkistetut runkosarjavoitot ÷ saman kauden kausibudjetti × 100 000. Ottelumäärät voivat erota. Luku päivittyy tulosten mukana, eikä mittaa mestaruuksia tai pudotuspelimenestystä.'):t('Järjestys perustuu joukkueiden ilmoittamiin euromääriin. Julkaisematon luku näkyy viivana.')}</p>
  <footer className="team-intel-source-row"><a className="team-intel-source" href={seasonInfo.sourceUrl} target="_blank" rel="noreferrer">{t('Basket.fi · joukkuepaketti')} ↗</a></footer>
 </article>;
}
