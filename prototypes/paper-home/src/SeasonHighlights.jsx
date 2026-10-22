import {t as translate,locale} from './i18n';
import { useId, useState } from 'react';
import { useSeason } from './SeasonContext';
import {routeHref,slug} from './routing';
import './season-highlights.css';
const format=n=>n.toLocaleString(locale(),{minimumFractionDigits:1,maximumFractionDigits:1});
export function SeasonHighlights({onChooseTeam,selectedTeam,onEntityNavigate}){
 const {data,seasonLabel,leagueId,seasonId}=useSeason();
 const teams=data.aggregate.teams.filter(team=>team.games>0);
 const definitions=[
  {key:'orb',label:'Parhaat hyökkäyslevypallot',unit:'ORB %',get:t=>t.metrics.offensive_rebound_pct,accent:'#df945b',caption:'Osuus hyökkäyspään levypalloista'},
  {key:'efg',label:'Tehokkaimmat heitot',unit:'eFG %',get:t=>t.metrics.efg_pct,accent:'#44d17a',caption:'Kolmosten lisäarvo huomioitu'},
  {key:'net',label:'Paras nettotehokkuus',unit:'NET',get:t=>t.metrics.net_rating,accent:'#91b4c8',caption:'Piste-ero / 100 pallonhallintaa'},
 ];
 return <section className="season-highlights" aria-label={translate("Kauden nostot")}><header><h3>{translate("Kauden nostot")}</h3><span>{translate(seasonLabel)}{translate(" · ")}{translate(data.aggregate.games)}{translate(" tilastoitua ottelua")}</span></header><div className="season-highlight-grid">{translate(definitions.map(item=>{
  const team=[...teams].sort((a,b)=>item.get(b)-item.get(a))[0];
  if(!team)return null;
  const recent=(data.highlightTrends[team.source_team_id]||[]).filter(game=>Number.isFinite(game[item.key]));
  const average=data.highlightLeagueAverages[item.key];
  const teamSlug=slug(team.name),href=routeHref({section:'Joukkueet',leagueId,seasonId,teamId:teamSlug});
  return <article key={item.label} className={`season-highlight ${selectedTeam===team.source_team_id?'highlight-selected':''}`} style={{'--highlight-accent':item.accent}}><span className="highlight-label">{translate(item.label)}</span><strong className="highlight-value">{translate(format(item.get(team)))}<small>{translate(item.unit)}</small></strong><a className="highlight-team" href={href} onClick={event=>{if(onEntityNavigate&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey){event.preventDefault();onEntityNavigate('Joukkueet',teamSlug,seasonId);}}}>{translate(team.name)}</a><HighlightTrend games={recent} metric={item.key} average={average}/><span className="highlight-average">{translate("Liigan KA ")}<b>{translate(format(average))}{translate(item.key==='net'?'':'%')}</b></span><span className="highlight-caption">{translate(item.caption)}{translate(" · ")}{translate(team.games)}{translate(" ottelua")}</span><button type="button" className="highlight-compare-button" onClick={()=>onChooseTeam(team)} aria-pressed={selectedTeam===team.source_team_id}>{translate(selectedTeam===team.source_team_id?'Valittu vertailuun':'Näytä vertailussa')}</button></article>;
 }))}</div></section>;
}

// Monotone cubic tangents (as d3.curveMonotoneX): rounded corners, but flat between equal values and never past a point.
function monotoneSlope(points,i){
 const secant=j=>(points[j+1].y-points[j].y)/(points[j+1].x-points[j].x);
 if(points.length<2)return 0;
 if(i===0||i===points.length-1){
  const j=i===0?0:i-1,inner=points.length>2?monotoneSlope(points,i===0?1:i-1):secant(j);
  const end=(3*secant(j)-inner)/2;
  return Math.sign(end)!==Math.sign(secant(j))?0:Math.abs(end)>3*Math.abs(secant(j))?3*secant(j):end;
 }
 const s0=secant(i-1),s1=secant(i);
 if(s0*s1<=0)return 0;
 const h0=points[i].x-points[i-1].x,h1=points[i+1].x-points[i].x,blend=(s0*h1+s1*h0)/(h0+h1);
 return Math.sign(s0)*Math.min(Math.abs(s0),Math.abs(s1),Math.abs(blend)/2)*2;
}

export function HighlightTrend({games,metric,average,unit:customUnit,zeroBaseline=false}){
 const [active,setActive]=useState(null);
 const gradientId=useId().replace(/:/g,'');
 const tooltipId=useId();
 const selected=active===null?null:games[active];
 const unit=customUnit|| (metric==='net'?'NET':metric==='orb'?'ORB %':'eFG %');
 const values=games.map(game=>game[metric]);
 const available=values.filter(Number.isFinite);
 const hasAverage=Number.isFinite(average);
 const scale=hasAverage?[...available,average]:available;
 const low=Math.min(...scale),high=Math.max(...scale),padding=Math.max((high-low)*.2,2);
 // Counting stats sit on a zero floor so a scoreless game reads as zero, not as a dip in a zoomed range.
 const anchored=zeroBaseline&&low>=0,min=anchored?0:low-padding,max=anchored?Math.max(high*1.15,1):high+padding;
 const y=value=>68-(value-min)/(max-min)*56;
 const x=i=>games.length===1?128:10+i*236/Math.max(1,games.length-1);
 // On a zero floor a game with no attempts drops the line to the floor and is marked with an X; elsewhere it stays a gap.
 const points=games.map((game,i)=>Number.isFinite(game[metric])?{x:x(i),y:y(game[metric])}:anchored?{x:x(i),y:y(0)}:null);
 const missingY=40;
 // Undefined ratios (e.g. no FT attempts) leave a real gap in the five-game window.
 const segments=[];
 points.forEach(p=>{if(!p){segments.push([]);return;}if(!segments.length)segments.push([]);segments.at(-1).push(p);});
 const paths=segments.filter(segment=>segment.length).map(segment=>({points:segment,path:segment.reduce((line,p,i)=>{if(!i)return `M ${p.x} ${p.y}`;if(zeroBaseline){const [m0,m1]=[monotoneSlope(segment,i-1),monotoneSlope(segment,i)],prev=segment[i-1],third=(p.x-prev.x)/3;return `${line} C ${prev.x+third} ${prev.y+third*m0}, ${p.x-third} ${p.y-third*m1}, ${p.x} ${p.y}`;}const prev=segment[i-1],before=segment[Math.max(0,i-2)],after=segment[Math.min(segment.length-1,i+1)];return `${line} C ${prev.x+(p.x-before.x)/6} ${prev.y+(p.y-before.y)/6}, ${p.x-(after.x-prev.x)/6} ${p.y-(after.y-prev.y)/6}, ${p.x} ${p.y}`;},'')}));
 const gameLabel=(game,value)=>`${new Date(game.date).toLocaleDateString(locale())}: ${game.home} ${game.homeScore}–${game.awayScore} ${game.away}, ${Number.isFinite(value)?`${format(value)} ${unit}`:'ei arvoa'}`;
 return <span className="highlight-trend" onPointerLeave={()=>setActive(null)}><span className="highlight-trend-label">{translate(games.length===1?'Viimeisin ottelu':`Viimeiset ${games.length} ottelua`)} <span>{translate("Vanhemmasta uusimpaan")}</span></span><svg viewBox="0 0 256 80" role="img" aria-label={translate(`Viimeisten ${games.length} ottelun luvut: ${values.map(value=>Number.isFinite(value)?format(value):'ei arvoa').join(', ')}.${hasAverage?` Liigan kausikeskiarvo ${format(average)}.`:''}`)}><defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--highlight-accent)" stopOpacity=".32"/><stop offset="100%" stopColor="var(--highlight-accent)" stopOpacity="0"/></linearGradient></defs>{translate(paths.map((segment,i)=>segment.points.length>1?<path key={i} d={`${segment.path} L ${segment.points.at(-1).x} 80 L ${segment.points[0].x} 80 Z`} fill={`url(#${gradientId})`}/>:<rect key={i} x={segment.points[0].x-9} y={segment.points[0].y} width="18" height={80-segment.points[0].y} fill={`url(#${gradientId})`}/>))} {anchored&&<line x1="6" x2="250" y1={y(0)} y2={y(0)} className="highlight-zero-line"/>}{translate(hasAverage&&<line x1="6" x2="250" y1={y(average)} y2={y(average)} className="highlight-baseline"/>)}{translate(paths.map((segment,i)=><path key={i} d={segment.path} className="highlight-trend-line"/>))}{translate(games.map((game,i)=>{const point=points[i]||{x:x(i),y:missingY},missing=!Number.isFinite(game[metric]),size=active===i?4.5:3.5;return <g key={game.id}>{missing?points[i]?<path d={`M ${point.x-size} ${point.y-size} L ${point.x+size} ${point.y+size} M ${point.x+size} ${point.y-size} L ${point.x-size} ${point.y+size}`} className="highlight-trend-x"/>:<line x1={point.x} x2={point.x} y1="12" y2="68" className={`highlight-trend-missing${active===i?' active':''}`}/>:<circle cx={point.x} cy={point.y} r={active===i?4:3} className="highlight-trend-dot"/>}<circle cx={point.x} cy={point.y} r="11" fill="transparent" className="highlight-trend-target" tabIndex={0} aria-label={translate(gameLabel(game,game[metric]))} aria-describedby={active===i?tooltipId:undefined} onPointerEnter={()=>setActive(i)} onFocus={()=>setActive(i)} onBlur={()=>setActive(null)} onClick={event=>{event.stopPropagation();setActive(i);}}/></g>;}))}</svg>{translate(selected&&<span id={tooltipId} role="tooltip" className="highlight-tooltip"><span className="highlight-tooltip-date">{translate(new Date(selected.date).toLocaleDateString(locale()))}</span><span>{translate(selected.home)} <b>{translate(selected.homeScore)}{translate("–")}{translate(selected.awayScore)}</b> {translate(selected.away)}</span>{Number.isFinite(selected[metric])?<strong>{translate(format(selected[metric]))} <small>{translate(unit)}</small></strong>:<small>{translate('Ei laskettavaa arvoa tästä ottelusta (esim. ei yrityksiä)')}</small>}</span>)}</span>;
}
