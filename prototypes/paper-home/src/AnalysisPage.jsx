import {useId,useMemo,useState} from 'react';
import {useI18n} from './i18n';
import {useMetadata} from './seo';
import {DEFAULT_SEASON} from '../server/seo.mjs';
import AddRounded from '@mui/icons-material/AddRounded';
import ArrowUpwardRounded from '@mui/icons-material/ArrowUpwardRounded';
import RemoveRounded from '@mui/icons-material/RemoveRounded';
import {TeamLogo} from './TeamLogo';
import {routeHref,slug} from './routing';
import {articles,fiveGamesBrief,fiveGamesSeason,fiveGamesSections,methodNote,startGroups,teamNote} from './lib/fiveGamesArticle';
import data from '../source/analysis-five-games.json';
import './analysis-page.css';

const X=[-36,36],Y=[0,100],W=440,H=300,M={l:38,r:12,t:22,b:38};
const px=v=>M.l+(v-X[0])/(X[1]-X[0])*(W-M.l-M.r),py=v=>H-M.b-(v-Y[0])/(Y[1]-Y[0])*(H-M.t-M.b);
const fit=rows=>{const mx=rows.reduce((t,r)=>t+r.margin,0)/rows.length,my=rows.reduce((t,r)=>t+r.restWinPct,0)/rows.length,slope=rows.reduce((t,r)=>t+(r.margin-mx)*(r.restWinPct-my),0)/rows.reduce((t,r)=>t+(r.margin-mx)**2,0);return v=>Math.max(0,Math.min(100,my+slope*(v-mx)));};
const season=value=>value.replace('-','–');

function Scatter({league,title,labels}){
 const {language}=useI18n(),say=(fi,en)=>language==='fi'?fi:en,report=data[league],[active,setActive]=useState(null);
 const line=useMemo(()=>fit(report.rows),[report]),format=(v,d=1)=>v.toLocaleString(language==='fi'?'fi-FI':'en-GB',{minimumFractionDigits:d,maximumFractionDigits:d});
 const row=active==null?null:report.rows[active];
 return <figure className="five-chart"><figcaption><strong>{title}</strong><span>{say(`Korrelaatio ${format(report.corrMargin,2)}, ${report.teamSeasons} joukkuekautta`,`Correlation ${format(report.corrMargin,2)}, ${report.teamSeasons} team seasons`)}</span></figcaption>
  <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={say(`${title}: viiden ensimmäisen ottelun piste-ero ja loppukauden voittoprosentti. Luvut taulukossa kaavion alla.`,`${title}: point difference over the first five games and rest-of-season win percentage. Values in the table below the chart.`)}>
   {[0,25,50,75,100].map(v=><g key={v}><line x1={M.l} x2={W-M.r} y1={py(v)} y2={py(v)} className={v===50?'five-grid five-grid-mid':'five-grid'}/><text x={M.l-8} y={py(v)+4} textAnchor="end">{v}</text></g>)}
   {[-30,-15,0,15,30].map(v=><text key={v} x={px(v)} y={H-M.b+17} textAnchor="middle">{v>0?'+':''}{v}</text>)}
   <text x={(M.l+W-M.r)/2} y={H-4} textAnchor="middle">{say('Piste-ero per ottelu, viisi ensimmäistä','Point difference per game, first five')}</text>
   <text x={M.l-30} y={10}>{say('Voitto-% loppukaudella','Win % in the rest of the season')}</text>
   <line x1={px(X[0])} x2={px(X[1])} y1={py(line(X[0]))} y2={py(line(X[1]))} className="five-trend"/>
   {report.rows.map((r,i)=><g key={`${r.team}-${r.season}`}><circle cx={px(r.margin)} cy={py(r.restWinPct)} r={active===i?6:4.5} className="five-dot" data-league={league}/>
    {(label=>label&&<text x={px(r.margin)+label[2]} y={py(r.restWinPct)+label[3]} textAnchor={label[2]<0||r.margin>15&&label[3]>4?'end':'start'} className="five-label">{r.team} {season(r.season).slice(2)}</text>)(labels.find(l=>l[0]===r.team&&l[1]===r.season))}
    <circle cx={px(r.margin)} cy={py(r.restWinPct)} r="12" className="five-hit" tabIndex={0} onPointerEnter={()=>setActive(i)} onPointerLeave={()=>setActive(null)} onFocus={()=>setActive(i)} onBlur={()=>setActive(null)}><title>{r.team} {season(r.season)}</title></circle></g>)}
  </svg>
  <p className="five-readout" aria-live="polite">{row?<><b>{row.team} {season(row.season)}</b> · {row.wins}–{5-row.wins} · {row.margin>0?'+':''}{format(row.margin)} {say('per ottelu','per game')} → {format(row.restWinPct,0)} % {say(`loppukaudella (${row.restGames} ottelua)`,`in the rest of the season (${row.restGames} games)`)}</>:say('Vie osoitin pisteen päälle tai valitse se näppäimistöllä.','Hover a dot or focus it with the keyboard.')}</p>
 </figure>;
}

const fmt=(language,v,d=1)=>v.toLocaleString(language==='fi'?'fi-FI':'en-GB',{minimumFractionDigits:d,maximumFractionDigits:d});
const signed=(language,v)=>`${v>0?'+':v<0?'−':''}${fmt(language,Math.abs(v),0)}`;

// Every team season as a dot on the same 0–100 line: the width of each group is the point.
function StartsChart(){
 const {language}=useI18n(),say=(fi,en)=>language==='fi'?fi:en,[active,setActive]=useState(null);
 const names={strong:say('Vähintään 4 voittoa viidestä','At least 4 wins of 5'),weak:say('Enintään 1 voitto viidestä','At most 1 win of 5')};
 const range=rows=>{const v=rows.map(r=>Math.round(r.restWinPct));return `${Math.min(...v)}–${Math.max(...v)} %`;};
 return <figure className="five-starts">
  <div className="five-legend"><span data-league="women"><i/>{say('Naiset','Women')}</span><span data-league="men"><i/>{say('Miehet','Men')}</span><small>{say('Piste = joukkuekausi. Vaaka-akselilla voitto-% loppukaudella.','Dot = team season. Horizontal axis: win % in the rest of the season.')}</small></div>
  {startGroups(data).map(group=><div className="five-start-group" key={group.key}><h3>{names[group.key]}</h3>{['women','men'].map(league=><div className="five-strip" key={league} data-league={league}><span className="five-strip-name">{league==='women'?say('Naiset','Women'):say('Miehet','Men')}</span><div className="five-strip-track"><i className="five-strip-mid"/><b className="five-strip-range" style={{left:`${Math.min(...group[league].map(r=>r.restWinPct))}%`,width:`${Math.max(...group[league].map(r=>r.restWinPct))-Math.min(...group[league].map(r=>r.restWinPct))}%`}}/>{group[league].map(r=><button type="button" key={`${r.team}-${r.season}`} style={{left:`${r.restWinPct}%`}} aria-label={`${r.team} ${season(r.season)}: ${fmt(language,r.restWinPct,0)} %`} onPointerEnter={()=>setActive(r)} onPointerLeave={()=>setActive(null)} onFocus={()=>setActive(r)} onBlur={()=>setActive(null)}/>)}</div><strong>{range(group[league])}</strong></div>)}</div>)}
  <div className="five-strip-axis"><span>0 %</span><span>50 %</span><span>100 %</span></div>
  <p className="five-readout" aria-live="polite">{active?<><b>{active.team} {season(active.season)}</b> · {active.wins}–{5-active.wins} · {fmt(language,active.restWinPct,0)} % {say(`loppukaudella (${active.restGames} ottelua)`,`in the rest of the season (${active.restGames} games)`)}</>:say('Vie osoitin pisteen päälle nähdäksesi joukkueen.','Hover a dot to see the team.')}</p>
 </figure>;
}

// How much the first N games have said about the rest, for both leagues on one axis.
function LengthChart(){
 const {language}=useI18n(),say=(fi,en)=>language==='fi'?fi:en,w=440,h=210,m={l:34,r:64,t:14,b:36};
 const points=Object.keys(data.women.seasonLength.corrAt).map(Number),x=v=>m.l+(v-3)/7*(w-m.l-m.r),y=v=>h-m.b-v*(h-m.t-m.b);
 const line=league=>points.map(p=>`${x(p)},${y(data[league].seasonLength.corrAt[p])}`).join(' ');
 return <figure className="five-length"><svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={say('Korrelaatio ensimmäisten otteluiden määrän mukaan. Naisilla noin 0,8 kaikilla määrillä, miehillä 0,28–0,39.','Correlation by number of first games. About 0.8 for women at every length, 0.28–0.39 for men.')}>
   {[0,.25,.5,.75,1].map(v=><g key={v}><line x1={m.l} x2={w-m.r} y1={y(v)} y2={y(v)} className="five-grid"/><text x={m.l-8} y={y(v)+4} textAnchor="end">{fmt(language,v,2)}</text></g>)}
   {points.map(p=><text key={p} x={x(p)} y={h-m.b+17} textAnchor="middle">{p}</text>)}
   <text x={(m.l+w-m.r)/2} y={h-4} textAnchor="middle">{say('Ensimmäisiä otteluita','First games')}</text>
   {['women','men'].map(league=><g key={league} data-league={league} className="five-length-series"><polyline points={line(league)}/>{points.map(p=><circle key={p} cx={x(p)} cy={y(data[league].seasonLength.corrAt[p])} r="4"><title>{`${league==='women'?say('Naiset','Women'):say('Miehet','Men')}, ${p}: ${fmt(language,data[league].seasonLength.corrAt[p],2)}`}</title></circle>)}<text x={x(10)+9} y={y(data[league].seasonLength.corrAt[10])+4} className="five-label">{league==='women'?say('Naiset','Women'):say('Miehet','Men')}</text></g>)}
  </svg></figure>;
}

// One bar per game, in order: a single blowout or two narrow losses show up without reading a number.
// Pixels per point are shared by every team, so bars compare across rows; each row is only as tall as its own games need.
const BAR_SCALE=0.7,BAR_LABEL=14;
function GameBars({games,league}){
 const {language}=useI18n(),say=(fi,en)=>language==='fi'?fi:en;
 const up=Math.max(0,...games.map(g=>g.margin)),down=Math.max(0,...games.map(g=>-g.margin));
 return <div className="five-bars" data-league={league} role="img" aria-label={say(`Piste-ero otteluittain: ${games.map(g=>signed(language,g.margin)).join(', ')}`,`Point difference by game: ${games.map(g=>signed(language,g.margin)).join(', ')}`)}>{games.map((g,i)=><div className="five-bar" key={i} title={`${g.opponent} ${signed(language,g.margin)}`}><span className="five-bar-up" style={{height:up*BAR_SCALE+BAR_LABEL}}>{g.margin>0&&<><small>{signed(language,g.margin)}</small><i style={{height:g.margin*BAR_SCALE}}/></>}</span>{down>0&&<span className="five-bar-down" style={{height:down*BAR_SCALE+BAR_LABEL}}>{g.margin<0&&<><i style={{height:-g.margin*BAR_SCALE}}/><small>{signed(language,g.margin)}</small></>}</span>}</div>)}</div>;
}

// The article is read from either league's scope, so each link names its own league.
function TeamLink({team,league,onNavigate,className,children}){
 const teamId=slug(team);
 return <a className={className} href={routeHref({section:'Joukkueet',leagueId:league,seasonId:fiveGamesSeason,teamId})} onClick={event=>{if(!event.metaKey&&!event.ctrlKey&&!event.shiftKey){event.preventDefault();onNavigate('Joukkueet',teamId,fiveGamesSeason,league);}}}>{children||team}</a>;
}

function ResultRows({league,onNavigate}){
 const {language}=useI18n(),lang=language==='fi'?'fi':'en',report=data[league];
 return <div className="five-rows">{report.changes.map(row=>{const standing=report.standings.find(item=>item.team===row.team);return <article className="five-row" key={row.team}><header><TeamLogo name={row.team} className="five-logo" decorative/><div><h3><TeamLink team={row.team} league={league} onNavigate={onNavigate}/></h3><p>{standing.wins}–{standing.losses}<span>{signed(language,standing.diff)}</span></p></div></header><p className="five-row-note">{teamNote(row.team,'result',lang)}</p><GameBars games={row.games} league={league}/></article>;})}</div>;
}

function FullStandings({league,onNavigate}){
 const {language}=useI18n(),say=(fi,en)=>language==='fi'?fi:en,report=data[league];
 const date=new Date(report.asOf).toLocaleDateString(language==='fi'?'fi-FI':'en-GB');
 return <details className="five-data"><summary>{say('Koko sarjataulukko','Full standings')}</summary><div className="five-table-wrap"><table className="five-table five-standings"><caption>{say(`Tilanne ${date}, ${report.games} tilastoitua ottelua`,`As of ${date}, ${report.games} recorded games`)}</caption><thead><tr><th scope="col">{say('Joukkue','Team')}</th><th scope="col">{say('V–H','W–L')}</th><th scope="col">+/−</th><th scope="col">{say('Viime kausi','Last season')}</th></tr></thead><tbody>{report.standings.map(row=><tr key={row.team}><th scope="row"><TeamLink team={row.team} league={league} onNavigate={onNavigate} className="five-team"><TeamLogo name={row.team} className="five-logo" decorative/>{row.team}</TeamLink></th><td>{row.wins}–{row.losses}</td><td>{signed(language,row.diff)}</td><td>{row.lastSeason||say('nousija','promoted')}</td></tr>)}</tbody></table></div></details>;
}

// Right is always better, so defence runs the other way. Each metric keeps one scale across all cards.
const SCALES=[['offensive_rating',{fi:'Hyökkäys',en:'Offence'},[75,125]],['defensive_rating',{fi:'Puolustus',en:'Defence'},[110,70]],['efg_pct',{fi:'Heitot (eFG %)',en:'Shots (eFG %)'},[38,60]]];
function ChangeBar({label,scale,now,last,language}){
 const at=v=>Math.max(0,Math.min(100,(v-scale[0])/(scale[1]-scale[0])*100));
 return <div className="five-change"><span>{label}</span><div className="five-change-track">{last!=null&&<b style={{left:`${Math.min(at(last),at(now))}%`,width:`${Math.abs(at(now)-at(last))}%`}}/>}{last!=null&&<i className="is-last" style={{left:`${at(last)}%`}}/>}<i style={{left:`${at(now)}%`}}/></div><strong>{last!=null&&<small>{fmt(language,last)} →</small>}{fmt(language,now)}</strong></div>;
}
// Three kinds of roster news, told apart by symbol, label and colour so a card can be scanned without reading it all.
function PlayerChips({kind,title,items}){
 const Icon={arrived:AddRounded,grew:ArrowUpwardRounded,absent:RemoveRounded}[kind];
 return items.length>0&&<div className="five-chips" data-kind={kind}><h4><Icon aria-hidden="true"/>{title}</h4><ul>{items.map(item=><li key={item}>{item}</li>)}</ul></div>;
}
function ChangeCards({onNavigate}){
 const {language}=useI18n(),say=(fi,en)=>language==='fi'?fi:en,lang=language==='fi'?'fi':'en';
 const rows=[...data.women.changes.map(row=>({...row,league:'women'})),...data.men.changes.map(row=>({...row,league:'men'}))];
 const teamName=name=>name==='Tampereen Pyrintö'?'Pyrintö':name==='Tapiolan Honka'?'Honka':name==='Espoo Basket Team'?'EBT':name==='HBA-Märsky'?'Märsky':name==='Salon Vilpas'?'Vilpas':name==='Kipinä Basket'?'Kipinä':name==='KTP-Basket'?'KTP':name==='Lahti Basketball'?'Lahti':name;
 return <>
  <div className="five-legend five-change-legend"><span><i className="is-last"/>{say('Viime kausi','Last season')}</span><span><i/>{say('Nyt','Now')}</span><small>{say('Oikealle on parempi. Hyökkäys ja puolustus: pisteet / 100 hallintaa. PPG: pisteitä ottelussa, poissa olevilla viime kaudelta.','Right is better. Offence and defence: points per 100 possessions. PPG: points per game, from last season for players not playing.')}</small></div>
  <div className="five-cards five-cards-wide">{rows.map(row=><article className="five-card" key={row.team} data-league={row.league}><header><TeamLogo name={row.team} className="five-logo" decorative/><h3><TeamLink team={row.team} league={row.league} onNavigate={onNavigate}/></h3>{row.returningShare!=null?<p className="five-returning">{row.returningShare} %<span>{say('minuuteista viime kauden pelaajilta','of minutes from last season’s players')}</span></p>:<p className="five-returning">{say('Nousija','Promoted')}</p>}</header>
    {SCALES.map(([key,label,scale])=><ChangeBar key={key} label={label[lang]} scale={scale} now={row.now[key]} last={row.last?.[key]} language={language}/>)}
    <p className="five-card-note">{teamNote(row.team,'change',lang)}</p>
    <PlayerChips kind="arrived" title={say('Uudet','New')} items={row.arrivals.filter(p=>p.ppg>=8).map(p=>`${p.name} ${fmt(language,p.ppg)} PPG${p.from?` (${say('ennen','from')} ${teamName(p.from)})`:''}`)}/>
    <PlayerChips kind="grew" title={say('Kasvanut rooli','Bigger role')} items={(row.risers||[]).map(p=>`${p.name} ${fmt(language,p.from)} → ${fmt(language,p.to)} PPG`)}/>
    <PlayerChips kind="absent" title={say('Ei pelannut joukkueessa tällä kaudella','Has not played for the team this season')} items={(row.absent||[]).filter(p=>p.ppg>=8).map(p=>`${p.name} ${fmt(language,p.ppg)} PPG${p.now?` (${say('nyt','now')} ${teamName(p.now)})`:''}`)}/>
   </article>)}</div>
 </>;
}

function ChartData(){
 const {language}=useI18n(),say=(fi,en)=>language==='fi'?fi:en;
 const rows=[...data.women.rows.map(r=>({...r,league:say('Naiset','Women')})),...data.men.rows.map(r=>({...r,league:say('Miehet','Men')}))];
 return <details className="five-data"><summary>{say('Näytä kaavion luvut','Show the chart’s numbers')}</summary><div className="five-table-wrap"><table className="five-table"><thead><tr><th scope="col">{say('Joukkuekausi','Team season')}</th><th scope="col">{say('Sarja','League')}</th><th scope="col">{say('Voitot / 5','Wins / 5')}</th><th scope="col">{say('+/− per ottelu','+/− per game')}</th><th scope="col">{say('V % loppukausi','W % rest')}</th></tr></thead><tbody>{rows.map(r=><tr key={`${r.league}-${r.team}-${r.season}`}><th scope="row">{r.team} {season(r.season)}</th><td>{r.league}</td><td>{r.wins}</td><td>{r.margin>0?'+':''}{r.margin}</td><td>{r.restWinPct}</td></tr>)}</tbody></table></div></details>;
}

function Article({article,listHref,onList,onNavigate}){
 const {language}=useI18n(),say=(fi,en)=>language==='fi'?fi:en,id=useId(),lang=language==='fi'?'fi':'en';
 const sections=fiveGamesSections(data,lang);
 const date=new Date(article.published).toLocaleDateString(language==='fi'?'fi-FI':'en-GB',{day:'numeric',month:'long',year:'numeric'});
 useMetadata(article.title[lang],article.standfirst[lang],{section:'Analyysit',seasonId:DEFAULT_SEASON,leagueId:'women'});
 return <article className="analysis-article" aria-labelledby={id}>
  <nav className="analysis-crumbs" aria-label={say('Murupolku','Breadcrumb')}><ol><li><a href={listHref} onClick={onList}>{say('Analyysit','Analysis')}</a></li><li aria-current="page">{article.title[lang]}</li></ol></nav>
  <header><h1 id={id}>{article.title[lang]}</h1><p className="analysis-standfirst">{article.standfirst[lang]}</p><p className="analysis-meta">Petteri Helttula · {date}</p></header>
  <section className="analysis-brief"><h2>{say('Lyhyesti','In brief')}</h2><ul>{fiveGamesBrief(lang).map(([title,text])=><li key={title}><strong>{title}.</strong> {text}</li>)}</ul></section>
  {sections.map(section=><section key={section.heading}><h2>{section.heading}</h2>
   {(section.paragraphs||[]).map(text=><p key={text}>{text}</p>)}
   {section.chart==='scatter'&&<><div className="five-charts"><Scatter league="women" title={say('Naiset','Women')} labels={[['Peli-Karhut','2025-26',6,30],['Forssan Alku','2024-25',8,4]]}/><Scatter league="men" title={say('Miehet','Men')} labels={[['Helsinki Seagulls','2024-25',-8,4],['Helsinki Seagulls','2025-26',8,4]]}/></div>
    <p className="five-note">{say('Katkoviiva on 50 % voitoista. Viiva näyttää suunnan: mitä jyrkempi, sitä enemmän alku on kertonut loppukaudesta.','The dashed line is 50% wins. The sloped line shows the direction: the steeper, the more the start has said about the rest.')}</p><ChartData/></>}
   {section.chart==='starts'&&<StartsChart/>}
   {section.chart==='length'&&<LengthChart/>}
   {section.results&&<><ResultRows league={section.results} onNavigate={onNavigate}/><FullStandings league={section.results} onNavigate={onNavigate}/></>}
   {section.changes&&<ChangeCards onNavigate={onNavigate}/>}
   {(section.after||[]).map(text=><p className="analysis-after" key={text}>{text}</p>)}
   {section.conclusions&&<div className="five-conclusions">{section.conclusions.map(([title,text])=><div key={title}><h3>{title}</h3><p>{text}</p></div>)}</div>}
  </section>)}
  <p className="analysis-method">{methodNote[lang]}</p>
 </article>;
}

export default function AnalysisPage({articleId,onNavigate}){
 const {language}=useI18n(),say=(fi,en)=>language==='fi'?fi:en,lang=language==='fi'?'fi':'en';
 const href=slug=>slug?`/analysis/${slug}/`:'/analysis/',open=slug=>event=>{if(!event.metaKey&&!event.ctrlKey&&!event.shiftKey){event.preventDefault();onNavigate('Analyysit',slug);}};
 const article=articles.find(item=>item.slug===articleId);
 useMetadata(say('Analyysit','Analysis'),say('KorisLabin analyysit suomalaisesta koripallosta: mitä luvuista voi päätellä ja mitä ei.','KorisLab’s analysis of Finnish basketball: what the numbers can and cannot tell.'),{section:'Analyysit',seasonId:DEFAULT_SEASON,leagueId:'women'},!article);
 if(article)return <Article article={article} listHref={href()} onList={open()} onNavigate={onNavigate}/>;
 return <div className="analysis-list"><h1>{say('Analyysit','Analysis')}</h1>{articles.map(item=><a key={item.slug} className="dash-card analysis-card" href={href(item.slug)} onClick={open(item.slug)}><h2>{item.title[lang]}</h2><p>{item.standfirst[lang]}</p><span>{new Date(item.published).toLocaleDateString(language==='fi'?'fi-FI':'en-GB',{day:'numeric',month:'long',year:'numeric'})}</span></a>)}</div>;
}
