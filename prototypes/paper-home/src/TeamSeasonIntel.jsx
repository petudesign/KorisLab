import {useMemo} from 'react';
import {useSeason,seasonIds,getSeason} from './SeasonContext';
import {useMatches} from './useMatches';
import {teamSeasonContext,teamSeasonInfo} from './lib/teamSeasonInfo';
import {routeHref} from './routing';
import {TeamLogo} from './TeamLogo';
import {t as translate,locale} from './i18n';
import './team-season-intel.css';

const euro = value => Number.isFinite(value) ? new Intl.NumberFormat(locale(),{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(value) : '—';
const date = value => value ? new Date(value).toLocaleDateString(locale(),{day:'numeric',month:'short'}) : '';

function MatchExtreme({label,result,kind,leagueId,seasonId,onOpenMatch}) {
 if (!result) return <div className={`team-extreme-row ${kind}`}><span className="team-extreme-label">{translate(label)}</span><span className="team-extreme-empty">{translate("Ei vielä tilastoituja pelejä")}</span></div>;
 const href=routeHref({section:'Ottelut',matchId:result.id,leagueId,seasonId});
 return <a className={`team-extreme-row ${kind}`} href={href} onClick={event=>{if(onOpenMatch&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey){event.preventDefault();onOpenMatch(result.id);}}}>
  <span className="team-extreme-label">{translate(label)}</span>
  <span className="team-extreme-margin">{translate(`${result.margin>0?'+':''}${result.margin} p.`)}</span>
  <strong className="team-extreme-score"><b className={kind==='win'?'winner':''}>{translate(result.ownScore)}</b><i>–</i><b className={kind==='loss'?'winner':''}>{translate(result.opponentScore)}</b></strong>
  <span className="team-extreme-opponent"><span className="team-intel-logo" aria-hidden="true"><TeamLogo name={result.opponent}/></span><span>{translate(result.opponent)}</span></span>
  <small className="team-extreme-date">{translate(date(result.date))}</small>
 </a>;
}

function TeamRank({context,info}) {
 const previous=info?.previousRank,current=context.currentRank;
 const movement=Number.isFinite(previous)&&Number.isFinite(current)?previous-current:null;
 return <article className="dash-card team-intel-card team-intel-rank">
  <h4 className="team-intel-title">{translate("Sarjasijoitus")}</h4>
  <div className="team-rank-pair">
   <div className="team-rank-current"><span>{translate("Nyt")}</span><strong>{translate(current?`#${current}`:'—')}</strong>{context.games>0&&<small>{translate(context.wins)}{translate("–")}{translate(context.losses)}{translate(" voittoa–tappiota")}</small>}</div>
   <div className="team-rank-previous"><span>{translate("Edellinen kausi")}</span><strong className={typeof previous==='string'?'team-rank-text':undefined}>{translate(Number.isFinite(previous)?`#${previous}`:previous||'—')}</strong></div>
  </div>
  {Number.isFinite(movement)&&<div className={`team-rank-change ${movement>0?'up':movement<0?'down':'same'}`}>{movement===0?translate('Sama sijoitus kuin edellisellä kaudella'):<><span>{translate('Sijoitusmuutos')}</span><b>{movement>0?'+':''}{translate(movement)}</b></>}</div>}
  <p className="team-intel-note team-intel-bottom">{translate("Alustava sijoitus kirjatuista tuloksista")}{translate(" · ")}{translate(context.games)}{translate(" ottelua")}{context.standingsCount>0&&<>{translate(" · ")}{translate(context.standingsCount)}{translate(" joukkuetta vertailussa")}</>}</p>
 </article>;
}

function RosterChange({context,previousPending,previousError}) {
 const roster=context.roster;
 return <article className="dash-card team-intel-card team-intel-roster">
  <h4 className="team-intel-title">{translate("Kokoonpanon muutos")}</h4>
  {roster?<>
   <div className="team-roster-count">
    <div><strong>{translate(roster.current)}</strong><span>{translate("pelaajaa pelannut nykykaudella")}</span></div>
    <div className="team-roster-previous"><strong>{translate(roster.previous)}</strong><span>{translate("Edellinen kausi")}</span></div>
   </div>
   <div className="team-roster-continuity">
    <div className="team-roster-track" aria-hidden="true"><i style={{width:`${roster.current?100*roster.returning/roster.current:0}%`}}/></div>
    <dl className="team-roster-key"><div><dt>{translate("Jatkaa edelliskaudelta")}</dt><dd>{translate(roster.returning)}</dd></div><div><dt>{translate("Uusia tässä joukkueessa aineistossa")}</dt><dd>{translate(roster.joined)}</dd></div></dl>
   </div>
   <dl className="team-roster-breakdown">
    {roster.movedIn>0&&<div><dt>{translate("Näistä toisesta liigajoukkueesta")}</dt><dd>{translate(roster.movedIn)}</dd></div>}
    {roster.newToLeagueData>0&&<div><dt>{translate("Ei aiemmissa liigatilastoissa")}</dt><dd>{translate(roster.newToLeagueData)}</dd></div>}
    <div><dt>{translate("Edelliskauden pelaajia ei näy nykykauden ottelutilastoissa")}</dt><dd>{translate(roster.notYetSeen)}</dd></div>
   </dl>
  </>:<p className="team-intel-note">{translate(previousError?"Edelliskauden aineistoa ei saatu ladattua.":previousPending?"Haetaan edelliskauden vertailua…":"Vertailukautta ei ole aineistossa.")}</p>}
  <p className="team-intel-note team-intel-bottom">{translate("Luvut kuvaavat peliminuutteja saaneita pelaajia ottelutilastoissa. Puuttuva merkintä ei vahvista siirtoa tai sopimustilannetta.")}</p>
 </article>;
}

function CoachInfo({info}) {
 if (!info) return null;
 const coachChanged=info.previousCoach&&info.coach&&info.previousCoach.normalize('NFC').toLocaleLowerCase('fi-FI')!==info.coach.normalize('NFC').toLocaleLowerCase('fi-FI');
 return <article className="dash-card team-intel-card team-intel-coach">
  <h4 className="team-intel-title">{translate("Valmennus")}</h4>
  <strong className="team-coach-name">{translate(info.coach)}</strong>
  <span className="team-coach-role">{translate("Päävalmentaja")}{translate(" · ")}{translate(info.coachSeasons)}{translate(". kausi liigassa")}</span>
  <p className={`team-coach-status ${coachChanged?'changed':''}`}>{translate(!info.previousCoach?"Ei vertailtavaa aiempaa päävalmentajaa liigassa":coachChanged?"Uusi päävalmentaja": "Päävalmentaja jatkaa")}</p>
  {info.previousCoach&&<div className="team-coach-previous"><span>{translate("Edellinen")}</span><strong>{translate(info.previousCoach)}</strong></div>}
  <p className="team-intel-note team-intel-bottom">{translate("Infopaketti ilmoittaa päävalmentajan, mutta ei koko valmennusryhmän kokoa.")}</p>
 </article>;
}

function BudgetLine({label,current,previous}) {
 const delta=Number.isFinite(current)&&Number.isFinite(previous)?current-previous:null;
 return <div>
  <dt>{translate(label)}</dt><dd><strong className="team-budget-amount">{translate(euro(current))}</strong>
  <span className="team-budget-previous">{translate("Edellinen kausi")}<b>{translate(euro(previous))}</b></span>
  {Number.isFinite(delta)&&<span className="team-budget-delta">{delta>0?'+':''}{translate(euro(delta))}</span>}</dd>
 </div>;
}

function BudgetInfo({info,sourceUrl,updatedAt}) {
 if (!info) return null;
 return <article className="dash-card team-intel-card team-intel-budget">
  <h4 className="team-intel-title">{translate("Resurssit")}</h4>
  <dl className="team-budget-lines"><BudgetLine label="Kausibudjetti" current={info.budget} previous={info.previousBudget}/><BudgetLine label="Joukkueen palkkakulut" current={info.payroll} previous={info.previousPayroll}/></dl>
  <footer className="team-intel-source-row team-intel-bottom"><a className="team-intel-source" href={sourceUrl} target="_blank" rel="noreferrer">{translate("Basket.fi · joukkuepaketti")}{translate(" ↗")}</a><small>{translate("Päivitetty")}{translate(" · ")}{translate(date(updatedAt))}</small></footer>
 </article>;
}

export function TeamSeasonIntel({team,games,onOpenMatch}) {
 const {leagueId,seasonId}=useSeason();
 const index=seasonIds.indexOf(seasonId),previousSeasonId=seasonIds[index+1];
 const previousSeason=previousSeasonId?getSeason(leagueId,previousSeasonId):null;
 const previousState=useMatches(previousSeason?.matchesUrl||null);
 const dataReady=Array.isArray(previousState.games);
 const context=useMemo(()=>teamSeasonContext(games,dataReady?previousState.games:null,team.name),[games,previousState.games,dataReady,team.name]);
 const seasonInfo=teamSeasonInfo[leagueId]?.[seasonId];
 const info=seasonInfo?.teams?.[team.name];
 return <section className="team-season-intel" aria-labelledby="team-season-intel-title">
  <header className="team-season-intel-heading"><h3 id="team-season-intel-title">{translate("Kauden lisätiedot")}</h3><span>{translate(context.games)}{translate(" tilastoitua ottelua")}</span></header>
  <div className={`team-season-intel-grid ${info?'has-official-info':''}`}>
   <article className="dash-card team-intel-card team-intel-extremes">
    <h4 className="team-intel-title">{translate("Otteluiden ääripäät")}</h4>
    <MatchExtreme label="Suurin voitto" result={context.biggestWin} kind="win" leagueId={leagueId} seasonId={seasonId} onOpenMatch={onOpenMatch}/>
    <MatchExtreme label="Suurin tappio" result={context.biggestLoss} kind="loss" leagueId={leagueId} seasonId={seasonId} onOpenMatch={onOpenMatch}/>
   </article>
   <TeamRank context={context} info={info}/>
   <CoachInfo info={info}/>
   <RosterChange context={context} previousPending={!!previousSeason&&!previousState.games&&!previousState.error} previousError={previousState.error}/>
   <BudgetInfo info={info} sourceUrl={seasonInfo?.sourceUrl} updatedAt={seasonInfo?.updatedAt}/>
  </div>
 </section>;
}
