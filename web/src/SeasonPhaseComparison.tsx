import { useState } from "react";
import { useSeason } from "./SeasonContext";
import { useI18n } from "./i18n";

export function SeasonPhaseComparison() {
  const { tr, language } = useI18n();
  const { data: regularSeason, seasonId, seasonLabel, playoffSummaries } = useSeason();
  const playoffs = playoffSummaries[seasonId === "2024-25" ? "2024-25" : "2025-26"];
  const [teamId, setTeamId] = useState((regularSeason.aggregate.teams.find((team) => team.name === "ToPo") ?? regularSeason.aggregate.teams[0]).source_team_id);
  const regular = regularSeason.aggregate.teams.find((team) => team.source_team_id === teamId) ?? regularSeason.aggregate.teams[0];
  const postseason = playoffs.aggregate.teams.find((team) => team.source_team_id === regular.source_team_id);
  const average = (team: typeof regular | undefined, key: keyof typeof regular.totals) => team && team.totals[key] != null && team.games > 0 ? team.totals[key] / team.games : null;
  const fieldGoalPct = (team: typeof regular | undefined) => {
    if (!team) return null;
    const attempts = team.totals.two_pa + team.totals.three_pa;
    return attempts > 0 ? (team.totals.two_pm + team.totals.three_pm) / attempts * 100 : null;
  };
  const metrics = [
    { label: tr("Pisteet", "Points"), regular: average(regular, "points"), playoffs: average(postseason, "points") },
    { label: tr("Levypallot", "Rebounds"), regular: average(regular, "rebounds"), playoffs: average(postseason, "rebounds") },
    { label: tr("Syötöt", "Assists"), regular: average(regular, "assists"), playoffs: average(postseason, "assists") },
    { label: tr("Riistot", "Steals"), regular: average(regular, "steals"), playoffs: average(postseason, "steals") },
    { label: tr("Menetykset", "Turnovers"), regular: average(regular, "turnovers"), playoffs: average(postseason, "turnovers") },
    { label: tr("Torjunnat", "Blocks"), regular: average(regular, "blocks"), playoffs: average(postseason, "blocks") },
    { label: "ORtg", regular: regular.metrics.offensive_rating, playoffs: postseason?.metrics.offensive_rating },
    { label: "DRtg", regular: regular.metrics.defensive_rating, playoffs: postseason?.metrics.defensive_rating },
    { label: "FG%", regular: fieldGoalPct(regular), playoffs: fieldGoalPct(postseason), percentage: true },
  ];
  const number = (value: number | null | undefined, percentage = false) => value == null ? "—" : `${value.toLocaleString(language === "fi" ? "fi-FI" : "en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${percentage ? "%" : ""}`;
  return (
    <section id="season-phase-comparison" className="panel phase-comparison overview-section-anchor" aria-labelledby="phase-comparison-heading">
      <div className="panel-heading panel-heading--plain">
        <div><h2 id="phase-comparison-heading">{tr("Runkosarjasta pudotuspeleihin", "Regular season to playoffs")}</h2><p className="panel-subcopy">{tr("Miten joukkueen luvut muuttuvat kauden ratkaisupeleissä?", "How do a team's numbers change in the postseason?")}</p></div>
        <label className="phase-team-select">{tr("Vertailtava joukkue", "Team to compare")}<select value={regular.source_team_id} onChange={(event) => setTeamId(event.target.value)}>{regularSeason.aggregate.teams.map((team) => <option key={team.source_team_id} value={team.source_team_id}>{team.name}</option>)}</select></label>
      </div>
      <div className="phase-samples" aria-live="polite">
        <span><strong>{regular.name} · {seasonLabel}</strong></span>
        <span>{tr("Runkosarja", "Regular season")}: <strong>{regular.games} {tr("ottelua", "games")}</strong></span>
        <span>{tr("Pudotuspelit", "Playoffs")}: <strong>{postseason ? `${postseason.games} ${tr("ottelua", "games")}` : tr("ei osallistunut", "did not qualify")}</strong></span>
      </div>
      {postseason ? <div className="phase-table-wrap"><table className="phase-table">
        <caption className="sr-only">{regular.name}: {tr("runkosarjan ja pudotuspelien vertailu", "regular season and playoff comparison")}</caption>
        <thead><tr><th scope="col">{tr("Mittari", "Metric")}</th><th scope="col">{tr("Runkosarja", "Regular season")}</th><th scope="col">{tr("Pudotuspelit", "Playoffs")}</th><th scope="col">{tr("Muutos", "Change")}</th></tr></thead>
        <tbody>{metrics.map((metric) => {
          const delta = metric.regular == null || metric.playoffs == null ? null : Math.round((metric.playoffs - metric.regular) * 10) / 10;
          const direction = delta == null || delta === 0 ? "neutral" : delta > 0 ? "positive" : "negative";
          return <tr key={metric.label} className={metric.label === "ORtg" || metric.label === "FG%" ? "phase-row--group-start" : undefined}><th scope="row">{metric.label}</th><td className="phase-regular">{number(metric.regular, metric.percentage)}</td><td className="phase-playoffs">{number(metric.playoffs, metric.percentage)}</td><td className={`phase-delta phase-delta--${direction}`}>{delta == null ? "—" : `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${number(Math.abs(delta))}${metric.percentage ? "%" : ""}`}</td></tr>;
        })}</tbody>
      </table></div> : <div className="match-list-empty"><strong>{tr("Joukkue ei pelannut pudotuspeleissä", "This team did not play in the playoffs")}</strong><p>{tr("Valitse toinen joukkue nähdäksesi vertailun.", "Select another team to see the comparison.")}</p></div>}
      <p className="phase-method">{tr("Pisteet, levypallot, syötöt, riistot, menetykset ja torjunnat ovat keskiarvoja per joukkueen ottelu. ORtg ja DRtg ovat pisteitä ja päästettyjä pisteitä per 100 arvioitua pallonhallintaa; FG% lasketaan yhteenlasketuista osumista ja yrityksistä. Muutos = pudotuspelit − runkosarja. Väri kertoo muutoksen suunnan, ei onko muutos hyvä vai huono. Erot lasketaan ennen lukujen pyöristystä.", "Points, rebounds, assists, steals, turnovers and blocks are averages per team game. ORtg and DRtg show points scored and allowed per 100 estimated possessions; FG% uses total makes and attempts. Change = playoffs − regular season. Color indicates direction, not whether the change is good or bad. Differences are calculated before rounding.")}</p>
      <p className="phase-method">{tr("Vastustajat ja ottelumäärät muuttuvat, joten ero ei yksin osoita joukkueen kehittymistä. Lyhyt ottelusarja voi heilauttaa keskiarvoja. Pudotuspeliaineisto sisältää myös pronssiottelun.", "Opponents and game counts change, so the difference alone does not prove improvement. A short series can shift averages. Playoff data also includes the bronze-medal game.")} <a href="https://tulospalvelu.basket.fi/" target="_blank" rel="noreferrer">{tr("Ottelutilastot", "Game statistics")}</a> · {playoffs.aggregate.games} / {playoffs.summary.available_played_games} {tr("pudotuspeliottelua tarkistettu", "playoff games verified")}.</p>
    </section>
  );
}
