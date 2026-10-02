import { useSeason, type SeasonMatchRecord } from "./SeasonContext";
import { useI18n } from "./i18n";
import { TeamTrend } from "./TeamTrend";
import { Icon } from "./Icon";
import { getProfileComparison, type ProfileComparison, type ProfileStatus } from "./teamProfileComparison";

type Metrics = Record<string, number | null>;

const definitions = [
  { key: "possessions_per_game", preference: "descriptive", label: "Pallonhallinnat ottelua kohti", labelEn: "Possessions per game", unit: "", near: 0.8, strong: 1.6, explanation: "Arvio hyökkäysvuorojen määrästä. Jatkoaikoja ei ole vakioitu, joten tämä ei ole 40 minuutin tempo.", explanationEn: "An estimate of possessions per game. Overtime is not standardized, so this is not a 40-minute pace." },
  { key: "offensive_rating", preference: "higher", label: "Hyökkäystehokkuus", labelEn: "Offensive efficiency", unit: "", near: 1.5, strong: 3, explanation: "Tehdyt pisteet sataa arvioitua pallonhallintaa kohti.", explanationEn: "Points scored per 100 estimated possessions." },
  { key: "defensive_rating", preference: "lower", label: "Puolustustehokkuus", labelEn: "Defensive efficiency", unit: "", near: 1.5, strong: 3, explanation: "Päästetyt pisteet sataa arvioitua pallonhallintaa kohti. Pienempi luku on parempi.", explanationEn: "Points allowed per 100 estimated possessions. Lower is better." },
  { key: "three_point_attempt_rate", preference: "descriptive", label: "Kolmosten osuus", labelEn: "Three-point attempt rate", unit: "%", near: 1, strong: 2, explanation: "Kuinka suuri osa kenttäheittoyrityksistä on kolmosia. Kuvaa pelitapaa, ei paremmuutta.", explanationEn: "The share of field-goal attempts that are threes. It describes style, not quality." },
  { key: "efg_pct", preference: "higher", label: "Heittotehokkuus", labelEn: "Shot efficiency", unit: "%", near: 1, strong: 2, explanation: "Osumatarkkuus, joka huomioi kolmosen suuremman pistearvon (eFG%).", explanationEn: "Shooting efficiency that accounts for the extra value of threes (eFG%)." },
  { key: "offensive_rebound_pct", preference: "higher", label: "Hyökkäyslevypallot", labelEn: "Offensive rebounding", unit: "%", near: 1, strong: 2, explanation: "Oman joukkueen osuus hyökkäyspään levypalloista.", explanationEn: "The team's share of available offensive rebounds." },
  { key: "turnover_pct", preference: "lower", label: "Menetykset", labelEn: "Turnovers", unit: "%", near: 1, strong: 2, explanation: "Menetykset suhteessa arvioituihin pallonhallintoihin. Pienempi luku on parempi.", explanationEn: "Turnovers relative to estimated possessions. Lower is better." },
] as const;
const format = (value: number | null, unit = "", emptyText = "Ei riittävää dataa", locale = "fi-FI") => value === null ? emptyText : `${value.toLocaleString(locale, { maximumFractionDigits: 1 })}${unit}`;

const statusLabel: Record<ProfileStatus, string> = {
  above: "Yli sarjan tason",
  below: "Alle sarjan tason",
  level: "Lähellä sarjan tasoa",
};

const statusLabelEn: Record<ProfileStatus, string> = {
  above: "Above league level",
  below: "Below league level",
  level: "Near league level",
};

function ProfileStatusIcon({ status, tone }: { status: ProfileStatus; tone?: ProfileComparison["tone"] }) {
  const direction = tone === "positive" ? "above" : tone === "negative" ? "below" : status;
  return <Icon className="profile-status-icon" size={16} name={direction === "above" ? "trendUp" : direction === "below" ? "trendDown" : "minus"} />;
}

type TeamSeasonSummary = { wins: number; losses: number; pointsFor: number; pointsAgainst: number; games: number };

function summarizeTeamSeason(teamId: string, matches: SeasonMatchRecord[]): TeamSeasonSummary {
  const summary: TeamSeasonSummary = { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, games: 0 };
  for (const match of matches) {
    if (match.teams.length !== 2) continue;
    const team = match.teams.find((row) => row.source_id === teamId);
    const opponent = match.teams.find((row) => row.source_id !== teamId);
    if (!team || !opponent) continue;
    summary.games += 1;
    summary.pointsFor += team.score;
    summary.pointsAgainst += opponent.score;
    if (team.score > opponent.score) summary.wins += 1;
    else if (team.score < opponent.score) summary.losses += 1;
  }
  return summary;
}

export function TeamProfiles({ onOpenMatch, selectedTeamId, matches, matchStatus }: {
  onOpenMatch: (id: string) => void;
  selectedTeamId: string;
  matches: SeasonMatchRecord[];
  matchStatus: "loading" | "ready" | "error";
}) {
  const { language, tr } = useI18n();
  const { leagueName, leagueNameEn, data: season, seasonLabel } = useSeason();
  const teams = season.aggregate.teams;
  const team = teams.find(row => row.source_team_id === selectedTeamId);
  if (!team) return <section className="panel detail-panel">Joukkueprofiilit avautuvat tarkistetuista ottelutilastoista.</section>;
  const seasonSummary = summarizeTeamSeason(team.source_team_id, matches);
  const formatInteger = (value: number) => value.toLocaleString(language === "fi" ? "fi-FI" : "en-GB");
  const formatPerGame = (value: number) => (seasonSummary.games > 0 ? value / seasonSummary.games : 0).toLocaleString(language === "fi" ? "fi-FI" : "en-GB", { maximumFractionDigits: 1 });
  const pointDifference = seasonSummary.pointsFor - seasonSummary.pointsAgainst;
  const profileMetrics = (row: typeof team): Metrics => ({ ...row.metrics, possessions_per_game: row.metrics.estimated_possessions === null ? null : row.metrics.estimated_possessions / row.games });
  const league: Metrics = { ...season.aggregate.league.metrics, possessions_per_game: season.aggregate.league.metrics.estimated_possessions / (2 * season.aggregate.games) };
  const teamMetricRows = teams.map(row => ({ row, metrics: profileMetrics(row) }));
  const meanTeamMetric = (key: string) => {
    const values = teamMetricRows.map(item => item.metrics[key]).filter((item): item is number => typeof item === "number" && Number.isFinite(item));
    return values.length === 0 ? null : values.reduce((sum, item) => sum + item, 0) / values.length;
  };
  const getBaseline = (key: string): number | null => {
    if (key === "defensive_rating") return meanTeamMetric(key);
    if (key === "offensive_rebound_pct") {
      const totals = season.aggregate.league.totals;
      return totals.offensive_rebounds + totals.defensive_rebounds > 0
        ? 100 * totals.offensive_rebounds / (totals.offensive_rebounds + totals.defensive_rebounds)
        : null;
    }
    const value = league[key];
    return typeof value === "number" && Number.isFinite(value) ? value : meanTeamMetric(key);
  };
  const metrics = profileMetrics(team);
  const localizedDefinitions = definitions.map((definition) => ({ ...definition, label: tr(definition.label, definition.labelEn), explanation: tr(definition.explanation, definition.explanationEn) }));
  const displayValue = (value: number | null, unit = "") => format(value, unit, tr("Ei riittävää dataa", "Insufficient data"), language === "fi" ? "fi-FI" : "en-GB");
  const localizedStatus = (comparison: ProfileComparison | null) => {
    if (!comparison) return tr("Ei vertailua", "No comparison");
    if (comparison.tone === "positive") return comparison.intensity === "strong" ? tr("Selvästi parempi kuin sarjan taso", "Well above league performance") : tr("Parempi kuin sarjan taso", "Better than league performance");
    if (comparison.tone === "negative") return comparison.intensity === "strong" ? tr("Selvästi heikompi kuin sarjan taso", "Well below league performance") : tr("Heikompi kuin sarjan taso", "Worse than league performance");
    if (comparison.intensity === "strong" && comparison.status === "above") return tr("Selvästi yli sarjan tason", "Well above league level");
    if (comparison.intensity === "strong" && comparison.status === "below") return tr("Selvästi alle sarjan tason", "Well below league level");
    return tr(statusLabel[comparison.status], statusLabelEn[comparison.status]);
  };
  const threeBaseline = getBaseline("three_point_attempt_rate");
  const threeDelta = metrics.three_point_attempt_rate === null || threeBaseline === null ? null : metrics.three_point_attempt_rate - threeBaseline;
  const threeStatus = getProfileComparison(metrics.three_point_attempt_rate, threeBaseline, 1, 2, "descriptive");
  return <>
    <section id="team-profile" className="panel profile-intro overview-section-anchor" aria-labelledby="team-profile-heading">
      <div className="team-profile-header">
        <div className="team-profile-identity">
          <h2 id="team-profile-heading">{team.name}</h2>
          <p id="profile-team-context">{tr(leagueName, leagueNameEn)} {seasonLabel} · {tr("runkosarja", "regular season")}<br /><strong>{team.games}</strong> {tr("tarkistettua ottelua", "verified games")}</p>
        </div>
      </div>
      <section className="team-season-summary" aria-labelledby="team-season-summary-heading" aria-busy={matchStatus === "loading"}>
        <div className="team-season-summary-heading"><h3 id="team-season-summary-heading">{tr("Kauden saldo", "Season record")}</h3><span role="status">{matchStatus === "ready" ? tr(`${seasonSummary.games} tarkistettua ottelua`, `${seasonSummary.games} verified games`) : matchStatus === "error" ? tr("Ottelutietoja ei saatu ladattua", "Could not load game data") : tr("Ladataan ottelutietoja…", "Loading game data…")}</span></div>
        <div className="team-season-summary-grid">
          <article><span>{tr("Voitot–tappiot", "Wins–losses")}</span><strong>{matchStatus === "ready" ? `${seasonSummary.wins}–${seasonSummary.losses}` : "—"}</strong></article>
          <article><span>{tr("Tehdyt pisteet", "Points scored")}</span><strong>{matchStatus === "ready" ? formatInteger(seasonSummary.pointsFor) : "—"}</strong>{matchStatus === "ready" && <small>{formatPerGame(seasonSummary.pointsFor)} {tr("ottelua kohti", "per game")}</small>}</article>
          <article><span>{tr("Päästetyt pisteet", "Points allowed")}</span><strong>{matchStatus === "ready" ? formatInteger(seasonSummary.pointsAgainst) : "—"}</strong>{matchStatus === "ready" && <small>{formatPerGame(seasonSummary.pointsAgainst)} {tr("ottelua kohti", "per game")}</small>}</article>
          <article><span>{tr("Piste-ero", "Point differential")}</span><strong className={matchStatus === "ready" ? pointDifference > 0 ? "metric-positive" : pointDifference < 0 ? "metric-negative" : "" : ""}>{matchStatus === "ready" ? `${pointDifference > 0 ? "+" : ""}${formatInteger(pointDifference)}` : "—"}</strong><small>{tr("tehdyt − päästetyt", "scored − allowed")}</small></article>
        </div>
      </section>
      <h3 className="profile-insight-heading">{threeStatus === null ? tr("Peliprofiili muodostuu aineiston mukana", "Playing profile builds with the dataset") : threeStatus.status === "level" ? tr("Kolmosten osuus on lähellä sarjan tasoa", "Three-point share is near the league level") : threeStatus.status === "above" ? tr("Kolmosia sarjan tasoa enemmän", "More threes than the league level") : tr("Kolmosia sarjan tasoa vähemmän", "Fewer threes than the league level")}</h3>
      <p role="status" aria-live="polite">{threeDelta !== null && <>{tr(`Kolmoset muodostavat ${format(metrics.three_point_attempt_rate, "%")} heittoyrityksistä, sarjan aineistossa ${format(threeBaseline, "%")}. Ero on ${format(Math.abs(threeDelta))} prosenttiyksikköä.`, `Threes account for ${displayValue(metrics.three_point_attempt_rate, "%")} of field-goal attempts, compared with ${displayValue(threeBaseline, "%")} for the league. The difference is ${displayValue(Math.abs(threeDelta))} percentage points.`)}</>}</p>
      {threeStatus && <span className={`profile-status profile-status--${threeStatus.tone} profile-status--${threeStatus.intensity}`}><span><ProfileStatusIcon status={threeStatus.status} tone={threeStatus.tone} /></span>{localizedStatus(threeStatus)}</span>}
      <div className="profile-legend" aria-label={tr("Väriprofiilin selite", "Color profile legend")}><span className="profile-legend-item profile-legend-item--positive"><i aria-hidden="true"><ProfileStatusIcon status="above" /></i> {tr("parempi kuin sarjan taso", "better than league performance")}</span><span className="profile-legend-item profile-legend-item--level"><i aria-hidden="true"><ProfileStatusIcon status="level" /></i> {tr("lähellä sarjan tasoa", "near league level")}</span><span className="profile-legend-item profile-legend-item--negative"><i aria-hidden="true"><ProfileStatusIcon status="below" /></i> {tr("heikompi kuin sarjan taso", "worse than league performance")}</span><span className="profile-legend-item profile-legend-item--neutral"><i aria-hidden="true"><ProfileStatusIcon status="level" /></i> {tr("pelitapaa kuvaava mittari", "playing-style metric")}</span></div>
      <small>{tr(`Vertailussa ${season.aggregate.games}/${season.summary.available_played_games} ottelua. Tulokset kuvaavat saatavilla olevaa aineistoa.`, `Comparison covers ${season.aggregate.games}/${season.summary.available_played_games} games. Results describe the available dataset.`)}</small>
    </section>
    <TeamTrend key={team.source_team_id} teamId={team.source_team_id} baseline={{ ORtg: team.metrics.offensive_rating, DRtg: team.metrics.defensive_rating, "Net Rating": team.metrics.net_rating }} onOpenMatch={onOpenMatch} />
    <section id="team-league-comparison" className="profile-grid overview-section-anchor" aria-label={`${team.name}: ${tr("vertailu sarjan tasoon", "comparison with league level")}`}>
      {localizedDefinitions.map(definition => {
        const value = metrics[definition.key] ?? null;
        const baseline = getBaseline(definition.key);
        const comparison = getProfileComparison(value, baseline, definition.near, definition.strong, definition.preference);
        const values = teamMetricRows.map(item => item.metrics[definition.key]).filter((item): item is number => typeof item === "number" && Number.isFinite(item));
        const min = Math.min(...values, baseline ?? Infinity);
        const max = Math.max(...values, baseline ?? -Infinity);
        const position = (number: number) => max === min ? 50 : 5 + (number - min) / (max - min) * 90;
        return <article className="panel profile-metric" key={definition.key}>
          <div className="profile-metric-heading"><h3>{definition.label}</h3>{comparison && <span className={`profile-status profile-status--${comparison.tone} profile-status--${comparison.intensity}`}><span><ProfileStatusIcon status={comparison.status} tone={comparison.tone} /></span>{localizedStatus(comparison)}</span>}</div>
          <strong className={comparison ? `profile-value profile-value--${comparison.tone}` : "profile-value"}>{displayValue(value, definition.unit)}</strong>
          <p>{definition.explanation}</p>
          {value !== null && baseline !== null && <>
            <div className={`profile-scale profile-scale--${comparison?.tone ?? "neutral"}`} aria-label={`${definition.label}: ${localizedStatus(comparison)}`} role="img">
              {values.map((number, index) => <i className="profile-peer" key={index} style={{ left: `${position(number)}%` }} />)}
              <i className="profile-average" style={{ left: `${position(baseline)}%` }} />
              <i className="profile-selected" style={{ left: `${position(value)}%` }} />
            </div>
            <div className="profile-scale-labels"><span>{displayValue(min, definition.unit)}</span><span>{displayValue(max, definition.unit)}</span></div>
            <small>{tr("Sarjan taso", "League level")} {displayValue(baseline, definition.unit)} · {tr("ero", "difference")} {displayValue(Math.abs(value - baseline))} {definition.unit === "%" ? tr("prosenttiyksikköä", "percentage points") : definition.key === "possessions_per_game" ? tr("pallonhallintaa", "possessions") : tr("pistettä", "points")}</small>
          </>}
        </article>;
      })}
    </section>
    <section className="panel profile-intro">
      <h3>{tr("Näin luet profiilia", "How to read the profile")}</h3>
      <p>{tr("Asteikon pisteet ovat joukkueita, valkoinen viiva on sarjan taso ja korostettu rengas valitsemasi joukkue. Asteikko vaihtuu mittarin mukaan.", "The dots are teams, the white line is the league level, and the highlighted ring is the selected team. The scale changes by metric.")}</p>
      <p>{tr("Vihreä kertoo paremmasta, punainen heikommasta tuloksesta suhteessa sarjan tasoon. Menetyksissä ja puolustustehokkuudessa pienempi luku on parempi. Pallonhallintamäärä ja kolmosten osuus kuvaavat pelitapaa, joten niiden väri on neutraali.", "Green indicates better and red worse performance relative to the league. Lower turnovers and defensive rating are better. Possession volume and three-point share describe playing style, so their color is neutral.")}</p>
      <p>{tr("Tehokkuusluvut perustuvat box scoresta arvioituihin pallonhallintoihin. Vastustajien tasoa ei ole vakioitu. Kolmosten suuri osuus ei yksin tarkoita tehokasta hyökkäystä.", "Efficiency metrics use possessions estimated from the box score. Opponent strength is not adjusted for. A high three-point share does not by itself mean a more efficient offense.")}</p>
      <details><summary>{tr("Laskentatapa", "Method")}</summary><p>{tr("Prosentit lasketaan osumien ja yritysten yhteismääristä. Pallonhallinta-arvio = 2PA + 3PA + 0,44 × FTA − hyökkäyslevypallot + menetykset. ORtg ja DRtg käyttävät molempien joukkueiden pallonhallinta-arvioiden keskiarvoa.", "Percentages use total makes and attempts. Estimated possessions = 2PA + 3PA + 0.44 × FTA − offensive rebounds + turnovers. ORtg and DRtg use the average possession estimate for both teams.")}</p></details>
    </section>
  </>;
}
