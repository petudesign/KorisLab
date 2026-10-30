import {SearchClearButton} from './SearchClearButton';
import {ConnectionNotice} from './PageStates';
import {t as translate,locale,useI18n,LanguageSettings} from './i18n';
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MetalFx } from 'metal-fx';
import { Dithering } from '@paper-design/shaders-react';
import './premium-effects.css';
const HeroFog=lazy(()=>import('./HeroFog'));
import GridViewOutlined from '@mui/icons-material/GridViewOutlined';
import SportsBasketballOutlined from '@mui/icons-material/SportsBasketballOutlined';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import PersonOutlined from '@mui/icons-material/PersonOutlined';
import BarChartOutlined from '@mui/icons-material/BarChartOutlined';
import ArticleOutlined from '@mui/icons-material/ArticleOutlined';
import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined';
import ChevronLeftOutlined from '@mui/icons-material/ChevronLeftOutlined';
import ChevronRightOutlined from '@mui/icons-material/ChevronRightOutlined';
import BuildOutlined from '@mui/icons-material/BuildOutlined';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import HomeOutlined from '@mui/icons-material/HomeOutlined';
import CompareArrowsOutlined from '@mui/icons-material/CompareArrowsOutlined';
import ViewInArOutlined from '@mui/icons-material/ViewInArOutlined';
import FileUploadOutlined from '@mui/icons-material/FileUploadOutlined';
import MonitorHeartOutlined from '@mui/icons-material/MonitorHeartOutlined';
import MenuOutlined from '@mui/icons-material/MenuOutlined';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import { DecryptedText } from './DecryptedText';
import './motion.css';
import { HomeSections } from './HomeSections';
import {BrandMark} from './BrandMark';
import { TeamLogo } from './TeamLogo';
import { OverviewDashboard } from './OverviewDashboard';
import {useRoutes,routeHref,sectionPaths,takeScrollRestore} from './routing';
import {useMatches} from './useMatches';
import {recentResults} from './lib/recentResults';
import {slug} from './routing';
import {useMetadata} from './seo';
import { SeasonContext, getSeason, leagues, seasonIds } from './SeasonContext';
const asset = name => '/assets/' + name + '.png';
const nav = [['Yleiskatsaus',GridViewOutlined],['Ottelut',SportsBasketballOutlined],['Joukkueet',GroupsOutlined],['Pelaajat',PersonOutlined],['Kausitrendit',BarChartOutlined],['Analyysit',ArticleOutlined]];
const logoIds={'Vimpelin Veto':'01M4JY38MCJ9HYJQSQN7XB5KS6','Tapiolan Honka':'01M4JY48TXE0MM7Z3AEWRGHS3N','Espoo Basket Team':'01M4JYR36RCHZ2W52CKVWP505N','HBA-Märsky':'01M4JYSG66K44Q3ESDFBA94DM7','BC Nokia':'01M4JZ22GP1M2QGKCGHSCXASM8','Peli-Karhut':'01M4JZ3A0N7K2RNBX6F1WD9B1D'};
function savedSelection(){try{const saved=JSON.parse(localStorage.getItem('korislab-prototype-season')||'null');if(saved&&leagues[saved.leagueId]&&seasonIds.includes(saved.seasonId))return saved;}catch{}return {leagueId:'women',seasonId:'2025-26'};}
export function App() {
 const {language}=useI18n();
 const {route,navigate}=useRoutes(savedSelection());
 const {leagueId,seasonId,matchId,playerId,teamId}=route;
 const [seasonMenuOpen,setSeasonMenuOpen]=useState(false);
 const setLeagueId=leagueId=>navigate({leagueId,matchId:undefined,playerId:undefined,teamId:undefined});
 const setSeasonId=seasonId=>navigate({seasonId,matchId:undefined});
 const season=getSeason(leagueId,seasonId),leagueName=leagues[leagueId],seasonLabel=seasonId.replace('-', '–');
 const {games:railGames}=useMatches(season.matchesUrl);
 const games=railGames?recentResults(railGames):season.games;
 const seasonKey=`${leagueId}-${seasonId}`;
 const railKey=`${seasonKey}:${games.map(game=>game.id).join(",")}`;

 useEffect(()=>{try{localStorage.setItem('korislab-prototype-season',JSON.stringify({leagueId,seasonId}));}catch{}},[leagueId,seasonId]);
 const picker=useRef(null);
 useEffect(()=>{if(!seasonMenuOpen)return;const close=e=>{if(e.type==='keydown'){if(e.key==='Escape'){setSeasonMenuOpen(false);picker.current?.querySelector('.season-picker-trigger')?.focus();}}else if(!picker.current?.contains(e.target))setSeasonMenuOpen(false);};document.addEventListener('pointerdown',close);document.addEventListener('keydown',close);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',close);if(picker.current?.querySelector('.season-menu')?.contains(document.activeElement))picker.current?.querySelector('.season-picker-trigger')?.focus();};},[seasonMenuOpen]);
 useEffect(()=>{rail.current?.scrollTo({left:0});setPanel(null);},[seasonKey]);
 const wrapper=useRef(null),rail=useRef(null),dialog=useRef(null);
 const view=route.section==='Etusivu'?'home':'overview';
 const dashboardSection=route.section;
 const [mobileNavOpen,setMobileNavOpen]=useState(false);
 const [keyboardInput,setKeyboardInput]=useState(false);
 const showOverview=(initial='Yleiskatsaus')=>{setMobileNavOpen(false);navigate({section:typeof initial==='string'?initial:'Yleiskatsaus',matchId:undefined,playerId:undefined,teamId:undefined});};
 const openMatch=id=>{setMobileNavOpen(false);navigate({section:'Ottelut',matchId:id||undefined,matchPanel:undefined,playerId:undefined,teamId:undefined});};
 const openEntity=(section,id,seasonIdOverride)=>{setMobileNavOpen(false);navigate({section,seasonId:seasonIdOverride||route.seasonId,matchId:undefined,playerId:section==='Pelaajat'?id||undefined:undefined,teamId:section==='Joukkueet'?id||undefined:undefined,articleId:section==='Analyysit'?id||undefined:undefined});};
 const dashboardNavigate=label=>{if(sectionPaths[label])showOverview(label);else setPanel({kind:'nav',title:label});};
 const showHome=()=>{setMobileNavOpen(false);navigate({section:'Etusivu',matchId:undefined,playerId:undefined,teamId:undefined});};
 useMetadata(route.section==='Etusivu'?'Suomalainen koripallo, datan kautta':route.matchId?'Ottelun analyysi':route.playerId?'Pelaajatilastot':route.teamId?'Joukkuetilastot':route.section,`${leagueName} ${seasonLabel}: ${route.section.toLocaleLowerCase('fi')}, tilastot ja analyysit.`,route,!['Ottelut','Pelaajat','Joukkueet'].includes(route.section));
 const [scale,setScale]=useState(1),[query,setQuery]=useState(''),[panel,setPanel]=useState(null),[dialogContent,setDialogContent]=useState(null),[reduced,setReduced]=useState(false),[scrollState,setScrollState]=useState({left:false,right:true});
 useEffect(()=>{const resize=new ResizeObserver(([entry])=>setScale(entry.contentRect.width/1366));resize.observe(wrapper.current);const media=matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(media.matches);update();media.addEventListener('change',update);return()=>{resize.disconnect();media.removeEventListener('change',update);};},[]);
 useEffect(()=>{if(panel){setDialogContent(panel);if(!dialog.current.open)dialog.current.showModal();}},[panel]);
 const displayPanel=panel||dialogContent;
 useEffect(()=>{if(!mobileNavOpen)return;const menu=document.getElementById('mobile-main-menu'),trigger=document.querySelector('.mobile-nav-toggle');const close=e=>{if(e.type==='keydown'){if(e.key!=='Escape')return;e.preventDefault();setMobileNavOpen(false);trigger?.focus();}else if(!menu?.contains(e.target)&&!trigger?.contains(e.target))setMobileNavOpen(false);};document.addEventListener('keydown',close);document.addEventListener('pointerdown',close);return()=>{document.removeEventListener('keydown',close);document.removeEventListener('pointerdown',close);if(menu?.contains(document.activeElement))trigger?.focus();};},[mobileNavOpen]);
 useEffect(()=>{
  if(view!=='overview')return;
  const desktop=matchMedia('(min-width:701px)'),reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
  let frame=0,destination=0,lastFrame=0,scrollingContent=null;
  const stop=()=>{cancelAnimationFrame(frame);frame=0;lastFrame=0;scrollingContent=null;};
  const animate=time=>{
   if(!scrollingContent?.isConnected||document.querySelector('dialog[open]')){stop();return;}
   const elapsed=lastFrame?Math.min(time-lastFrame,32):16;
   lastFrame=time;
   const remaining=destination-scrollingContent.scrollTop;
   if(Math.abs(remaining)<.75){scrollingContent.scrollTop=destination;stop();return;}
   // Time-based easing stays consistent on 60 Hz and 120 Hz displays.
   scrollingContent.scrollTop+=remaining*(1-Math.exp(-elapsed/30));
   frame=requestAnimationFrame(animate);
  };
  const forwardWheel=event=>{
   if(event.defaultPrevented||event.ctrlKey||!desktop.matches||document.querySelector('dialog[open]')){stop();return;}
   const target=event.target;
   if(!(target instanceof Element))return;
   if(target.closest('.dash-content,.season-menu,.mobile-main-menu,select,input,textarea')){stop();return;}
   if(Math.abs(event.deltaX)>Math.abs(event.deltaY))return;
   const sidebar=target.closest('.dash-sidebar');
   if(sidebar&&sidebar.scrollHeight>sidebar.clientHeight)return;
   const content=document.querySelector('.dashboard-expanded .dash-content');
   if(!content||content.scrollHeight<=content.clientHeight)return;
   const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?content.clientHeight:1);
   if(!delta)return;
   event.preventDefault();
   if(reduceMotion.matches){stop();content.scrollTop+=delta;return;}
   if(scrollingContent!==content){stop();scrollingContent=content;destination=content.scrollTop;}
   // Reverse promptly rather than finishing the previous wheel movement first.
   if(delta*(destination-content.scrollTop)<0)destination=content.scrollTop;
   destination=Math.max(0,Math.min(content.scrollHeight-content.clientHeight,destination+delta));
   if(!frame)frame=requestAnimationFrame(animate);
  };
  window.addEventListener('wheel',forwardWheel,{passive:false});
  window.addEventListener('pointerdown',stop,{passive:true});
  window.addEventListener('keydown',stop);
  return()=>{stop();window.removeEventListener('wheel',forwardWheel);window.removeEventListener('pointerdown',stop);window.removeEventListener('keydown',stop);};
 },[view]);

 const updateScroll=()=>{const el=rail.current;setScrollState({left:el.scrollLeft>2,right:el.scrollLeft+el.clientWidth<el.scrollWidth-2});};
 useLayoutEffect(()=>{rail.current.scrollTo({left:0,behavior:'instant'});updateScroll();},[railKey,view]);
 useEffect(()=>{const observer=new ResizeObserver(updateScroll);observer.observe(rail.current);return()=>observer.disconnect();},[railKey]);
 const move=direction=>{const el=rail.current;const card=el.querySelector('.match-card');const step=card.offsetWidth+parseFloat(getComputedStyle(el).gap);el.scrollBy({left:direction*step,behavior:reduced?'instant':'smooth'});};
 const submitSearch=value=>{setQuery(value);setMobileNavOpen(false);setPanel(null);navigate({section:'Haku',searchQuery:value,matchId:undefined,matchPanel:undefined,playerId:undefined,teamId:undefined});};
 useLayoutEffect(()=>{setQuery(route.section==='Haku'?route.searchQuery||'':'');},[route]);
 // A new page starts at the top; Back returns to the earlier position. On mobile the window scrolls, not the content area.
 useLayoutEffect(()=>{const top=takeScrollRestore()??0,go=()=>window.scrollTo({top,behavior:'instant'});go();if(top){const frame=requestAnimationFrame(()=>requestAnimationFrame(go));return()=>cancelAnimationFrame(frame);}},[route.section,route.matchId,route.playerId,route.teamId,route.articleId,route.searchQuery]);
 const search=e=>{e.preventDefault();if(query.trim())submitSearch(query.trim());};
 const results=season.aggregate.teams;
 return <SeasonContext.Provider value={{data:season,leagueName,seasonLabel,leagueId,seasonId}}><main className={`prototype-page ${view==='overview'?'data-page':''} ${keyboardInput?'keyboard-input':''}`} onKeyDownCapture={()=>setKeyboardInput(true)} onPointerDownCapture={()=>setKeyboardInput(false)}><ConnectionNotice/><div className="nav-wrapper" style={{'--scale':scale}}> <header className="navigation"><a className="brand" href={routeHref({...route,section:'Etusivu',matchId:undefined,teamId:undefined,playerId:undefined})} onClick={e=>{if(!e.metaKey&&!e.ctrlKey){e.preventDefault();showHome();}}} aria-label={translate("KorisLab etusivu")}><BrandMark/></a><button className="mobile-nav-toggle" aria-label={translate(mobileNavOpen?"Sulje päävalikko":"Avaa päävalikko")} aria-expanded={mobileNavOpen} aria-controls="mobile-main-menu" onClick={()=>setMobileNavOpen(!mobileNavOpen)}>{translate(mobileNavOpen?<CloseOutlined/>:<MenuOutlined/>)}</button><nav aria-label={translate("Päänavigaatio")}>{translate(nav.map(([label,Icon])=><a key={label} href={routeHref({section:label,leagueId,seasonId})} onClick={e=>{if(e.metaKey||e.ctrlKey||e.shiftKey)return;e.preventDefault();dashboardNavigate(label);}}><Icon aria-hidden="true" sx={{fontSize:20}}/><span>{translate(label)}</span></a>))}</nav><form className="nav-search" onSubmit={search}><input aria-label={translate("Hae navigaatiosta")} value={query} onChange={e=>setQuery(e.target.value)} placeholder={translate(view==='overview'?"Hae joukkueita tai pelaajia…":"Hae…")}/><SearchClearButton value={query} onClear={()=>setQuery('')}/><MetalFx key={view} variant="circle" preset="chromatic" strength={1} theme="dark" paused disableGlow className="nav-search-metal"><button type="submit" aria-label={translate("Hae navigaation haulla")} disabled={!query.trim()}><ArrowOutwardOutlined/></button></MetalFx></form><div className="nav-utilities"><button aria-label={translate("Työkalut")} title={translate("Työkalut")} onClick={()=>setPanel({kind:'nav',title:'Työkalut'})}><BuildOutlined sx={{fontSize:20}}/></button><button aria-label={translate("Asetukset")} title={translate("Asetukset")} onClick={()=>setPanel({kind:'nav',title:'Asetukset'})}><SettingsOutlined sx={{fontSize:20}}/></button></div></header>{translate(<nav id="mobile-main-menu" hidden={!mobileNavOpen} inert={!mobileNavOpen} aria-hidden={!mobileNavOpen} className="mobile-main-menu" aria-label={translate("Mobiilin päävalikko")}><button onClick={showHome}><HomeOutlined/><span>{translate("Etusivu")}</span></button>{translate(nav.map(([label,Icon])=><button key={label} onClick={()=>{setMobileNavOpen(false);dashboardNavigate(label);}}><Icon/><span>{translate(label)}</span></button>))}<span className="mobile-menu-label">{translate("Työkalut")}</span>{translate([['Matchup Lab',CompareArrowsOutlined],['Sim Studio',ViewInArOutlined],['Custom import',FileUploadOutlined],['Datan tila',MonitorHeartOutlined]].map(([label,Icon])=><button key={label} onClick={()=>{setMobileNavOpen(false);dashboardNavigate(label);}}><Icon/><span>{translate(label)}</span></button>))}<button onClick={()=>{setMobileNavOpen(false);setPanel({kind:'nav',title:'Asetukset'});}}><SettingsOutlined/><span>{translate("Asetukset")}</span></button></nav>)}</div><div ref={wrapper} className={`canvas-wrapper ${view==='overview'?'overview-wrapper':''}`} style={{'--scale':scale}}><div className="canvas">

 <section className="match-strip" aria-label={translate("Ottelut")}><div className="league-picker" ref={picker}><button className="season-picker-trigger" aria-label={translate(`Sarja ja kausi: ${leagueName} ${seasonLabel}`)} aria-expanded={seasonMenuOpen} aria-controls="season-menu" onClick={()=>setSeasonMenuOpen(!seasonMenuOpen)}>{translate(leagueId==='women'?<img src={asset('01M4JPC1GF96GGADG4SMGXYE0Y')} alt={translate("Naisten Korisliiga")}/>:<img className="league-logo-color" src="/logos/korisliiga-color.png" alt={translate("Miesten Korisliiga")}/>)}<span className="picker-season">{translate(seasonLabel)}<ChevronRightOutlined aria-hidden="true"/></span></button>{translate(<div id="season-menu" hidden={!seasonMenuOpen} inert={!seasonMenuOpen} aria-hidden={!seasonMenuOpen} className="season-menu"><label>{translate("Sarja")}<select aria-label={translate("Valitse sarja")} value={leagueId} onChange={e=>setLeagueId(e.target.value)}>{translate(Object.entries(leagues).map(([id,name])=><option key={id} value={id}>{translate(name)}</option>))}</select></label><label>{translate("Kausi")}<select aria-label={translate("Valitse kausi")} value={seasonId} onChange={e=>setSeasonId(e.target.value)}>{translate(seasonIds.map(id=><option key={id} value={id}>{translate(id.replace('-','–'))}</option>))}</select></label><p>{translate(season.aggregate.games)}{translate(" tilastoitua ottelua")}{translate(season.updatedAt&&<>{translate(" · Päivitetty ")}{translate(new Date(season.updatedAt).toLocaleDateString(locale()))}</>)}</p><button className="season-picker-done" onClick={()=>setSeasonMenuOpen(false)}>{translate("Valmis")}</button></div>)}</div><div className={`match-frame${scrollState.right?' is-scrollable':''}`}><div className="match-rail" key={railKey} ref={rail} tabIndex={0} onScroll={updateScroll} aria-label={translate("Viimeisimmät tulokset — vieritettävä ottelulista")} onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();move(e.key==='ArrowRight'?1:-1);}}}>{translate(games.map(g=><button className="match-card" key={g.id} title={translate(g.date?new Date(g.date).toLocaleDateString(locale()):undefined)} onPointerEnter={e=>{const edge=rail.current.getBoundingClientRect().right;rail.current.parentElement.classList.toggle('edge-hovered',e.currentTarget.getBoundingClientRect().right>edge+1);}} onPointerLeave={()=>rail.current.parentElement.classList.remove('edge-hovered')} onClick={()=>openMatch(String(g.id))} aria-label={translate(`${g.home} vastaan ${g.away}, ${g.value}`)}><TeamLogo className="home-logo" assetId={logoIds[g.home]} name={g.home}/><span className="match-copy"><span className="match-venue">{translate(g.venue)}</span><span className="match-value">{translate(g.action==='vs'?g.value:g.value.split(/\s*-\s*/).map((score,i,scores)=><span key={i}>{translate(i>0&&<span className="match-score-divider">{translate(" – ")}</span>)}<span className={Number(score)>Number(scores[1-i])?'match-score-winner':Number(score)<Number(scores[1-i])?'match-score-loser':''}>{translate(score)}</span></span>))}</span><span className="match-action">{translate(g.action)}</span></span><TeamLogo className="away-logo" assetId={logoIds[g.away]} name={g.away}/></button>))}</div></div>{translate(scrollState.left&&<button className="rail-arrow rail-prev" aria-label={translate("Edelliset ottelut")} onClick={()=>move(-1)}><ChevronLeftOutlined/></button>)}{translate(scrollState.right&&<button className="rail-arrow rail-next" aria-label={translate("Seuraavat ottelut")} onClick={()=>move(1)}><ChevronRightOutlined/></button>)}</section>
 {translate(view==='overview'?<div className="overview-page"><OverviewDashboard key={`${seasonKey}-${dashboardSection}`} initialSection={dashboardSection} searchQuery={route.searchQuery} onSearch={submitSearch} onSearchRoute={target=>navigate({matchId:undefined,matchPanel:undefined,playerId:undefined,teamId:undefined,...target})} matchId={matchId} matchPanel={route.matchPanel} onMatchTab={name=>navigate({matchPanel:name==='Datan tiedot'?'data':name==='Ottelutilastot'?'players':undefined})} playerId={playerId} teamId={teamId} articleId={route.articleId} onEntityNavigate={openEntity} onOpenMatch={openMatch} expanded onNavigate={dashboardNavigate}/></div>:<section className="hero" aria-labelledby="hero-title"><Dithering className="hero-shader" speed={reduced?0:0.26} shape="warp" type="4x4" size={2} scale={1} colorBack="#00000000" colorFront="#22678F33"/><h1 id="hero-title">{translate("Suomalainen koripallo,")}</h1><div className="hero-subtitle"><DecryptedText key={language} text={translate("datan kautta.")}/></div><p className="hero-description">{translate("Tutki joukkueiden pelitapoja, vertaile pelaajia ja ymmärrä, mistä otteluiden erot syntyvät.")}</p><svg className="player player-left player-nea" viewBox="783 402 370 829" aria-hidden="true"><image href={asset('nea')} width="2048" height="1378"/></svg><img className="player player-right" src={asset('pelaaja')} alt={translate("")}/><form className="hero-search" onSubmit={search}><label htmlFor="search">{translate("Hae joukkueita, pelaajia tai kysy kaudesta")}</label><div className="search-field"><input id="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={translate("Esim. ToPo tai kuka voitti kauden 2025-26?")} autoComplete="off"/><SearchClearButton value={query} onClear={()=>setQuery('')}/><MetalFx variant="circle" preset="chromatic" strength={1} theme="dark" paused={reduced} disableGlow className="query-search-metal"><button className="query-search-submit" aria-label={translate("Hae")} type="submit" disabled={!query.trim()}><ArrowOutwardOutlined sx={{fontSize:17}}/></button></MetalFx></div></form><Suspense fallback={null}><HeroFog reduced={reduced}/></Suspense><div className="dashboard-frame"><OverviewDashboard key={seasonKey} onExpand={showOverview} onNavigate={dashboardNavigate}/></div></section>)}
 </div></div>{translate(view==='home'&&<HomeSections key={seasonKey} onOverview={showOverview} onTeams={()=>showOverview('Joukkueet')} onPlayers={()=>showOverview('Pelaajat')}/>)}{translate(view!=='home'&&<p className="prototype-note">{translate("Erillinen Paper-prototyyppi · ")}{translate(leagueName)} {translate(seasonLabel)}{translate(" · ")}{translate(season.aggregate.games)}{translate(" tilastoitua ottelua")}</p>)}
 <dialog ref={dialog} onClose={()=>setPanel(null)} className="preview-dialog">{translate(displayPanel&&<><header><h2>{translate(displayPanel.title)}</h2><button aria-label={translate("Sulje")} onClick={()=>dialog.current.close()}><CloseOutlined/></button></header>{translate(displayPanel.title==='Asetukset'?<LanguageSettings/>:displayPanel.title==='Työkalut'?<div className="team-results">{['Matchup Lab','Sim Studio','Custom import','Datan tila'].map(label=><p key={label}><a href={routeHref({section:label,leagueId,seasonId})} onClick={e=>{if(e.metaKey||e.ctrlKey)return;e.preventDefault();dialog.current.close();dashboardNavigate(label);}}>{translate(label)}</a></p>)}</div>:displayPanel.kind==='match'?<><p>{translate(displayPanel.game.venue)}{translate(" · ")}{translate(displayPanel.game.value)}</p><p>{translate("Ottelu on valitun kauden tilastoaineistosta. Varsinainen otteluanalyysi liitetään myöhemmin.")}</p></>:<><p className="panel-context">{translate("Prototyypin sisältökokeilu · ")}{translate(leagueName)} {translate(seasonLabel)}{translate(" · ")}{translate(season.aggregate.games)}{translate(" tilastoitua ottelua")}</p>{translate(displayPanel.kind==='search'&&<p>{translate("Haku: ")}{displayPanel.query}</p>)}{translate(displayPanel.kind==='search'||displayPanel.title==='Joukkueet'||displayPanel.title==='Yleiskatsaus'?<>{translate(results.length?<ul className="team-results">{translate(results.map(t=><li key={t.source_team_id}><a href={routeHref({section:'Joukkueet',teamId:slug(t.name),leagueId,seasonId})} onClick={e=>{if(e.metaKey||e.ctrlKey||e.shiftKey)return;e.preventDefault();dialog.current.close();openEntity('Joukkueet',slug(t.name));}}><strong>{translate(t.name)}</strong></a><span>{translate(t.games)}{translate(" ottelua")}</span><span>{translate(t.per_game.points.toLocaleString(locale()))}{translate(" pistettä / ottelu")}</span></li>))}</ul>:<p>{translate("Joukkueosumia ei löytynyt.")}</p>)}</>:<p>{translate("Tämän näkymän sisältö toteutetaan seuraavassa vaiheessa. Nykyinen KorisLab säilyy erillisenä.")}</p>)}</>)}</>)}</dialog></main></SeasonContext.Provider>;
}
