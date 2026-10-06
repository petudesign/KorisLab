import { useI18n } from "./i18n";

type ShootingTotals = {
  two_pm: number;
  two_pa: number;
  three_pm: number;
  three_pa: number;
  ftm: number;
  fta: number;
};

type ShotSplit = {
  key: string;
  label: string;
  value: number | null;
  league: number | null;
  teamMakes: number;
  teamAttempts: number;
  leagueAttempts: number;
};

const percentage = (made: number, attempts: number) => attempts > 0 ? made / attempts * 100 : null;

export function TeamShootingChart({ teamName, teamTotals, leagueTotals, teamGames, leagueTeamGames }: {
  teamName: string;
  teamTotals: ShootingTotals;
  leagueTotals: ShootingTotals;
  teamGames: number;
  leagueTeamGames: number;
}) {
  const { language, tr } = useI18n();
  const locale = language === "fi" ? "fi-FI" : "en-GB";
  const formatPercent = (value: number | null) => value === null ? "—" : `${value.toLocaleString(locale, { maximumFractionDigits: 1 })}%`;
  const formatAttempts = (value: number) => value.toLocaleString(locale, { maximumFractionDigits: 1 });
  const splits: ShotSplit[] = [
    { key: "two", label: tr("2 pisteen heitot", "2-point shots"), value: percentage(teamTotals.two_pm, teamTotals.two_pa), league: percentage(leagueTotals.two_pm, leagueTotals.two_pa), teamMakes: teamTotals.two_pm, teamAttempts: teamTotals.two_pa, leagueAttempts: leagueTotals.two_pa },
    { key: "three", label: tr("3 pisteen heitot", "3-point shots"), value: percentage(teamTotals.three_pm, teamTotals.three_pa), league: percentage(leagueTotals.three_pm, leagueTotals.three_pa), teamMakes: teamTotals.three_pm, teamAttempts: teamTotals.three_pa, leagueAttempts: leagueTotals.three_pa },
    { key: "free", label: tr("Vapaaheitot", "Free throws"), value: percentage(teamTotals.ftm, teamTotals.fta), league: percentage(leagueTotals.ftm, leagueTotals.fta), teamMakes: teamTotals.ftm, teamAttempts: teamTotals.fta, leagueAttempts: leagueTotals.fta },
  ];
  const hasData = splits.some((split) => split.value !== null || split.league !== null);
  const baselineY = 205;
  const chartHeight = 145;
  const yFor = (value: number) => baselineY - Math.max(0, Math.min(100, value)) / 100 * chartHeight;
  const ticks = [0, 25, 50, 75, 100];
  const centers = [160, 335, 510];

  return <section className="panel team-shooting-chart" aria-labelledby="team-shooting-chart-heading">
    <div className="team-chart-heading">
      <div>
        <h3 id="team-shooting-chart-heading">{tr("Heittotarkkuus vs. sarjan taso", "Shooting accuracy vs. league")}</h3>
        <p>{tr("Osumaprosentit kauden yhteismääristä", "Percentages from season totals")}</p>
      </div>
      <div className="team-chart-legend" aria-label={tr("Kaavion selite", "Chart legend")}>
        <span><i className="team-chart-legend-mark team-chart-legend-mark--team" />{teamName}</span>
        <span><i className="team-chart-legend-mark team-chart-legend-mark--league" />{tr("Sarja", "League")}</span>
      </div>
    </div>
    {hasData ? <figure className="team-shooting-figure">
      <svg viewBox="0 0 600 254" role="img" aria-label={tr("Joukkueen ja sarjan kahden pisteen, kolmen pisteen ja vapaaheittojen osumaprosentit", "Team and league two-point, three-point, and free-throw percentages")}>
        {ticks.map((tick) => {
          const y = yFor(tick);
          return <g key={tick}>
            <line x1="52" x2="580" y1={y} y2={y} className="team-shooting-gridline" />
            <text x="42" y={y + 4} textAnchor="end">{tick}%</text>
          </g>;
        })}
        {splits.map((split, index) => {
          const center = centers[index];
          const bars = [
            { value: split.value, x: center - 34, className: "team-shooting-bar team-shooting-bar--team" },
            { value: split.league, x: center + 5, className: "team-shooting-bar team-shooting-bar--league" },
          ];
          return <g key={split.key}>
            {bars.map((bar) => bar.value === null ? null : <g key={bar.className}>
              <rect x={bar.x} y={yFor(bar.value)} width="29" height={Math.max(0, baselineY - yFor(bar.value))} rx="3" className={bar.className} />
              <text x={bar.x + 14.5} y={Math.max(18, yFor(bar.value) - 7)} textAnchor="middle" className="team-shooting-value">{formatPercent(bar.value)}</text>
            </g>)}
            <text x={center} y="238" textAnchor="middle" className="team-shooting-category">{split.label}</text>
          </g>;
        })}
      </svg>
      <figcaption>{tr("2 pisteen heittoja ei ole jaoteltu heittomatkan mukaan.", "Two-point shots are not split by distance.")}</figcaption>
    </figure> : <p className="team-shooting-empty" role="status">{tr("Heittoprosentit näkyvät, kun otteludataa on saatavilla.", "Shooting percentages appear when game data is available.")}</p>}
    {hasData && <div className="team-shooting-attempts" aria-label={tr("Heittoyritykset ja sarjan ottelukohtainen keskiarvo", "Shot attempts and league average per team game")}>
      {splits.map((split) => <div className="team-shooting-attempt-row" key={split.key}>
        <strong>{split.label}</strong>
        <span>{tr("Osumat / yritykset", "Made / attempted")}: <b>{split.teamMakes}/{split.teamAttempts}</b></span>
        <span>{tr("Yrityksiä / ottelu", "Attempts / game")}: <b>{teamGames > 0 ? formatAttempts(split.teamAttempts / teamGames) : "—"}</b></span>
        <small>{tr("Sarjan ka.", "League avg.")}: {leagueTeamGames > 0 ? formatAttempts(split.leagueAttempts / leagueTeamGames) : "—"} {tr("yritystä / ottelu", "attempts / game")}</small>
      </div>)}
    </div>}
  </section>;
}
