import {useMemo} from 'react';
import {playerTeamContext} from './lib/playerTeamContext';
import {changeContextGames} from './lib/changeAnalysis';
import {TeamLogo} from './TeamLogo';
import {locale,t} from './i18n';
import {routeHref,slug} from './routing';

const fmt=n=>Number.isFinite(n)?n.toLocaleString(locale(),{minimumFractionDigits:1,maximumFractionDigits:1}):'—';
function ContextSide({rows,label,seasonId,leagueId}){
 return <div className="change-team-side"><span className="change-team-period">{t(label)}</span>{rows.map(row=><article key={row.name}>
  <a className="change-team-identity" href={routeHref({section:'Joukkueet',teamId:slug(row.name),seasonId,leagueId})}><TeamLogo name={row.name}/><strong>{row.name}</strong></a>
  <div className="change-team-record"><strong>{row.wins}–{row.losses}</strong><span>{t('voitot–tappiot')} · {row.games} {t('ottelua')}</span></div>
  <p className="change-team-rank">{t('Voittoprosentti')} <b>{fmt(row.winPct)} %</b>{row.winRank&&<> · {t('sija')} {row.winRank}/{row.teamCount}</>}</p>
  <dl className="change-role-metrics"><div><dt>{t('Peliaika / ottelu')}</dt><dd>{fmt(row.minutes)} <small>{t('min')}</small></dd><span>{t('Joukkueen minuuttisija')} {row.minuteRank??'—'}</span></div><div><dt>{t('Osuus joukkueen heitoista')}</dt><dd>{fmt(row.shotShare)} <small>%</small></dd><span>{fmt(row.attempts)} {t('yritystä / ottelu')}</span></div></dl>
 </article>)}</div>;
}
export function PlayerChangeContext({analysis,games,previousGames,playerId,previousPlayerId,mode,seasonId,previousId,leagueId,currentLabel,baselineLabel}){
 const before=useMemo(()=>playerTeamContext(changeContextGames(mode!=='recent'?previousGames:games,analysis.earlier,mode),analysis.earlier,mode!=='recent'?previousPlayerId:playerId),[mode,previousGames,games,analysis.earlier,previousPlayerId,playerId]);
 const after=useMemo(()=>playerTeamContext(changeContextGames(games,analysis.recent,mode),analysis.recent,playerId),[games,analysis.recent,playerId,mode]);
 if(!before.length||!after.length)return null;
 return <section className="change-team-context" aria-label={t('Joukkue ja vastuu')}><h4>{t('Joukkue ja vastuu')}</h4>
  {before.length===1&&after.length===1&&<p className="change-role-summary">{before[0].minuteRank===1&&after[0].minuteRank===1&&before[0].pointRank===1&&after[0].pointRank===1?t('Molemmissa joukkueissa eniten minuutteja ja pisteitä tässä vertailuotoksessa.'):t('Vertaa joukkueen tuloksia ja pelaajan vastuuta rinnakkain.')}{Number.isFinite(before[0].shotShare)&&Number.isFinite(after[0].shotShare)&&Math.abs(after[0].shotShare-before[0].shotShare)<2&&<> {t('Osuus joukkueen heitoista pysyi lähellä aiempaa tasoa.')}</>}</p>}
  <div className="change-team-comparison"><ContextSide rows={before} label={baselineLabel} seasonId={mode!=='recent'?previousId:seasonId} leagueId={leagueId}/><ContextSide rows={after} label={currentLabel} seasonId={seasonId} leagueId={leagueId}/></div>
  <p className="change-team-scope">{t(mode==='firstFive'?'Joukkueen tulokset: tarkistetut ottelut vertailujakson loppuun asti. Pelaajan vastuu: ensimmäisten viiden ottelun otos.':'Joukkueen tulokset: kauden tarkistetut ottelut. Pelaajan vastuu: valittu vertailuotos.')}</p>
  <details className="change-role-details"><summary>{t('Miten suuri rooli joukkueessa?')}</summary><div className="change-role-extra">{[[baselineLabel,before],[currentLabel,after]].map(([label,rows])=><div key={label}><b>{t(label)}</b>{rows.map(row=><p key={row.name}>{row.name}: {t('osuus joukkueen pisteistä')} <strong>{fmt(row.pointShare)} %</strong> · {t('pistesija')} {row.pointRank??'—'} · {row.sampleGames} {t('ottelua')}</p>)}</div>)}</div><p>{t('Heitto-osuus ja pisteosuus lasketaan pelaajan vertailuotteluista, ei koko joukkueen kaudesta. Minuutti- ja pistesija perustuvat joukkuetovereiden kokonaislukuihin samoissa otteluissa. Heitto-osuus ei ole usage-prosentti. Voittoprosentin sija kuvaa tarkistettua aineistoa, ei virallista sarjataulukkoa tai lopullista sijoitusta.')}</p></details>
 </section>;
}
