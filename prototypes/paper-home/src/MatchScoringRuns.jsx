import {t as translate} from './i18n';
import {useMatchAsset} from './useMatchAssets';
import {longestScoringRuns} from './lib/scoringRuns';
import {TeamLogo} from './TeamLogo';
import {AssetState} from './MatchShots';
const clock=e=>`${Math.floor(e.remaining/60)}:${String(Math.floor(e.remaining%60)).padStart(2,'0')}`;
const period=e=>e.period<=4?`${e.period}. neljännes`:`Jatkoaika ${e.period-4}`;
export function MatchScoringRuns({game}){
 const state=useMatchAsset(game.id,'replays');
 return <article className="dash-card match-scoring-runs"><header><h3>{translate("Pisteputket")}</h3><span>{translate("Pisimmät vastaamattomat jaksot")}</span></header>{translate(state.status!=='ready'?<AssetState state={state} label="pisteputkia"/>:<div className="scoring-run-rows">{translate(longestScoringRuns(state.data).map(({team,run})=>{
  const first=run&&state.data.events[run.first],last=run&&state.data.events[run.last];
  return <div className="scoring-run-row" key={team.id}><div className="scoring-run-heading"><span className="scoring-run-logo" aria-hidden="true"><TeamLogo name={team.name}/></span><strong>{translate(team.name)}</strong><b className={team.home?'home-ink':'away-ink'}>{translate(run?`${run.points}–0`:'—')}</b></div>{translate(run?<dl className="scoring-run-details"><div><dt>{translate("Ajankohta")}</dt><dd><span>{translate(first.period===last.period?period(first):`${period(first)} → ${period(last)}`)}</span><b>{translate(clock(first))}{translate("–")}{translate(clock(last))}</b></dd></div><div><dt>{translate("Tilanne · koti–vieras")}</dt><dd className="scoring-run-score"><span>{translate(run.beforeHome)}{translate("–")}{translate(run.beforeAway)}</span><i aria-label={translate("muuttui tilanteeksi")}>{translate("→")}</i><b>{translate(last.home)}{translate("–")}{translate(last.away)}</b></dd></div></dl>:<p className="scoring-run-empty">{translate("Ei kirjattuja pisteitä")}</p>)}</div>;

 }))}</div>)}</article>;
}
