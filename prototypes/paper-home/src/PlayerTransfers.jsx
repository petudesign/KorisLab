import {useEffect,useMemo,useState} from 'react';
import {getSeason,seasonIds,useSeason} from './SeasonContext';
import {useMatches} from './useMatches';
import {detectPlayerTransfers} from './lib/playerTransfers';
import {TeamLogo} from './TeamLogo';
import {routeHref,slug} from './routing';
import {locale,t as translate} from './i18n';
import './player-transfers.css';

const PAGE_SIZE=6;
export function PlayerTransfers({selectedTeamId='league',onEntityNavigate,preview=false}){
 const {data:season,leagueId,seasonId,seasonLabel}=useSeason();
 const previousId=seasonIds[seasonIds.indexOf(seasonId)+1];
 const previousSeason=previousId?getSeason(leagueId,previousId):null;
 const current=useMatches(season.matchesUrl),previous=useMatches(previousSeason?.matchesUrl);
 const [showAll,setShowAll]=useState(false),[filter,setFilter]=useState('all');
 const transfers=useMemo(()=>current.games&&(!previousSeason||previous.games)?detectPlayerTransfers(current.games,previous.games||[]):[],[current.games,previous.games,previousSeason]);
 const visible=useMemo(()=>selectedTeamId==='league'?transfers:transfers.filter(move=>move.to.id===selectedTeamId||move.from.id===selectedTeamId),[transfers,selectedTeamId]);
 useEffect(()=>{setShowAll(false);setFilter('all');},[leagueId,seasonId,selectedTeamId]);
 const loading=!current.games||(previousSeason&&!previous.games&&!previous.error);
 const error=current.error||previous.error;
 const pageSize=preview?3:PAGE_SIZE;
 const filterMoves=key=>key==='changed'?visible.filter(move=>['season','midseason'].includes(move.type)):key==='new'?visible.filter(move=>move.type==='new'):key==='missing'?visible.filter(move=>move.type==='missing'):visible;
 const tabs=[['all','Kaikki muutokset'],['changed','Seuraa vaihtaneet'],['new','Aineistoon tulleet'],['missing','Ei vielä nykykaudella']].map(([key,label])=>({key,label,count:filterMoves(key).length})).filter(tab=>tab.key==='all'||tab.count>0);
 const filtered=filterMoves(filter),shown=showAll?filtered:filtered.slice(0,pageSize);
 const retry=()=>{if(current.error)current.retry();if(previous.error)previous.retry();};
 return <section className="player-transfers" aria-label={translate('Tehdyt siirrot')}>
  <header className="player-transfers-heading"><div><h3>{translate('Tehdyt siirrot')}</h3><p>{translate(seasonLabel)} · {translate('Muutokset nykykauden ja edellisen kauden ottelutilastoissa')}</p></div><span>{translate(visible.length)} {translate('pelaajamuutosta aineistossa')}</span></header>
  {!preview&&tabs.length>1&&<div className="player-transfer-filters" role="group" aria-label={translate('Siirtolistauksen rajaus')}>{tabs.map(tab=><button type="button" key={tab.key} aria-pressed={filter===tab.key} onClick={()=>{setFilter(tab.key);setShowAll(false);}}>{translate(tab.label)} <span>{tab.count}</span></button>)}</div>}
  {loading?<p className="player-transfers-state" role="status">{translate('Ladataan ottelutietoja siirtoja varten…')}</p>:error?<p className="player-transfers-state" role="status">{translate('Siirtotietoja ei voitu ladata.')} <button onClick={retry}>{translate('Yritä uudelleen')}</button></p>:visible.length?<>
   <div className="player-transfers-grid">{shown.map(move=><article className="player-transfer-card" key={move.id}>
    <div className="player-transfer-top"><a href={routeHref({section:'Pelaajat',leagueId,seasonId:move.type==='missing'?previousId:seasonId,playerId:move.playerId})} onClick={event=>{if(onEntityNavigate&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey){event.preventDefault();onEntityNavigate('Pelaajat',move.playerId,move.type==='missing'?previousId:seasonId);}}}>{translate(move.name)}</a><span>{translate(move.type==='midseason'?'Kauden aikana':move.type==='season'?'Seuraa vaihtanut':move.type==='new'?'Uusi kauden aineistossa':'Ei vielä uudella kaudella')}</span></div>
    <div className="player-transfer-route"><TeamLink team={move.from} seasonId={move.type==='season'||move.type==='missing'?previousId:seasonId} leagueId={leagueId} onEntityNavigate={onEntityNavigate}/><span className="player-transfer-arrow" aria-hidden="true">→</span><TeamLink team={move.to} seasonId={seasonId} leagueId={leagueId} onEntityNavigate={onEntityNavigate} destination/></div>
    <div className="player-transfer-meta">{move.type==='missing'?<><span>{translate('Edellinen kausi')}: {translate(move.appearances)} {translate('ottelua')}{Number.isFinite(move.previousPointsPerGame)&&<> · {translate(move.previousPointsPerGame.toLocaleString(locale(),{maximumFractionDigits:1,minimumFractionDigits:1}))} PPG</>}</span><span>{translate('Ei nykykauden ottelutilastoissa')}</span></>:move.type==='new'?<><span>{translate('Ei joukkuetta edellisen kauden aineistossa')}</span><span>{translate(move.appearances)} {translate('tilastoitua peliä')}</span></>:<><time dateTime={move.date}>{translate('Ensimmäinen peli uudessa joukkueessa')} · {translate(new Date(move.date).toLocaleDateString(locale(),{day:'numeric',month:'short',year:'numeric'}))}</time><span>{translate(move.appearances)} {translate('tilastoitua peliä')}</span></>}</div>
   </article>)}</div>
   {!preview&&filtered.length>pageSize&&<button className="player-transfers-toggle" aria-expanded={showAll} onClick={()=>setShowAll(value=>!value)}>{translate(showAll?'Näytä vähemmän':'Näytä kaikki siirrot')} <span>{showAll?'↑':'↓'}</span></button>}
  </>:<p className="player-transfers-state">{translate(selectedTeamId==='league'?'Tällä kaudella ei ole vielä havaittuja joukkueenvaihdoksia.':'Valitulla joukkueella ei ole havaittuja saapuvia siirtoja tällä kaudella.')}</p>}
  <p className="player-transfers-note">{translate('Siirrot päätellään tilastoiduista otteluista. TBD tarkoittaa, ettei seuraa löytynyt vertailukauden aineistosta. Nykykaudella näkymätön pelaaja ei välttämättä ole siirtynyt pois: loukkaantumis- ja sopimustietoja ei ole varmennettu. Päivä on ensimmäinen peli uudessa joukkueessa, ei virallinen sopimuspäivä.')}</p>
 </section>;
}

function TeamLink({team,seasonId,leagueId,onEntityNavigate,destination=false}){
 const teamId=team.id||slug(team.name),href=routeHref({section:'Joukkueet',leagueId,seasonId,teamId});
 if(!team.id)return <div className={`player-transfer-team ${destination?'player-transfer-destination':''}`}><TeamLogo name={team.name}/><span>{translate(team.name)}</span></div>;
 return <div className={`player-transfer-team ${destination?'player-transfer-destination':''}`}><a href={href} aria-label={`${translate('Avaa joukkueprofiili')}: ${translate(team.name)}`} onClick={event=>{if(onEntityNavigate&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey){event.preventDefault();onEntityNavigate('Joukkueet',teamId,seasonId);}}}><TeamLogo name={team.name}/><span>{translate(team.name)}</span></a></div>;
}
