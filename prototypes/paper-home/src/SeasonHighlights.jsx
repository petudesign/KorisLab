import {t as translate,locale} from './i18n';
import { useId, useState } from 'react';
import { useSeason } from './SeasonContext';
import './season-highlights.css';
const format=n=>n.toLocaleString(locale(),{minimumFractionDigits:1,maximumFractionDigits:1});
export function SeasonHighlights({onChooseTeam,selectedTeam}){
 const {data,seasonLabel}=useSeason();
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
  return <button key={item.label} className={`season-highlight ${selectedTeam===team.source_team_id?'highlight-selected':''}`} style={{'--highlight-accent':item.accent}} onClick={()=>onChooseTeam(team)} aria-pressed={selectedTeam===team.source_team_id} aria-label={translate(`${item.label}: ${team.name}, ${format(item.get(team))} ${item.unit}. Näytä joukkueen luvut.`)}><span className="highlight-label">{translate(item.label)}</span><strong className="highlight-value">{translate(format(item.get(team)))}<small>{translate(item.unit)}</small></strong><span className="highlight-team">{translate(team.name)}</span><HighlightTrend games={recent} metric={item.key} average={average}/><span className="highlight-average">{translate("Liigan KA ")}<b>{translate(format(average))}{translate(item.key==='net'?'':'%')}</b></span><span className="highlight-caption">{translate(item.caption)}{translate(" · ")}{translate(team.games)}{translate(" ottelua")}</span></button>;
 }))}</div></section>;
}

export function HighlightTrend({games,metric,average,unit:customUnit}){
 const [active,setActive]=useState(null);
 const gradientId=useId().replace(/:/g,'');
 const tooltipId=useId();
 const selected=active===null?null:games[active];
 const unit=customUnit|| (metric==='net'?'NET':metric==='orb'?'ORB %':'eFG %');
 const values=games.map(game=>game[metric]);
 const available=values.filter(Number.isFinite);
 const hasAverage=Number.isFinite(average);
 const scale=hasAverage?[...available,average]:available;
 const low=Math.min(...scale),high=Math.max(...scale),padding=Math.max((high-low)*.2,2),min=low-padding,max=high+padding;
 const y=value=>68-(value-min)/(max-min)*56;
 const points=games.map((game,i)=>Number.isFinite(game[metric])?{x:games.length===1?128:10+i*236/Math.max(1,games.length-1),y:y(game[metric])}:null);
 // Undefined ratios (e.g. no FT attempts) leave a real gap in the five-game window.
 const segments=[];
 points.forEach(p=>{if(!p){segments.push([]);return;}if(!segments.length)segments.push([]);segments.at(-1).push(p);});
 const paths=segments.filter(segment=>segment.length).map(segment=>({points:segment,path:segment.reduce((line,p,i)=>{if(!i)return `M ${p.x} ${p.y}`;const prev=segment[i-1],before=segment[Math.max(0,i-2)],after=segment[Math.min(segment.length-1,i+1)];return `${line} C ${prev.x+(p.x-before.x)/6} ${prev.y+(p.y-before.y)/6}, ${p.x-(after.x-prev.x)/6} ${p.y-(after.y-prev.y)/6}, ${p.x} ${p.y}`;},'')}));
 return <span className="highlight-trend" onPointerLeave={()=>setActive(null)}><span className="highlight-trend-label">{translate(games.length===1?'Viimeisin ottelu':`Viimeiset ${games.length} ottelua`)} <span>{translate("Vanhemmasta uusimpaan")}</span></span><svg viewBox="0 0 256 80" role="img" aria-label={translate(`Viimeisten ${games.length} ottelun luvut: ${values.map(value=>Number.isFinite(value)?format(value):'ei arvoa').join(', ')}.${hasAverage?` Liigan kausikeskiarvo ${format(average)}.`:''}`)}><defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--highlight-accent)" stopOpacity=".32"/><stop offset="100%" stopColor="var(--highlight-accent)" stopOpacity="0"/></linearGradient></defs>{translate(paths.filter(segment=>segment.points.length>1).map((segment,i)=><path key={i} d={`${segment.path} L ${segment.points.at(-1).x} 80 L ${segment.points[0].x} 80 Z`} fill={`url(#${gradientId})`}/>))} {translate(hasAverage&&<line x1="6" x2="250" y1={y(average)} y2={y(average)} className="highlight-baseline"/>)}{translate(paths.map((segment,i)=><path key={i} d={segment.path} className="highlight-trend-line"/>))}{translate(games.map((game,i)=>points[i]&&<g key={game.id}><circle cx={points[i].x} cy={points[i].y} r={active===i?4:3} className="highlight-trend-dot"/><circle cx={points[i].x} cy={points[i].y} r="11" fill="transparent" className="highlight-trend-target" tabIndex={0} aria-label={translate(`${new Date(game.date).toLocaleDateString(locale())}: ${game.home} ${game.homeScore}–${game.awayScore} ${game.away}, ${format(game[metric])} ${unit}`)} aria-describedby={active===i?tooltipId:undefined} onPointerEnter={()=>setActive(i)} onFocus={()=>setActive(i)} onBlur={()=>setActive(null)} onClick={event=>{event.stopPropagation();setActive(i);}}/></g>))}</svg>{translate(selected&&<span id={tooltipId} role="tooltip" className="highlight-tooltip"><span className="highlight-tooltip-date">{translate(new Date(selected.date).toLocaleDateString(locale()))}</span><span>{translate(selected.home)} <b>{translate(selected.homeScore)}{translate("–")}{translate(selected.awayScore)}</b> {translate(selected.away)}</span><strong>{translate(format(selected[metric]))} <small>{translate(unit)}</small></strong></span>)}</span>;
}
