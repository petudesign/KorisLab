import {PowerRanking} from './PowerRanking';
import {LoadingSkeleton,StateCard} from './PageStates';
import {t as translate,locale,useI18n} from './i18n';
import {playerTitle,sectionTitle,teamTitle} from './lib/pageTitles';
import {useMemo,useState} from 'react';
import {useSeason} from './SeasonContext';
import {useMatches} from './useMatches';
import {TeamDirectory,TeamProfileSummary} from './TeamDirectory';
import {TeamTable} from './TeamTable';
import {seasonTeams} from './lib/teamProfiles';
import {aggregateSeasonPlayers,playerPerGame,playerEfGPctFromTotals,playerTrueShootingPctFromTotals,playerEfficiencyPer40} from './lib/playerStats';
import {routeHref,slug} from './routing';
import './entities.css';
import {useMetadata} from './seo';
import {PlayerLeaders} from './PlayerLeaders';
import {PlayerDiscoveries} from './PlayerDiscoveries';
import {ChangeAnalysis} from './ChangeAnalysis';
import {PlayerRatings} from './PlayerRatings';
import {PlayerProfileSummary} from './PlayerProfileSummary';
import {PlayerAnalysis} from './PlayerAnalysis';
import {TeamLogo} from './TeamLogo';
import {TeamSeasonIntel} from './TeamSeasonIntel';
import {useTableSort,SortHeaders,TableSortMenu} from './TableSort';
const fmt=(n,d=1)=>Number.isFinite(n)?n.toLocaleString(locale(),{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
export const playerRecords=games=>games.filter(g=>g.verified).map(g=>({game:{source_id:g.id},teams:g.teams.map(t=>({...t,source_id:t.id,home_away:t.side,players:t.players.map(p=>({...p,source_player_id:p.id,display_name:p.name,minutes:p.minutesValue}))}))}));
const playerColumns=[
 {key:'name',label:'Pelaaja',text:true,value:p=>p.name},{key:'team',label:'Joukkue',text:true,value:p=>p.team},
 {key:'games',label:'O',value:p=>p.games},{key:'minutes',label:'MIN / O',value:p=>p.games?p.minutes/p.games:null},
 {key:'points',label:'PTS / O',value:p=>playerPerGame(p,'points')},{key:'rebounds',label:'REB / O',value:p=>playerPerGame(p,'rebounds')},
 {key:'assists',label:'AST / O',value:p=>playerPerGame(p,'assists')},{key:'efg',label:'eFG %',value:playerEfGPctFromTotals},
 {key:'ts',label:'TS %',value:playerTrueShootingPctFromTotals},{key:'eff',label:'Eff / 40 min',value:playerEfficiencyPer40}
];
const rosterColumns=playerColumns.filter(c=>!['team','ts','eff'].includes(c.key));
const gamePlayer=(g,id)=>g.teams.flatMap(t=>t.players).find(p=>p.id===id);
const historyColumns=id=>[
 {key:'date',label:'Ottelu',value:g=>g.date},
 {key:'minutes',label:'MIN',value:g=>gamePlayer(g,id)?.minutesValue},
 ...[['points','PTS'],['rebounds','REB'],['assists','AST'],['turnovers','TO']].map(([key,label])=>({key,label,value:g=>gamePlayer(g,id)?.stats[key]})),
 {key:'efg',label:'eFG %',value:g=>{const s=gamePlayer(g,id)?.stats;return s&&s.two_pa+s.three_pa?100*(s.two_pm+1.5*s.three_pm)/(s.two_pa+s.three_pa):null;}}
];
export function EntityPages({section,playerId,teamId,onNavigate,onOpenMatch}){
 const context=useSeason(),{data:season,leagueId,seasonId}=context;
 const {language}=useI18n();
 const {games,error,retry}=useMatches(season.matchesUrl);
 const players=useMemo(()=>games?aggregateSeasonPlayers(playerRecords(games)):[],[games]);
 const [query,setQuery]=useState(''),[team,setTeam]=useState('all'),[minimum,setMinimum]=useState(1);
 const playerSorting=useTableSort(playerColumns,'points'),rosterSorting=useTableSort(rosterColumns,'points'),historySorting=useTableSort(historyColumns(playerId),'date');
 const profilePlayer=players.find(p=>p.id===playerId),profileTeam=seasonTeams(season,games||[]).find(t=>t.source_team_id===teamId||slug(t.name)===teamId);
 useMetadata(profilePlayer?playerTitle(profilePlayer.name,leagueId,seasonId,language):profileTeam?teamTitle(profileTeam.name,leagueId,seasonId,language):sectionTitle(section,leagueId,seasonId,language),`${profilePlayer?.name||profileTeam?.name||section} · ${context.leagueName} ${context.seasonLabel}. Pelaaja- ja joukkuetilastot sekä ottelut.`,{...context,canonicalPath:profileTeam?`/teams/${leagueId==='men'?'korisliiga':'naisten-korisliiga'}/${slug(profileTeam.name)}/`:undefined},true,!!games&&!error&&!!(playerId||teamId)&&!(profilePlayer||profileTeam));
 const href=(type,id)=>routeHref({section:type,leagueId,seasonId,...(type==='Pelaajat'?{playerId:id}:{teamId:id})});
 const link=(type,id,label)=><a href={href(type,id)} onClick={e=>{if(!e.metaKey&&!e.ctrlKey&&!e.shiftKey){e.preventDefault();onNavigate(type,id);}}}>{translate(label)}</a>;
 if(error)return <StateCard tone="error" title="Tilastojen lataus epäonnistui." description="Tarkista yhteys ja yritä uudelleen. Valintasi säilyvät." onAction={retry}/>;
 if(!games)return <LoadingSkeleton variant={playerId||teamId?'profile':'comparison'} label="Ladataan tilastoja…"/>;
 const minuteNotice=players.some(p=>(!playerId||p.id===playerId)&&!Number.isFinite(p.minutes))?<p className="match-method" role="note">{translate('Osaa lähteen peliajoista ei voitu varmistaa. Niihin perustuvat minuutti- ja per 40 minuutin luvut näkyvät viivana; muut tilastot säilyvät.')}</p>:null;
 if(section==='Joukkueet'){
  const selected=seasonTeams(season,games).find(t=>t.source_team_id===teamId||slug(t.name)===teamId);
  if(!teamId)return <><TeamTable onEntityNavigate={onNavigate}/><PowerRanking onEntityNavigate={onNavigate}/><TeamDirectory season={season} games={games} link={link}/></>;
  if(!selected)return <StateCard title="Joukkuetta ei löydy valitulta kaudelta" description="Tarkista sarja ja kausi yläreunan valikosta tai palaa joukkuelistaan.">{link('Joukkueet',null,'Kaikki joukkueet')}</StateCard>;
  const teamPlayers=players.filter(p=>p.team===selected.name),teamGames=games.filter(g=>g.teams.some(t=>t.name===selected.name));
  return <div className="entity-profile">{minuteNotice}{translate(link('Joukkueet',null,'← Joukkueet'))}<TeamProfileSummary team={selected} games={games} season={season} onOpenMatch={onOpenMatch}/><TeamSeasonIntel team={selected} games={games} onOpenMatch={onOpenMatch}/><ChangeAnalysis key={`${leagueId}-${seasonId}-${selected.name}`} games={games} teamName={selected.name}/><article className="dash-card"><h3>{translate("Pelaajat")}</h3><TableSortMenu columns={rosterColumns} sorting={rosterSorting} label="Joukkueen pelaajien järjestys"/><div className="entity-table-wrap"><table className="entity-table"><thead><tr><SortHeaders columns={rosterColumns} sorting={rosterSorting}/></tr></thead><tbody>{translate(rosterSorting.rows(teamPlayers).map(p=><tr key={p.id}><th>{translate(link('Pelaajat',p.id,p.name))}</th><td>{translate(p.games)}</td><td>{translate(fmt(p.minutes/p.games))}</td><td>{translate(fmt(playerPerGame(p,'points')))}</td><td>{translate(fmt(playerPerGame(p,'rebounds')))}</td><td>{translate(fmt(playerPerGame(p,'assists')))}</td><td>{translate(fmt(playerEfGPctFromTotals(p)))}</td></tr>))}</tbody></table></div></article><article className="dash-card"><h3>{translate("Ottelut")}</h3><GameLinks games={teamGames} context={context} onOpenMatch={onOpenMatch} teamName={selected.name}/></article></div>;
 }
 if(playerId){const p=players.find(p=>p.id===playerId);if(!p)return <StateCard title="Pelaajaa ei löydy valitun kauden tilastoista" description="Pelaaja voi löytyä toiselta kaudelta. Tarkista sarja ja kausi yläreunan valikosta.">{link('Pelaajat',null,'Kaikki pelaajat')}</StateCard>;
  const history=games.filter(g=>g.verified&&g.teams.some(t=>t.players.some(x=>x.id===p.id&&(x.minutesValue>0||x.participated===true))));
  return <div className="entity-profile">{minuteNotice}{translate(link('Pelaajat',null,'← Pelaajat'))}<PlayerProfileSummary player={p} players={players} games={games} teamLink={link('Joukkueet',slug(p.team),p.team)}/><PlayerRatings player={p} players={players}/><ChangeAnalysis key={`${leagueId}-${seasonId}-${p.id}`} games={games} player={p}/><article className="dash-card"><h3>{translate("Heitot kaudella")}</h3><div className="entity-shot-totals">{translate([['2P',p.twoPM,p.twoPA],['3P',p.threePM,p.threePA],['FT',p.ftm,p.fta]].map(([label,m,a])=><div key={label}><span>{translate(label)}</span><strong><b className="shot-made-count">{translate(m)}</b><span className="shot-attempt-count">{translate(" / ")}{translate(a)}</span></strong><span>{translate(fmt(a?100*m/a:null))}{translate(" %")}</span><i><b style={{width:`${a?100*m/a:0}%`}}/></i></div>))}</div></article><PlayerAnalysis player={p} gameIds={history.map(g=>g.id)}/><article className="dash-card"><h3>{translate("Ottelutilastot")}</h3><TableSortMenu columns={historyColumns(playerId)} sorting={historySorting} label="Pelaajan ottelutilastojen järjestys"/><div className="entity-table-wrap"><table className="entity-table"><thead><tr><SortHeaders columns={historyColumns(playerId)} sorting={historySorting}/></tr></thead><tbody>{translate(historySorting.rows(history).map(g=>{const t=g.teams.find(t=>t.players.some(x=>x.id===p.id)),row=t.players.find(x=>x.id===p.id),other=g.teams.find(o=>o!==t),s=row.stats;return <tr key={g.id} className={t.score>other.score?'player-game-won':'player-game-lost'}><th><a href={routeHref({section:'Ottelut',matchId:g.id,leagueId,seasonId})} onClick={e=>{if(!e.metaKey&&!e.ctrlKey&&!e.shiftKey){e.preventDefault();onOpenMatch(g.id);}}}><span className="player-game-result">{translate(t.score>other.score?'V':'H')}</span>{translate(new Date(g.date).toLocaleDateString(locale()))}{translate(" · ")}{translate(other.name)}<span className="player-game-score"><b className={t.score>other.score?'winner':''}>{translate(t.score)}</b><span>{translate("–")}</span><b className={other.score>t.score?'winner':''}>{translate(other.score)}</b></span></a></th><td>{translate(row.minutes||'—')}</td>{translate(['points','rebounds','assists','turnovers'].map(k=><td key={k}>{translate(fmt(s[k],0))}</td>))}<td>{translate(fmt(s.two_pa+s.three_pa?100*(s.two_pm+1.5*s.three_pm)/(s.two_pa+s.three_pa):null))}</td></tr>;}))}</tbody></table></div></article><p className="match-method">{translate("Kauden kokonaislukuihin perustuvat keskiarvot. TS % huomioi heittoyritykset ja vapaaheitot (kerroin 0,44). Puuttuvat arvot: —.")}</p></div>;
 }
 const rows=playerSorting.rows(players.filter(p=>p.games>=minimum&&(team==='all'||p.team===team)&&`${p.name} ${p.team}`.toLocaleLowerCase('fi').includes(query.toLocaleLowerCase('fi'))));
 return <div className="players-view">{minuteNotice}<PlayerLeaders players={players} games={games} link={link}/><PlayerDiscoveries key={`${leagueId}-${seasonId}`} players={players} link={link}/><div className="match-filters"><label>{translate("Hae pelaajaa")}<input aria-label={translate("Hae pelaajaa")} enterKeyHint="done" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} placeholder={translate("Nimi tai joukkue")} value={query} onChange={e=>setQuery(e.target.value)}/></label><label>{translate("Joukkue")}<select aria-label={translate("Pelaajien joukkue")} value={team} onChange={e=>setTeam(e.target.value)}><option value="all">{translate("Kaikki joukkueet")}</option>{translate([...new Set(players.map(p=>p.team))].sort().map(t=><option key={t} value={t}>{translate(t)}</option>))}</select></label><TableSortMenu columns={playerColumns} sorting={playerSorting} label="Pelaajien järjestys"/><label>{translate("Vähintään otteluita")}<input type="number" min="1" max="100" inputMode="numeric" enterKeyHint="done" aria-label={translate("Pelaajien vähimmäisottelut")} value={minimum} onChange={e=>setMinimum(Math.max(1,Number(e.target.value)))}/></label></div><p className="matches-count">{translate(rows.length)}{translate(" pelaajaa")}</p><article className="dash-card"><div className="entity-table-wrap"><table className="entity-table"><thead><tr><SortHeaders columns={playerColumns} sorting={playerSorting}/></tr></thead><tbody>{translate(rows.map(p=><tr key={p.id}><th>{translate(link('Pelaajat',p.id,p.name))}</th><td>{translate(link('Joukkueet',slug(p.team),p.team))}</td><td>{translate(p.games)}</td><td>{translate(fmt(p.minutes/p.games))}</td><td>{translate(fmt(playerPerGame(p,'points')))}</td><td>{translate(fmt(playerPerGame(p,'rebounds')))}</td><td>{translate(fmt(playerPerGame(p,'assists')))}</td><td>{translate(fmt(playerEfGPctFromTotals(p)))}</td><td>{translate(fmt(playerTrueShootingPctFromTotals(p)))}</td><td>{translate(fmt(playerEfficiencyPer40(p)))}</td></tr>))}</tbody></table></div>{translate(!rows.length&&<StateCard title="Ei pelaajia tässä rajauksessa." description="Kokeile toista hakua tai poista suodattimet." actionLabel="Tyhjennä suodattimet" onAction={()=>{setQuery('');setTeam('all');setMinimum(1);}}/>)}</article></div>;
}
function GameLinks({games,context,onOpenMatch,teamName}){
 const columns=[{key:'date',label:'Päivämäärä',value:g=>`${g.date||''} ${g.time||''}`},{key:'own',label:'Omat pisteet',value:g=>g.teams.find(t=>t.name===teamName)?.score},{key:'opponent',label:'Vastustajan pisteet',value:g=>g.teams.find(t=>t.name!==teamName)?.score}];
 const sorting=useTableSort(columns,'date','asc');
 return <><TableSortMenu columns={columns} sorting={sorting} label="Joukkueen otteluiden järjestys"/><div className="entity-game-links">{translate(sorting.rows(games).map(g=>{
  const h=g.teams.find(t=>t.side==='home'),a=g.teams.find(t=>t.side==='away');
  const played=Number.isFinite(h.score)&&Number.isFinite(a.score),own=g.teams.find(t=>t.name===teamName),opponent=g.teams.find(t=>t!==own);
  const outcome=played?(own.score>opponent.score?'won':own.score<opponent.score?'lost':'draw'):null;
  return <a key={g.id} className="entity-game-row" href={routeHref({section:'Ottelut',matchId:g.id,leagueId:context.leagueId,seasonId:context.seasonId})} onClick={e=>{if(!e.metaKey&&!e.ctrlKey&&!e.shiftKey){e.preventDefault();onOpenMatch(g.id);}}}>
   <span className="entity-game-meta"><span>{translate(g.date?new Date(g.date).toLocaleDateString(locale()):'Aika avoin')}</span>{translate(played?<span className={`entity-game-result ${outcome}`} aria-label={translate(outcome==='won'?'Voitto':outcome==='lost'?'Tappio':'Tasapeli')}>{translate(outcome==='won'?'V':outcome==='lost'?'H':'T')}</span>:<small>{translate(g.time?.slice(0,5)||'Tulossa')}</small>)}</span>
   <span className="entity-game-pair">{translate([h,a].map((t,i)=><span key={t.id||t.name} className={`entity-game-team ${played?(t.score>g.teams.find(other=>other!==t).score?'winner':'loser'):''}`}><span className="entity-game-logo" aria-hidden="true"><TeamLogo name={t.name}/></span><span className="entity-game-name">{translate(t.name)}<small>{translate(i===0?'Koti':'Vieras')}</small></span>{translate(played&&<b>{translate(t.score)}</b>)}</span>))}</span>
  </a>;
 }))}</div></>;
}
