import {SearchClearButton} from './SearchClearButton';
import {LoadingSkeleton,StateCard} from './PageStates';
import {useEffect,useState} from 'react';
import {useI18n,locale,t} from './i18n';
import {useSeason,getSeason,seasonIds,leagues} from './SeasonContext';
import {resolveFactSearch} from './lib/factSearch';
import {FactSearchAnswer} from './FactSearchAnswer';
import {resolveBasketballQuery} from './lib/basketballQuery';
import {searchRecords,searchSchedule} from './lib/searchData';
import {aggregateSeasonPlayers} from './lib/playerStats';
import {routeHref,slug} from './routing';
import {TeamLogo} from './TeamLogo';
import './search-page.css';
import {resolveContextSearch} from './lib/contextSearch';
import {ContextSearchAnswer} from './ContextSearchAnswer';
const requests=new Map();
function load(url){if(!requests.has(url))requests.set(url,fetch(url).then(r=>{if(!r.ok)throw Error('Search data');return r.json();}).catch(e=>{requests.delete(url);throw e;}));return requests.get(url);}
export function SearchPage({query,onSearch,onRoute}){
 const {language}=useI18n(),{leagueId,seasonId,leagueName}=useSeason();
 const say=(fi,en)=>language==='fi'?fi:en;
 const [retry,setRetry]=useState(0),[draft,setDraft]=useState(query),[state,setState]=useState({loading:true});
 useEffect(()=>{setDraft(query);let active=true;setState({loading:true});
 (async()=>{
  const facts=await resolveFactSearch(query,{seasonId,leagueId,loadGames:(s,l)=>load(getSeason(l,s).matchesUrl)});
  if(facts){if(active)setState({facts});return;}
  const contextual=await resolveContextSearch(query,{seasonId,seasonIds,loadGames:s=>load(getSeason(leagueId,s).matchesUrl)});
  if(contextual){if(active)setState({contextual});return;}
  const current=await load(getSeason(leagueId,'2026-27').matchesUrl);
  const resolution=await resolveBasketballQuery(query,{language,leagueId:leagueId==='men'?'korisliiga':'naisten-korisliiga',seasonId,selectedSeasonTeams:getSeason(leagueId,seasonId).aggregate.teams,historicalTeams:getSeason(leagueId,'2025-26').aggregate.teams,currentTeams:getSeason(leagueId,'2026-27').aggregate.teams,currentScheduleTeams:[...new Set(current.flatMap(g=>g.teams.map(t=>t.name)))],currentSchedule:searchSchedule(current),historicalTeamsBySeason:Object.fromEntries(seasonIds.map(s=>[s,getSeason(leagueId,s)])),loadMatches:async s=>searchRecords(await load(getSeason(leagueId,s).matchesUrl)),loadPlayoffMatches:s=>s==='2026-27'?Promise.resolve([]):load(`/data/search/${leagueId}-${s}-finals.json`)});
  const targetSeason=resolution.answer?.season||resolution.navigate?.season||seasonId;
  const games=await load(getSeason(leagueId,targetSeason).matchesUrl);
  const players=aggregateSeasonPlayers(searchRecords(games));
  const player=players.find(p=>p.id===(resolution.answer?.playerId||resolution.navigate?.id));
  const team=getSeason(leagueId,targetSeason).aggregate.teams.find(t=>t.source_team_id===(resolution.answer?.teamId||resolution.navigate?.teamId));
  if(active)setState({resolution,games,player,team,targetSeason});
 })().catch(()=>{if(active)setState({error:true});});return()=>{active=false;};
 },[query,leagueId,seasonId,language,retry]);
 const link=(target,label,cls='')=>{const sections={teams:'Joukkueet','player-profile':'Pelaajat',players:'Pelaajat',matches:'Ottelut',season:'Kausitrendit'};const teamName=getSeason(leagueId,target.season).aggregate.teams.find(t=>t.source_team_id===target.teamId)?.name;const route={section:sections[target.view]||'Yleiskatsaus',leagueId,seasonId:target.season,playerId:target.view==='player-profile'?target.id:undefined,teamId:target.teamId?slug(teamName||target.teamId):undefined,matchId:target.view==='matches'?target.id:undefined};return <a className={cls} href={routeHref(route)} onClick={e=>{if(!e.metaKey&&!e.ctrlKey&&!e.shiftKey){e.preventDefault();onRoute(route);}}}>{label}</a>;};
 const number=n=>Number.isFinite(n)?n.toLocaleString(locale(),{maximumFractionDigits:1,minimumFractionDigits:1}):'—';
 const date=d=>d?new Date(d.slice(0,10)+'T12:00:00').toLocaleDateString(locale(),{day:'numeric',month:'long',year:'numeric'}):say('Päivä ei tiedossa','Date unavailable');
 const a=state.resolution?.answer,p=state.player,team=state.team;
 const fixture=a?.kind==='fixture'?a.fixture:a?.nextFixture;
 const selectedTeam=a?.requestedTeam||team?.name||a?.teamName||p?.team||(fixture&&fixture.home.name);
 const related=(state.games||[]).filter(g=>!selectedTeam||g.teams.some(t=>t.name===selectedTeam)).filter(g=>a?.kind!=='team-games'||a.scope==='all'||g.verified&&((g.teams.find(t=>t.name===selectedTeam)?.score>g.teams.find(t=>t.name!==selectedTeam)?.score)===(a.scope==='wins'))).sort((x,y)=>{const xf=x.teams.every(t=>t.score==null)&&new Date(x.date)>Date.now(),yf=y.teams.every(t=>t.score==null)&&new Date(y.date)>Date.now();return Number(yf)-Number(xf)||(xf&&yf?(x.date||'').localeCompare(y.date||''):(y.date||'').localeCompare(x.date||''));});
 const suggestions=state.facts?[say('Sarjataulukko','Standings'),say('Kenellä on eniten pisteitä?','Who has the most points?'),say('Kenellä on suurin budjetti?','Who has the largest budget?')]:state.contextual?[say('Miten Aarrejoen rooli muuttui?','How did Aarrejoki’s role change?'),say('Miksi Peli-Karhut on pelannut huonommin?','Why has Peli-Karhut played worse?'),say('Mitä Hongan seuraavassa ottelussa kannattaa seurata?','What should I watch in Honka’s next game?')]:state.resolution?.feedback.suggestions||[say('Milloin Honka pelaa seuraavaksi?','When does Honka play next?'),say('Lauren Heard pisteet 2526','Lauren Heard points 2526'),say('Kuka voitti kauden 2526?','Who won the 2526 season?')];
 return <section className="search-page"><header><h2>{say('Hakutulokset','Search results')}</h2><p>{t(state.facts?leagues[state.facts.leagueId]:leagueName)} · {say('Ottelut, pelaajat ja kaudet','Games, players and seasons')}</p></header><form className="answer-search" onSubmit={e=>{e.preventDefault();if(draft.trim())onSearch(draft.trim());}}><label className="sr-only" htmlFor="answer-query">{say('Kysy koripallosta','Ask about basketball')}</label><div className="answer-search-field"><input id="answer-query" enterKeyHint="search" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} maxLength={200} value={draft} onChange={e=>setDraft(e.target.value)} placeholder={say('Kysy otteluista tai pelaajista…','Ask about games or players…')}/><SearchClearButton value={draft} onClear={()=>setDraft('')}/></div><button disabled={!draft.trim()}>{say('Hae','Search')}</button></form>
 {state.loading?<LoadingSkeleton variant="search" label="Haetaan vastausta…"/>:state.error?<StateCard tone="error" title="Tietojen lataus epäonnistui" description="Tarkista yhteys ja yritä uudelleen. Valintasi säilyvät." onAction={()=>setRetry(n=>n+1)}/>:<>
 <>{state.facts?<FactSearchAnswer result={state.facts} onRoute={onRoute} onSearch={onSearch}/>:state.contextual?<ContextSearchAnswer result={state.contextual} leagueId={leagueId} onRoute={onRoute} onSearch={onSearch}/>:<>
 <article className={`dash-card search-answer ${a?.kind||''}`} aria-live="polite">
 <div className="answer-label">{say('Vastaus','Answer')} · {(state.targetSeason||seasonId).replace('-','–')}</div>
 {fixture?<><div className="answer-label">{say('Seuraava ottelu','Next game')}</div><div className="answer-match"><div><TeamLogo name={fixture.home.name}/><h3>{fixture.home.name}</h3></div><div><strong>{fixture.scheduled_time?.slice(0,5)||'—'}</strong><span>{date(fixture.scheduled_date)}</span></div><div><TeamLogo name={fixture.away.name}/><h3>{fixture.away.name}</h3></div></div><p>{fixture.venue}</p>{link({view:'matches',season:a.season,id:fixture.source_match_id},say('Avaa ottelun ennakko','Open game preview'),'answer-link')}</>
 :p?<><div className="answer-player"><img src="/ppg-silhouette.png" onError={e=>{e.currentTarget.style.display='none';}} alt=""/><div><h3>{p.name}</h3><p className="answer-team"><TeamLogo name={p.team}/>{p.team}</p></div></div>{a?.value!=null?<><strong className="answer-value">{a.perGame?number(a.value):a.value.toLocaleString(locale())}</strong><span className="answer-unit">{a.statLabel}</span><p>{a.perGame?say('Ottelua kohti','Per game'):say('Yhteensä kaudella','Season total')} · {p.games} {say('ottelua','games')}</p></>:null}<div className="answer-stats">{[[say('PTS / O','PTS / G'),p.points/p.games],[say('AST / O','AST / G'),p.assists/p.games],[say('REB / O','REB / G'),p.rebounds/p.games]].map(([label,value])=><div key={label}><span>{label}</span><strong>{number(value)}</strong></div>)}</div>{link({view:'player-profile',season:state.targetSeason,id:p.id},say('Avaa pelaajaprofiili','Open player profile'),'answer-link')}</>
 :a?.kind==='champion'?<><div className="answer-champion"><TeamLogo name={a.teamName}/><div><span>{say('Suomen mestari','Finnish champion')}</span><h3>{a.teamName}</h3></div></div><p>{state.resolution.feedback.title}</p><div className="answer-final"><span>{say('Ratkaiseva finaali','Deciding final')}</span><strong>{a.final.teams.map(t=>`${t.name} ${t.score}`).join(' – ')}</strong></div>{link({view:'teams',season:a.season,teamId:a.teamId},say('Avaa joukkueprofiili','Open team profile'),'answer-link')}</>
 :team?<><div className="answer-champion"><TeamLogo name={team.name}/><h3>{team.name}</h3></div><div className="answer-stats"><div><span>{say('Ottelut','Games')}</span><strong>{team.games}</strong></div><div><span>PTS / O</span><strong>{number(team.per_game.points)}</strong></div><div><span>eFG %</span><strong>{number(team.metrics.efg_pct)}</strong></div></div>{link(state.resolution.navigate||{view:'teams',season:state.targetSeason,teamId:team.source_team_id},say('Avaa joukkueprofiili','Open team profile'),'answer-link')}</>
 :<><h3>{state.resolution.feedback.title}</h3><p>{state.resolution.feedback.detail}</p></>}
 {state.resolution.feedback.actions?.filter(action=>!(a?.kind==='champion'&&action.target.view==='teams')).map((action,i)=><span className="answer-action" key={i}>{link(action.target,action.label)}</span>)}
 </article>
 {(fixture||p||team||a?.kind==='team-games')&&related.length>0&&<section className="search-related"><header><h3>{selectedTeam} · {say('Kauden ottelut','Season games')}</h3><span>{related.length} {say('ottelua','games')}</span></header><div>{related.map(g=><div className="search-game" key={g.id}><span>{date(g.date)}</span>{link({view:'matches',season:state.targetSeason,id:g.id},<><span>{g.teams[0].name}</span><strong>{g.teams[0].score!=null&&g.teams[1].score!=null?<><b className={g.teams[0].score>=g.teams[1].score?'winner':''}>{g.teams[0].score}</b> – <b className={g.teams[1].score>=g.teams[0].score?'winner':''}>{g.teams[1].score}</b></>:g.time?.slice(0,5)||'—'}</strong><span>{g.teams[1].name}</span></>)}<small>{g.venue}</small></div>)}</div></section>}
 </>}</>
 <p className="search-source">{say('Vastaukset perustuvat tallennettuun otteluohjelmaan ja tarkistettuihin tilastoihin.','Answers use the saved schedule and verified statistics.')}</p>
 </>}
 <div className="search-suggestions"><span>{say('Kokeile myös','Try also')}</span>{suggestions.map(s=><button key={s} onClick={()=>onSearch(s)}>{s}</button>)}</div></section>;
}
