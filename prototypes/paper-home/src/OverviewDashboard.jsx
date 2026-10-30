import {NotFoundPage,LoadingSkeleton} from './PageStates';
import {lazy,Suspense} from 'react';
const CustomImport=lazy(()=>import('./CustomImport'));
const MatchupLab=lazy(()=>import('./MatchupLab').then(m=>({default:m.MatchupLab})))
const SimStudio=lazy(()=>import('./SimStudio'));
const AnalysisPage=lazy(()=>import('./AnalysisPage'));
import {DesignSystem} from './DesignSystem';
import {SearchPage} from './SearchPage';
import {t as translate,locale} from './i18n';
import {BrandMark} from './BrandMark';
import { useEffect, useId, useRef, useState } from 'react';
import HomeOutlined from '@mui/icons-material/HomeOutlined';
import PersonOutlined from '@mui/icons-material/PersonOutlined';
import ArticleOutlined from '@mui/icons-material/ArticleOutlined';
import CompareArrowsOutlined from '@mui/icons-material/CompareArrowsOutlined';
import ViewInArOutlined from '@mui/icons-material/ViewInArOutlined';
import FileUploadOutlined from '@mui/icons-material/FileUploadOutlined';
import MonitorHeartOutlined from '@mui/icons-material/MonitorHeartOutlined';
import GridViewOutlined from '@mui/icons-material/GridViewOutlined';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import SportsBasketballOutlined from '@mui/icons-material/SportsBasketballOutlined';
import BarChartOutlined from '@mui/icons-material/BarChartOutlined';
import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined';
import MenuOutlined from '@mui/icons-material/MenuOutlined';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import { useSeason } from './SeasonContext';
import './overview.css';
import {routeHref,slug} from './routing';
import {EntityPages} from './EntityPages';
import {MatchesPage} from './MatchesPage';
import { TeamTable } from './TeamTable';
import { SeasonHighlights } from './SeasonHighlights';
import {PlayerTransfers} from './PlayerTransfers';
import {SeasonTrends} from './SeasonTrends';
import {OverviewPointsTrend} from './OverviewPointsTrend';
const number = value => value.toLocaleString(locale(), {maximumFractionDigits:1, minimumFractionDigits:1});
const options = [{key:'points',label:'Pisteet / ottelu',get:t=>t.per_game.points},{key:'net',label:'Nettotehokkuus',get:t=>t.metrics.net_rating},{key:'efg',label:'eFG %',get:t=>t.metrics.efg_pct}];
export function OverviewDashboard({expanded=false,onExpand,onNavigate,initialSection='Yleiskatsaus',searchQuery,onSearch,onSearchRoute,matchId=null,matchPanel,onMatchTab,onOpenMatch,playerId,teamId:routeTeamId,articleId,onEntityNavigate}) {
 const {data:season,leagueName,seasonLabel,leagueId,seasonId}=useSeason();
const teams = season.aggregate.teams;
const sum = key => teams.reduce((n,t)=>n+t.totals[key],0);
const teamGames = teams.reduce((n,t)=>n+t.games,0);
const league = {
 name:'Koko sarja',games:season.aggregate.games,
 per_game:{points:sum('points')/teamGames},
 totals:{two_pm:sum('two_pm'),three_pm:sum('three_pm'),two_pa:sum('two_pa'),three_pa:sum('three_pa')},
 metrics:{efg_pct:100*(sum('two_pm')+1.5*sum('three_pm'))/(sum('two_pa')+sum('three_pa')),offensive_rating:100*sum('points')/teams.reduce((n,t)=>n+t.metrics.estimated_possessions,0),net_rating:0}
};
 const [teamId,setTeamId]=useState('league'),[metric,setMetric]=useState('points'),[section,setSection]=useState(initialSection);
 const [menuOpen,setMenuOpen]=useState(false);
 const contentRef=useRef(null);
 const [atEnd,setAtEnd]=useState(false);
 useEffect(()=>{
  if(!expanded)return;
  const content=contentRef.current;
  content.scrollTop=0;
  const update=()=>setAtEnd(content.scrollHeight-content.clientHeight-content.scrollTop<=2);
  const observer=new ResizeObserver(update);
  observer.observe(content);
  for(const child of content.children)observer.observe(child);
  content.addEventListener('scroll',update,{passive:true});
  update();
  return()=>{observer.disconnect();content.removeEventListener('scroll',update);};
 },[expanded,section,matchId,playerId,routeTeamId,articleId,searchQuery]);
 const menuId=useId();
 const current=teams.find(t=>t.source_team_id===teamId)||league;
 const active=options.find(o=>o.key===metric);
 const ranked=[...teams].sort((a,b)=>active.get(b)-active.get(a));
 const fieldAttempts=current.totals.two_pa+current.totals.three_pa;
 const threeShare=fieldAttempts?100*current.totals.three_pa/fieldAttempts:null;
 const count=value=>Number.isFinite(value)?value.toLocaleString(locale()):'—';
 const chooseTeam=t=>{setTeamId(t.source_team_id);};
 return <section className={`overview-dashboard ${expanded?'dashboard-expanded':''} ${section==='Sivua ei löytynyt'?'dashboard-not-found':''} ${expanded&&atEnd?'content-at-end':''}`} aria-label={translate(expanded?`KorisLab ${section.toLocaleLowerCase('fi')}`:'Interaktiivinen yleiskatsauksen esikatselu')}>
  {translate(!expanded&&<div className="dash-topbar"><a href="#" className="dash-logo"><BrandMark/></a>{translate(!expanded&&<button onClick={onExpand} className="dash-open">{translate("Avaa yleiskatsaus ")}<ArrowOutwardOutlined/></button>)}</div>)}
  <div className="dash-mobile-menu">{translate(expanded&&<button aria-expanded={menuOpen} aria-controls={menuId} onClick={()=>setMenuOpen(!menuOpen)}>{translate(menuOpen?<CloseOutlined/>:<MenuOutlined/>)}<span>{translate(section)}</span></button>)}</div>
  <div className="dash-shell"><aside id={menuId} className={`dash-sidebar ${menuOpen?'menu-open':''}`} aria-label={translate("Yleiskatsauksen navigaatio")}><span className="dash-section-label">{translate("Näkymä")}</span>{translate([['Etusivu',HomeOutlined],['Yleiskatsaus',GridViewOutlined],['Ottelut',SportsBasketballOutlined],['Joukkueet',GroupsOutlined],['Pelaajat',PersonOutlined],['Kausitrendit',BarChartOutlined],['Analyysit',ArticleOutlined]].map(([label,Icon])=><a href={routeHref({section:label,leagueId,seasonId})} key={label} className={section===label?'selected':''} aria-current={section===label?'page':undefined} onClick={e=>{if(e.metaKey||e.ctrlKey||e.shiftKey)return;e.preventDefault();setMenuOpen(false);if(expanded)onNavigate?.(label);else if(label==='Yleiskatsaus')setSection(label);else onNavigate?.(label);}}><Icon/><span>{translate(label)}</span>{translate(label==='Ottelut'&&<span className="dash-nav-count">{translate(season.schedule?.length||season.aggregate.games)}</span>)}</a>))}<span className="dash-section-label">{translate("Työkalut")}</span>{translate([['Matchup Lab',CompareArrowsOutlined],['Sim Studio',ViewInArOutlined],['Custom import',FileUploadOutlined],['Datan tila',MonitorHeartOutlined]].map(([label,Icon])=><button key={label} className={section===label?'selected':''} aria-current={section===label?'page':undefined} onClick={()=>{setMenuOpen(false);onNavigate?.(label);}}><Icon/><span>{translate(label)}</span></button>))}<div className="dash-source"><i/>{translate(season.aggregate.games)}{translate(" ottelua")}<span>{translate("Kauden tilastoaineisto")}</span></div></aside>
  <div ref={contentRef} className="dash-content" tabIndex={expanded?0:undefined} aria-label={translate(expanded?"Vieritettävä sisältö":undefined)}>{translate(!(expanded&&(section==='Sivua ei löytynyt'||section==='Analyysit'||section==='Design system'||section==='Haku'||section==='Joukkueet'||section==='Custom import'||section==='Pelaajat'&&playerId))&&<header className="dash-heading"><div><h2>{translate(section==='Ottelut'&&matchId?'Ottelu':section)}</h2><p>{translate(section==='Yleiskatsaus'&&<>{translate(current.name)}{translate(" · ")}</>)}{translate(leagueName)} {translate(seasonLabel)}</p></div>{translate(section==='Yleiskatsaus'&&<label className="dash-team-label"><span className="sr-only">{translate("Dashboardin joukkue")}</span><select aria-label={translate("Dashboardin joukkue")} value={teamId} onChange={e=>setTeamId(e.target.value)}><option value="league">{translate("Koko sarja")}</option>{translate(teams.map(t=><option key={t.source_team_id} value={t.source_team_id}>{translate(t.name)}</option>))}</select></label>)}</header>)}
  {translate(section==='Design system'?<DesignSystem/>:section==='Haku'?<SearchPage key={searchQuery} query={searchQuery} onSearch={onSearch} onRoute={onSearchRoute}/>:section==='Ottelut'?<MatchesPage matchId={matchId} matchPanel={matchPanel} onTabChange={onMatchTab} onOpenMatch={onOpenMatch} onEntityNavigate={onEntityNavigate}/>:expanded&&['Joukkueet','Pelaajat'].includes(section)?<EntityPages section={section} teamId={routeTeamId} playerId={playerId} onNavigate={onEntityNavigate} onOpenMatch={onOpenMatch}/>:expanded&&section==='Kausitrendit'?<SeasonTrends onOpenMatch={onOpenMatch}/>:expanded&&section==='Custom import'?<Suspense fallback={<LoadingSkeleton variant="comparison" label="Ladataan tuontityökalua…"/>}><CustomImport/></Suspense>:expanded&&section==='Matchup Lab'?<div className="matchup-loading-boundary"><Suspense fallback={<LoadingSkeleton variant="comparison" label="Ladataan vertailua…"/>}><MatchupLab/></Suspense></div>:expanded&&section==='Analyysit'&&expanded?<Suspense fallback={<LoadingSkeleton variant="comparison" label="Ladataan analyysiä…"/>}><AnalysisPage articleId={articleId} onNavigate={onEntityNavigate}/></Suspense>:section==='Sim Studio'?<Suspense fallback={<LoadingSkeleton variant="comparison" label="Ladataan simulaatiota…"/>}><SimStudio/></Suspense>:expanded&&section==='Sivua ei löytynyt'?<NotFoundPage onNavigate={onNavigate}/>:expanded&&section!=='Yleiskatsaus'?<article className="dash-card"><p>{translate(section==='Sivua ei löytynyt'?'Sivua ei löytynyt. Valitse näkymä sivuvalikosta.':'Tämän näkymän nykyiset KorisLab-toiminnot siirretään seuraavaksi uuteen UI:hin.')}</p></article>:<>
  {translate(section==='Yleiskatsaus'&&<div className="dash-metrics">{translate([{key:'points',label:'Pisteet / ottelu',value:current.per_game.points,caption:'Kauden KA · pisteitä / joukkue'},{key:'efg',label:'Heittojen tehokkuus',value:current.metrics.efg_pct,suffix:'%',caption:'eFG · kolmoset huomioitu'},{key:'net',label:teamId==='league'?'Hyökkäystehokkuus':'Nettotehokkuus',value:teamId==='league'?current.metrics.offensive_rating:current.metrics.net_rating,caption:'Pistettä / 100 pallonhallintaa'}].map(m=><button key={m.key} className={`dash-card dash-metric ${metric===m.key?'metric-active':''}`} onClick={()=>setMetric(m.key)} aria-label={translate(`Näytä ${options.find(o=>o.key===m.key).label}`)}><span className="dash-card-label">{translate(m.label)}</span><strong>{translate(number(m.value))}{translate(m.suffix&&<small>{translate(m.suffix)}</small>)}</strong><span className="dash-caption">{translate(m.caption)}</span>{translate(m.key==='points'?<OverviewPointsTrend matchesUrl={season.matchesUrl} teamId={teamId} average={current.per_game.points}/>:m.key==='efg'?<div className="dash-shot-rates">{translate([['2P',current.totals.two_pm/current.totals.two_pa*100],['3P',current.totals.three_pm/current.totals.three_pa*100]].map(([label,value])=><div key={label}><span>{translate(label)}</span><i><b style={{width:`${value}%`}}/></i><span>{translate(number(value))}{translate("%")}</span></div>))}</div>:<div className="dash-metric-context">{translate(teamId==='league'?`${season.aggregate.games} ottelun aineisto`:'Hyökkäys − puolustus')}</div>)}</button>))}</div>)}
  {/* Standings come right after the season numbers: they are what most visitors look for first. */}
  <TeamTable onEntityNavigate={onEntityNavigate} selectedTeam={teamId}/>
  <div className={`dash-charts ${section==='Joukkueet'?'charts-hidden':''}`}><article className="dash-card dash-ranking"><header><div><span className="dash-card-label">{translate("Joukkueiden vertailu")}</span><h3>{translate(active.label)}</h3></div><select aria-label={translate("Vertailun mittari")} value={metric} onChange={e=>setMetric(e.target.value)}>{translate(options.map(o=><option key={o.key} value={o.key}>{translate(o.label)}</option>))}</select></header><div className="dash-ranking-rows">{translate(ranked.slice(0,5).map(t=><div key={t.name} className={'dash-ranking-row '+(teamId===t.source_team_id?'selected-team':'')}><a className="dash-ranking-team" href={routeHref({section:'Joukkueet',leagueId,seasonId,teamId:slug(t.name)})} onClick={event=>{if(onEntityNavigate&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey){event.preventDefault();onEntityNavigate('Joukkueet',slug(t.name),seasonId);}}}>{translate(t.name)}</a><button className="dash-ranking-select" onClick={()=>chooseTeam(t)} title={translate(t.name+': '+number(active.get(t)))} aria-label={translate('Näytä joukkueen luvut')+' · '+translate(t.name)}><span className="dash-bar-track"><i style={{width:(metric==='net'?Math.max(4,(active.get(t)+30)/60*100):active.get(t)/Math.max(...ranked.map(active.get))*100)+'%'}}/></span><strong>{translate(number(active.get(t)))}</strong></button></div>))}</div></article><article className="dash-card dash-shots"><span className="dash-card-label">{translate("Heittoprofiili")}</span><h3>{translate("Kolmosten osuus")}</h3><div className="dash-donut" style={{'--share':`${threeShare??0}%`}}><div><strong>{translate(threeShare==null?'—':`${number(threeShare)}%`)}</strong><span>{translate("heittoyrityksistä")}</span></div></div><dl className="dash-shot-counts">{translate([['3 pisteen heitot',current.totals.three_pa,'three'],['2 pisteen heitot',current.totals.two_pa,'two']].map(([label,attempts,type])=><div key={type}><dt><i className={type}/>{translate(label)}</dt><dd><strong>{translate(count(attempts))}</strong><span>{translate(fieldAttempts?`${number(100*attempts/fieldAttempts)} %`:'—')}</span></dd></div>))}</dl><p className="dash-shot-total">{translate("Yhteensä ")}<strong>{translate(count(fieldAttempts))}</strong>{translate(" pelitilanneheittoyritystä ")}<span>{translate("Kauden yritykset · vapaaheitot eivät sisälly")}</span></p></article></div>
  {translate(section==='Yleiskatsaus'&&<SeasonHighlights onChooseTeam={chooseTeam} selectedTeam={teamId} onEntityNavigate={onEntityNavigate}/>)}
  {translate(section==='Yleiskatsaus'&&<PlayerTransfers selectedTeamId={teamId} onEntityNavigate={onEntityNavigate} preview={!expanded}/>)}
  </>)}
  </div></div>
 </section>;
}
