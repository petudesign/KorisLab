import {useId,useMemo,useState} from 'react';
import {useI18n} from './i18n';
import {useMetadata} from './seo';
import {DEFAULT_SEASON} from '../server/seo.mjs';
import {TeamLogo} from './TeamLogo';
import {articles,fiveGamesSections,methodNote,startGroups} from './lib/fiveGamesArticle';
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
   {report.rows.map((r,i)=><g key={`${r.team}-${r.season}`}><circle cx={px(r.margin)} cy={py(r.restWinPct)} r={active===i?6:4.5} className="five-dot"/>
    {(label=>label&&<text x={px(r.margin)+label[2]} y={py(r.restWinPct)+label[3]} textAnchor={label[2]<0||r.margin>15&&label[3]>4?'end':'start'} className="five-label">{r.team} {season(r.season).slice(2)}</text>)(labels.find(l=>l[0]===r.team&&l[1]===r.season))}
    <circle cx={px(r.margin)} cy={py(r.restWinPct)} r="12" className="five-hit" tabIndex={0} onPointerEnter={()=>setActive(i)} onPointerLeave={()=>setActive(null)} onFocus={()=>setActive(i)} onBlur={()=>setActive(null)}><title>{r.team} {season(r.season)}</title></circle></g>)}
  </svg>
  <p className="five-readout" aria-live="polite">{row?<><b>{row.team} {season(row.season)}</b> · {row.wins}–{5-row.wins} · {row.margin>0?'+':''}{format(row.margin)} {say('per ottelu','per game')} → {format(row.restWinPct,0)} % {say(`loppukaudella (${row.restGames} ottelua)`,`in the rest of the season (${row.restGames} games)`)}</>:say('Vie osoitin pisteen päälle tai valitse se näppäimistöllä.','Hover a dot or focus it with the keyboard.')}</p>
 </figure>;
}

function StartsTable(){
 const {language}=useI18n(),say=(fi,en)=>language==='fi'?fi:en,round=rows=>{const v=rows.map(r=>Math.round(r.restWinPct));return `${Math.min(...v)}–${Math.max(...v)} %`;};
 const names={strong:say('Vähintään 4 voittoa viidestä','At least 4 wins of 5'),weak:say('Enintään 1 voitto viidestä','At most 1 win of 5')};
 return <div className="five-table-wrap"><table className="five-table"><caption>{say('Loppukauden voittoprosentit saman alun jälkeen','Rest-of-season win percentages after the same start')}</caption><thead><tr><th scope="col">{say('Alku','Start')}</th><th scope="col">{say('Naiset','Women')}</th><th scope="col">{say('Miehet','Men')}</th></tr></thead><tbody>{startGroups(data).map(g=><tr key={g.key}><th scope="row">{names[g.key]}</th><td>{round(g.women)}<small>{g.women.length} {say('joukkuetta','teams')}</small></td><td>{round(g.men)}<small>{g.men.length} {say('joukkuetta','teams')}</small></td></tr>)}</tbody></table></div>;
}

function StandingsTable({league}){
 const {language}=useI18n(),say=(fi,en)=>language==='fi'?fi:en,report=data[league];
 const date=new Date(report.asOf).toLocaleDateString(language==='fi'?'fi-FI':'en-GB');
 return <div className="five-table-wrap"><table className="five-table five-standings"><caption>{say(`Tilanne ${date}, ${report.games} tilastoitua ottelua`,`As of ${date}, ${report.games} recorded games`)}</caption><thead><tr><th scope="col">{say('Joukkue','Team')}</th><th scope="col">{say('V–H','W–L')}</th><th scope="col">+/−</th><th scope="col">{say('Viime kausi','Last season')}</th></tr></thead><tbody>{report.standings.map(row=><tr key={row.team}><th scope="row"><span className="five-team"><TeamLogo name={row.team} className="five-logo" decorative/>{row.team}</span></th><td>{row.wins}–{row.losses}</td><td>{row.diff>0?'+':row.diff<0?'−':''}{Math.abs(row.diff)}</td><td>{row.lastSeason||say('nousija','promoted')}</td></tr>)}</tbody></table></div>;
}

function ChartData(){
 const {language}=useI18n(),say=(fi,en)=>language==='fi'?fi:en;
 const rows=[...data.women.rows.map(r=>({...r,league:say('Naiset','Women')})),...data.men.rows.map(r=>({...r,league:say('Miehet','Men')}))];
 return <details className="five-data"><summary>{say('Näytä kaavion luvut','Show the chart’s numbers')}</summary><div className="five-table-wrap"><table className="five-table"><thead><tr><th scope="col">{say('Joukkuekausi','Team season')}</th><th scope="col">{say('Sarja','League')}</th><th scope="col">{say('Voitot / 5','Wins / 5')}</th><th scope="col">{say('+/− per ottelu','+/− per game')}</th><th scope="col">{say('V % loppukausi','W % rest')}</th></tr></thead><tbody>{rows.map(r=><tr key={`${r.league}-${r.team}-${r.season}`}><th scope="row">{r.team} {season(r.season)}</th><td>{r.league}</td><td>{r.wins}</td><td>{r.margin>0?'+':''}{r.margin}</td><td>{r.restWinPct}</td></tr>)}</tbody></table></div></details>;
}

function Article({article,listHref,onList}){
 const {language}=useI18n(),say=(fi,en)=>language==='fi'?fi:en,id=useId(),lang=language==='fi'?'fi':'en';
 const sections=fiveGamesSections(data,lang);
 const date=new Date(article.published).toLocaleDateString(language==='fi'?'fi-FI':'en-GB',{day:'numeric',month:'long',year:'numeric'});
 useMetadata(article.title[lang],article.standfirst[lang],{section:'Analyysit',seasonId:DEFAULT_SEASON,leagueId:'women'});
 return <article className="analysis-article" aria-labelledby={id}>
  <a className="analysis-back" href={listHref} onClick={onList}>{say('← Analyysit','← Analysis')}</a>
  <header><h1 id={id}>{article.title[lang]}</h1><p className="analysis-standfirst">{article.standfirst[lang]}</p><p className="analysis-meta">Petteri Helttula · {date}</p></header>
  {sections.map(section=><section key={section.heading}><h2>{section.heading}</h2>
   {section.table==='starts'&&<StartsTable/>}
   {(section.paragraphs||[]).map(text=><p key={text}>{text}</p>)}
   {section.chart&&<><div className="five-charts"><Scatter league="women" title={say('Naiset','Women')} labels={[['Peli-Karhut','2025-26',6,30],['Forssan Alku','2024-25',8,4]]}/><Scatter league="men" title={say('Miehet','Men')} labels={[['Helsinki Seagulls','2024-25',-8,4],['Helsinki Seagulls','2025-26',8,4]]}/></div>
    <p className="five-note">{say('Katkoviiva on 50 % voitoista. Viiva näyttää suunnan: mitä jyrkempi, sitä enemmän alku on kertonut loppukaudesta.','The dashed line is 50% wins. The sloped line shows the direction: the steeper, the more the start has said about the rest.')}</p><ChartData/></>}
   {section.table==='women'&&<StandingsTable league="women"/>}
   {section.table==='men'&&<StandingsTable league="men"/>}
   {section.bullets&&<ul>{section.bullets.map(text=><li key={text}>{text}</li>)}</ul>}
  </section>)}
  <p className="analysis-method">{methodNote[lang]}</p>
 </article>;
}

export default function AnalysisPage({articleId,onNavigate}){
 const {language}=useI18n(),say=(fi,en)=>language==='fi'?fi:en,lang=language==='fi'?'fi':'en';
 const href=slug=>slug?`/analyysit/${slug}/`:'/analyysit/',open=slug=>event=>{if(!event.metaKey&&!event.ctrlKey&&!event.shiftKey){event.preventDefault();onNavigate('Analyysit',slug);}};
 const article=articles.find(item=>item.slug===articleId);
 useMetadata(say('Analyysit','Analysis'),say('KorisLabin analyysit suomalaisesta koripallosta: mitä luvuista voi päätellä ja mitä ei.','KorisLab’s analysis of Finnish basketball: what the numbers can and cannot tell.'),{section:'Analyysit',seasonId:DEFAULT_SEASON,leagueId:'women'},!article);
 if(article)return <Article article={article} listHref={href()} onList={open()}/>;
 return <div className="analysis-list"><h1>{say('Analyysit','Analysis')}</h1>{articles.map(item=><a key={item.slug} className="dash-card analysis-card" href={href(item.slug)} onClick={open(item.slug)}><h2>{item.title[lang]}</h2><p>{item.standfirst[lang]}</p><span>{new Date(item.published).toLocaleDateString(language==='fi'?'fi-FI':'en-GB',{day:'numeric',month:'long',year:'numeric'})}</span></a>)}</div>;
}
