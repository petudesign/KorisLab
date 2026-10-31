import {t as translate,locale} from './i18n';
import {useState} from 'react';
import {TeamLogo} from './TeamLogo';
import {HighlightTrend} from './SeasonHighlights';
import {useSeason} from './SeasonContext';
import {resourceInfoForSeason} from './lib/teamResources';
import {teamSeasonInfo} from './lib/teamSeasonInfo';
import {TeamResourceComparison} from './TeamResourceComparison';
import {seasonTeams,teamSeasonSummary,teamRecentMetrics} from './lib/teamProfiles';
import teamLogos from '../source/team-logos.json';
import {slug,routeHref} from './routing';
import './team-profiles.css';
import {useTableSort,TableSortMenu} from './TableSort';
const fmt=n=>Number.isFinite(n)?n.toLocaleString(locale(),{minimumFractionDigits:1,maximumFractionDigits:1}):'—';
const signed=n=>Number.isFinite(n)?`${n>0?'+':''}${fmt(n)}`:'—';
function Mark({name}){return <span className="team-profile-mark"><TeamLogo name={name}/></span>;}
function Form({recent}){return <span className="team-form" aria-label={translate("Viimeiset ottelut, vanhemmasta uusimpaan")}>{translate(recent.length?recent.map(g=><span key={g.id} className={g.won?'won':'lost'} title={translate(`${new Date(g.date).toLocaleDateString(locale())} · ${g.opponent} · ${g.score}`)} aria-label={translate(`${g.opponent}, ${g.score}, ${g.won?'voitto':'tappio'}`)}>{translate(g.won?'V':'H')}</span>):<small>{translate("Ei tilastoituja otteluita")}</small>)}</span>;}
export function TeamDirectory({season,games,link}){
 const [query,setQuery]=useState(''),[view,setView]=useState('profiles');
 const {leagueId,seasonId}=useSeason(),seasonInfo=resourceInfoForSeason(teamSeasonInfo[leagueId],seasonId,seasonTeams(season,games).map(team=>team.name));
 const activeView=seasonInfo?view:'profiles';
 const columns=[{key:'name',label:'Nimi',text:true,value:t=>t.name},{key:'wins',label:'Voitot',value:t=>teamSeasonSummary(games,t.name).wins},{key:'points',label:'Pisteet / ottelu',value:t=>teamSeasonSummary(games,t.name).pointsPerGame},{key:'net',label:'Nettotehokkuus',value:t=>t.metrics.net_rating},{key:'efg',label:'eFG %',value:t=>t.metrics.efg_pct}];
 const sorting=useTableSort(columns,'name','asc');
 const teams=sorting.rows(seasonTeams(season,games).filter(t=>t.name.toLocaleLowerCase('fi').includes(query.toLocaleLowerCase('fi'))));
 return <div className="team-directory"><h3 className="team-directory-title">{translate("Joukkueet tarkemmin")}</h3>{seasonInfo&&<div className="team-directory-views" aria-label={translate("Joukkueiden näkymä")}><button aria-pressed={activeView==='profiles'} onClick={()=>setView('profiles')}>{translate("Joukkueprofiilit")}</button><button aria-pressed={activeView==='resources'} onClick={()=>setView('resources')}>{translate("Resurssit")}</button></div>}{activeView==='resources'?<TeamResourceComparison seasonInfo={seasonInfo} games={games} leagueId={leagueId} seasonId={seasonId}/>:<><div className="team-directory-filter"><label>{translate("Hae joukkuetta")}<input placeholder={translate("Joukkueen nimi")} enterKeyHint="done" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} value={query} onChange={e=>setQuery(e.target.value)}/></label><TableSortMenu columns={columns} sorting={sorting} label="Joukkueiden järjestys"/><span>{translate(teams.length)}{translate(" joukkuetta")}</span></div><div className="team-profile-grid">{translate(teams.map(team=>{const s=teamSeasonSummary(games,team.name);return <article className="dash-card team-profile-card" key={team.source_team_id}><header><Mark name={team.name}/><div><h3>{translate(link('Joukkueet',slug(team.name),team.name))}</h3><p>{translate(teamLogos[team.name]?.city_fi||'Korisliiga')}{translate(" · ")}{translate(s.games)}{translate(" tilastoitua ottelua")}</p></div><span className="team-record" title={translate("Voitot – tappiot tilastoiduissa otteluissa")}>{translate(s.games?`${s.wins}–${s.losses}`:'—')}</span></header><div className="team-card-metrics"><div><span>{translate("Pisteet / ottelu")}</span><strong>{translate(fmt(s.pointsPerGame))}</strong></div><div><span>{translate("Nettotehokkuus")}</span><strong className={team.metrics.net_rating>0?'positive':''}>{translate(signed(team.metrics.net_rating))}</strong></div><div><span>{translate("eFG %")}</span><strong>{translate(fmt(team.metrics.efg_pct))}</strong></div></div><footer><Form recent={s.recent}/><span className="team-profile-open">{translate(link('Joukkueet',slug(team.name),'Näytä profiili'))}</span></footer></article>;}))}</div>{translate(!teams.length&&<p role="status">{translate("Ei joukkueita tällä haulla.")}</p>)}</>}</div>;
}
export function TeamProfileSummary({team,games,season,onOpenMatch}){
 const {leagueName,seasonLabel,leagueId,seasonId}=useSeason();
 const s=teamSeasonSummary(games,team.name),league=season.aggregate.league;
 const leaguePPG=season.aggregate.games?league.totals.points/(2*season.aggregate.games):null;
 const definitions=[
  {label:'Pisteet / ottelu',value:s.pointsPerGame,average:leaguePPG,key:'points',unit:'PTS',accent:'#df945b'},
  {label:'Päästetyt / ottelu',value:s.allowedPerGame,average:leaguePPG,key:'allowed',unit:'PTS',accent:'#91b4c8'},
  {label:'Hyökkäystehokkuus',value:team.metrics.offensive_rating,average:league.metrics.offensive_rating,key:'offensive',unit:'ORtg',accent:'#df945b'},
  {label:'Puolustustehokkuus',value:team.metrics.defensive_rating,average:league.metrics.offensive_rating,key:'defensive',accent:'#91b4c8',unit:'DRtg'},
  {label:'Nettotehokkuus',value:team.metrics.net_rating,average:0,unit:'NET'},
  {label:'Heittojen tehokkuus',value:team.metrics.efg_pct,average:league.metrics.efg_pct,unit:'eFG %'},
  {label:'Hyökkäyslevypallot',value:team.metrics.offensive_rebound_pct,average:season.highlightLeagueAverages.orb,unit:'ORB %'},
  {label:'Kolmosten osuus',value:team.metrics.three_point_attempt_rate,average:league.metrics.three_point_attempt_rate,unit:'3PA %'},
 ];
 const history=teamRecentMetrics(games,team.name);
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Helsinki'}).format(new Date());
 const next=games.filter(g=>!g.verified&&g.teams.every(t=>t.score==null)&&g.teams.some(t=>t.name===team.name)&&g.date?.slice(0,10)>=today).sort((a,b)=>`${a.date} ${a.time||''}`.localeCompare(`${b.date} ${b.time||''}`))[0];
 return <><header className="team-profile-banner"><Mark name={team.name}/><div><h3>{translate(team.name)}</h3><p>{translate(teamLogos[team.name]?.city_fi)}{translate(" · ")}{translate(leagueName)} {translate(seasonLabel)}</p><Form recent={s.recent}/></div><div className="team-profile-record"><strong>{translate(s.games?`${s.wins}–${s.losses}`:'—')}</strong><span>{translate(s.games)}{translate(" tilastoitua ottelua")}</span><small>{translate(s.games?`${fmt(100*s.wins/s.games)} % voittoprosentti`:'Tilastot täydentyvät otteluiden jälkeen')}</small></div></header>{translate(next&&<a className="team-next-fixture dash-card" href={routeHref({section:'Ottelut',matchId:next.id,leagueId,seasonId})} onClick={e=>{if(!e.metaKey&&!e.ctrlKey&&!e.shiftKey){e.preventDefault();onOpenMatch(next.id);}}}><span>{translate("Seuraava ottelu ")}<small>{translate(new Date(next.date).toLocaleDateString(locale()))}{translate(" · ")}{translate(next.time?.slice(0,5)||'Aika avoin')}</small></span><span className="team-next-pair">{translate(next.teams.map((t,i)=><span key={t.id}>{translate(i>0&&<b className="team-next-vs">{translate("vs")}</b>)}<TeamLogo name={t.name}/><strong>{translate(t.name)}</strong></span>))}</span><span className="team-next-venue">{translate(next.venue)}{translate(" · Avaa ennakko")}</span></a>)}<div className="team-profile-metrics">{translate(definitions.map(d=><article key={d.label} className="dash-card team-detail-metric" style={{'--highlight-accent':d.accent||'#df945b'}}><span className="dash-card-label">{translate(d.label)}</span><strong>{translate(fmt(d.value))}<small>{translate(d.unit)}</small></strong>{translate(d.key&&history.some(g=>Number.isFinite(g[d.key]))&&<HighlightTrend games={history} metric={d.key} average={d.average} unit={d.unit}/>)}<span className="team-metric-average">{translate("Liigan KA ")}<b>{translate(fmt(d.average))}</b></span></article>))}</div></>;
}
