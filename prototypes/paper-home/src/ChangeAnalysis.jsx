import {useMemo,useState} from 'react';
import {useSeason,getSeason,seasonIds} from './SeasonContext';
import {useMatches} from './useMatches';
import {analyzeChange,changeRecords,previousPlayerIdentity} from './lib/changeAnalysis';
import {locale,t} from './i18n';
import {routeHref} from './routing';
import './change-analysis.css';
import {PlayerChangeContext} from './PlayerChangeContext';

const fmt=n=>Number.isFinite(n)?n.toLocaleString(locale(),{minimumFractionDigits:1,maximumFractionDigits:1}):'—';
const date=n=>new Date(n).toLocaleDateString(locale(),{day:'numeric',month:'numeric',year:'numeric'});
function Range({rows}){return rows.length?<span>{date(rows[0].date)} – {date(rows.at(-1).date)}</span>:null;}

export function ChangeAnalysis({games,player,teamName}){
 const {leagueId,seasonId}=useSeason(),type=player?'player':'team';
 const previousId=seasonIds[seasonIds.indexOf(seasonId)+1],previousSeason=previousId?getSeason(leagueId,previousId):null;
 const previous=useMatches(previousSeason?.matchesUrl);
 const records=useMemo(()=>changeRecords(games,{playerId:player?.id,teamName}),[games,player?.id,teamName]);
 const oldRecords=useMemo(()=>{
  if(!previous.games)return [];
  if(!player)return changeRecords(previous.games,{teamName});
  const id=previousPlayerIdentity(previous.games,player);
  // Name matching is allowed only when it is unique in both seasons.
  const sameNames=new Set(games.flatMap(g=>g.teams.flatMap(t=>t.players.filter(p=>p.name.normalize('NFC').trim().toLocaleLowerCase('fi')===player.name.normalize('NFC').trim().toLocaleLowerCase('fi')).map(p=>p.id))));
  return id&&(id===player.id||sameNames.size===1)?changeRecords(previous.games,{playerId:id}):[];
 },[previous.games,player,games,teamName]);
 const [mode,setMode]=useState(records.length>=8||!previousId?'recent':'season');
 const analysis=useMemo(()=>analyzeChange(records,oldRecords,{type,mode}),[records,oldRecords,type,mode]);
 const [expanded,setExpanded]=useState(false);
 const currentLabel=mode==='recent'?'Viimeiset 5':seasonId.replace('-','–'),baselineLabel=mode==='recent'?'Aiemmat ottelut':previousId?.replace('-','–');
 const loading=mode==='season'&&previousId&&!previous.games&&!previous.error;
 const sample=s=><span>{s.games} {t('ottelua')}{type==='player'&&<> · {Math.round(s.minutes||0)} {t('min')}</>}</span>;
 return <section className="change-analysis dash-card" aria-label={t('Mikä muuttui?')}>
  <header><div><h3>{t('Mikä muuttui?')}</h3></div><label>{t('Vertailu')}<select aria-label={t('Muutoksen vertailujakso')} value={mode} onChange={e=>setMode(e.target.value)}><option value="recent">{t('Viimeiset 5 vs. aiemmat')}</option>{previousId&&<option value="season">{t('Tämä kausi vs. edellinen')}</option>}</select></label></header>
  {loading?<p className="change-empty" role="status">{t('Ladataan edellisen kauden vertailua…')}</p>:mode==='season'&&previous.error?<div className="change-empty"><p>{t('Edellisen kauden vertailua ei voitu ladata.')}</p><button onClick={previous.retry}>{t('Yritä uudelleen')}</button></div>:!analysis.ready?<div className="change-empty"><strong>{t('Vertailuun tarvitaan enemmän otteluita.')}</strong><p>{t(mode==='recent'?'Tarvitaan viisi viimeistä ja vähintään kolme aiempaa pelattua ottelua.':'Kausivertailu tarvitsee vähintään kaksi nykyistä ottelua sekä pelaajalta kahdeksan tai joukkueelta viisi edellisen kauden ottelua.')}</p><p>{t('Nyt aineistossa:')} {analysis.current.games} / {analysis.baseline.games} {t('ottelua')}. {type==='player'&&t('Pelaajalta tarvitaan myös 30 nykyistä ja 120 vertailujakson minuuttia.')}</p></div>:<>
   <div className="change-summary"><p>{t(analysis.summary)}</p><span className="change-caution">{t(analysis.current.games<8?'Pieni otos · suuntaa antava havainto':'Kuvaileva vertailu · ei ennuste')}</span></div>
   <div className="change-samples"><div><b>{t(baselineLabel)}</b>{sample(analysis.baseline)}<Range rows={analysis.earlier}/></div><div><b>{t(currentLabel)}</b>{sample(analysis.current)}<Range rows={analysis.recent}/></div></div>
   <div className="change-findings" style={{'--finding-count':analysis.notable.length||3}}>{(analysis.notable.length?analysis.notable:analysis.rows.filter(r=>Number.isFinite(r.delta)).slice(0,3)).map(row=>{
    const max=Math.max(row.current,row.baseline,1),tone=row.neutral?'neutral':(row.lowerBetter?row.delta<0:row.delta>0)?'up':'down';
    return <article key={row.key}><span className="change-category">{t(row.category)}</span><h4>{t(row.label)}</h4><div className={`change-delta ${tone}`}>{row.delta>0?'+':''}{fmt(row.delta)} <small>{t(row.unit)}</small></div><div className="change-bars">{[[baselineLabel,row.baseline,'baseline'],[currentLabel,row.current,'current']].map(([label,value,kind])=><div key={kind}><span>{t(label)}</span><div className="change-bar-track"><i className={kind} style={{transform:`scaleX(${Math.max(0,value)/max})`}}/></div><b>{fmt(value)}</b></div>)}</div></article>;
   })}</div>
   {player&&<PlayerChangeContext analysis={analysis} games={games} previousGames={previous.games||[]} playerId={player.id} previousPlayerId={previous.games?previousPlayerIdentity(previous.games,player):null} mode={mode} seasonId={seasonId} previousId={previousId} leagueId={leagueId} currentLabel={currentLabel} baselineLabel={baselineLabel}/>}
   <button className="change-expand" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>{t(expanded?'Sulje tarkempi vertailu':'Tutki muutosta')} <span aria-hidden="true">{expanded?'−':'+'}</span></button>
   {expanded&&<div className="change-detail"><div className="entity-table-wrap"><table className="entity-table"><caption>{t('Kaikki vertailun mittarit')}</caption><thead><tr><th>{t('Mittari')}</th><th>{t(baselineLabel)}</th><th>{t(currentLabel)}</th><th>{t('Ero')}</th></tr></thead><tbody>{analysis.rows.map(row=><tr key={row.key}><th>{t(row.label)} <small>{t(row.unit)}</small></th><td>{fmt(row.baseline)}</td><td>{fmt(row.current)}</td><td>{row.delta>0?'+':''}{fmt(row.delta)}</td></tr>)}</tbody></table></div><div className="change-evidence">{[[baselineLabel,analysis.earlier,mode==='season'?previousId:seasonId],[currentLabel,analysis.recent,seasonId]].map(([label,list,season])=><details key={label}><summary>{t(label)} · {list.length} {t('ottelua')}</summary><ul>{list.map(r=><li key={r.id}><a href={routeHref({section:'Ottelut',matchId:r.id,leagueId,seasonId:season})}>{date(r.date)} · {r.opponent} <b>{r.score}–{r.allowed}</b></a>{r.sourceUrl&&<a href={r.sourceUrl} target="_blank" rel="noreferrer">{t('Lähde')}</a>}</li>)}</ul></details>)}</div></div>}
  </>}
  <details className="change-method"><summary>{t('Mitä tästä voi päätellä?')}</summary><p>{t('Vertailujaksot eivät sisällä samoja otteluita. Per 40 min -luvut lasketaan kokonaisminuuteista ja heittotehokkuus yhteenlasketuista heitoista; eFG-vertailu tarvitsee 30 yritystä kummaltakin jaksolta. Vain tarkistetut ottelut ovat mukana.')}</p><p>{t('Vastustajat, kokoonpanot ja roolit voivat erota. Lukuja ei ole korjattu vastustajien tasolla. Tilastoista ei päätellä loukkaantumista, minuuttirajoitusta tai taktista syytä. Muutos ei yksin osoita sen aiheuttajaa.')}</p>{type==='team'&&<p>{t('Pallonhallinnat ovat arvioita: heittoyritykset + 0,44 × vapaaheitot − hyökkäyslevypallot + menetykset. Ottelun kahden joukkueen arviot keskiarvoistetaan. Pienempi DRtg ja menetysluku ovat parempia; kolmosten osuus kuvaa heittovalintaa.')}</p>}</details>
 </section>;
}
