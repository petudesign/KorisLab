import { useSeason, type SeasonMatchRecord } from "./SeasonContext";
import { scheduleByMatchId } from "./schedule";
import { useI18n } from "./i18n";
import { TeamTrend } from "./TeamTrend";
import { TeamShootingChart } from "./TeamShootingChart";
import { MetricSparkline } from "./MetricSparkline";
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
type TeamGame = { id: string; date: string | null; homeName: string; awayName: string; homeScore: number; awayScore: number; opponent: string; won: boolean; verified: boolean };
type TeamGameMetric = { date: string | null; won: boolean; pointsFor: number; pointsAgainst: number };

function matchDate(match: SeasonMatchRecord) {
  return scheduleByMatchId[match.game.source_id] || match.game.scheduled_at;
}

function gameDate(value: string | null, language: string) {
  if (!value) return "—";
  const dateOnly = value.slice(0, 10);
  const date = new Date(`${dateOnly}T12:00:00Z`);
  return Number.isNaN(date.valueOf()) ? "—" : date.toLocaleDateString(language === "fi" ? "fi-FI" : "en-GB", { timeZone: "UTC", day: "numeric", month: "short" });
}

function teamInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words.slice(0, 2).map((part) => part.slice(0, 1)).join("") : words[0]?.slice(0, 2) ?? "")
    .toLocaleUpperCase("fi-FI");
}

function scheduleTimestamp(date: string | null, time: string | null) {
  return date ? new Date(`${date}T${time ?? "23:59:00"}`).getTime() : NaN;
}

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

export function TeamProfiles({ onOpenMatch, onOpenMatches, selectedTeamId, matches, matchStatus }: {
  onOpenMatch: (id: string) => void;
  onOpenMatches: () => void;
  selectedTeamId: string;
  matches: SeasonMatchRecord[];
  matchStatus: "loading" | "ready" | "error";
}) {
  const { language, tr } = useI18n();
  const { leagueName, leagueNameEn, data: season, seasonLabel, seasonId, current } = useSeason();
  const teams = season.aggregate.teams;
  const team = teams.find(row => row.source_team_id === selectedTeamId);
  if (!team) return <section className="panel detail-panel">Joukkueprofiilit avautuvat tarkistetuista ottelutilastoista.</section>;
  const seasonSummary = summarizeTeamSeason(team.source_team_id, matches);
  const winPercentage = seasonSummary.games > 0 ? 100 * seasonSummary.wins / seasonSummary.games : null;
  const teamGameMetrics: TeamGameMetric[] = matches.flatMap((match) => {
    if (match.teams.length !== 2) return [];
    const own = match.teams.find((row) => row.source_id === team.source_team_id);
    const opponent = match.teams.find((row) => row.source_id !== team.source_team_id);
    if (!own || !opponent) return [];
    return [{ date: matchDate(match), won: own.score > opponent.score, pointsFor: own.score, pointsAgainst: opponent.score }];
  }).sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  const recentTeamMetrics = teamGameMetrics.slice(-10);
  const currentTeamSchedule = seasonId === "2026-27"
    ? (current?.schedule ?? []).filter((fixture) => fixture.home.name === team.name || fixture.away.name === team.name)
    : [];
  const verifiedGameIds = new Set(matches.map((match) => match.game.source_id));
  const recentGames: TeamGame[] = seasonId === "2026-27"
    ? currentTeamSchedule
      .filter((fixture) => ["played", "finished", "completed"].includes(fixture.status.toLowerCase()) && fixture.home.score !== null && fixture.away.score !== null)
      .map((fixture) => {
        const isHome = fixture.home.name === team.name;
        const teamScore = (isHome ? fixture.home.score : fixture.away.score)!;
        const opponentScore = (isHome ? fixture.away.score : fixture.home.score)!;
        return { id: fixture.source_match_id, date: fixture.scheduled_date, homeName: fixture.home.name, awayName: fixture.away.name, homeScore: fixture.home.score!, awayScore: fixture.away.score!, opponent: isHome ? fixture.away.name : fixture.home.name, won: teamScore > opponentScore, verified: verifiedGameIds.has(fixture.source_match_id) };
      })
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
      .slice(0, 5)
    : matches.flatMap((match): TeamGame[] => {
        if (match.teams.length !== 2) return [];
        const selected = match.teams.find((row) => row.source_id === team.source_team_id);
        const opponent = match.teams.find((row) => row.source_id !== team.source_team_id);
        if (!selected || !opponent) return [];
        const home = match.teams.find((row) => row.home_away === "home") ?? match.teams[0];
        const away = match.teams.find((row) => row.home_away === "away") ?? match.teams[1];
        if (!home || !away) return [];
        return [{ id: match.game.source_id, date: matchDate(match), homeName: home.name, awayName: away.name, homeScore: home.score, awayScore: away.score, opponent: opponent.name, won: selected.score > opponent.score, verified: true }];
      }).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")).slice(0, 5);
  const nextFixture = currentTeamSchedule
    .filter((fixture) => fixture.status.toLowerCase() !== "played" && fixture.home.score === null && fixture.away.score === null && scheduleTimestamp(fixture.scheduled_date, fixture.scheduled_time) >= Date.now())
    .sort((a, b) => `${a.scheduled_date ?? "9999"} ${a.scheduled_time ?? ""}`.localeCompare(`${b.scheduled_date ?? "9999"} ${b.scheduled_time ?? ""}`))[0];
  const formatInteger = (value: number) => value.toLocaleString(language === "fi" ? "fi-FI" : "en-GB");
  const formatPerGame = (value: number) => (seasonSummary.games > 0 ? value / seasonSummary.games : 0).toLocaleString(language === "fi" ? "fi-FI" : "en-GB", { maximumFractionDigits: 1 });
  const formatDecimal = (value: number) => value.toLocaleString(language === "fi" ? "fi-FI" : "en-GB", { maximumFractionDigits: 1 });
  const formatSigned = (value: number) => `${value > 0 ? "+" : ""}${formatDecimal(value)}`;
  const pointDifference = seasonSummary.pointsFor - seasonSummary.pointsAgainst;
  const pointsPerGame = seasonSummary.games > 0 ? seasonSummary.pointsFor / seasonSummary.games : null;
  const pointsAllowedPerGame = seasonSummary.games > 0 ? seasonSummary.pointsAgainst / seasonSummary.games : null;
  const pointDifferencePerGame = seasonSummary.games > 0 ? pointDifference / seasonSummary.games : null;
  const leaguePointsPerTeamGame = season.aggregate.games > 0 ? season.aggregate.league.totals.points / (season.aggregate.games * 2) : null;
  const winPercentageDelta = winPercentage === null ? null : winPercentage - 50;
  const pointsDelta = pointsPerGame === null || leaguePointsPerTeamGame === null ? null : pointsPerGame - leaguePointsPerTeamGame;
  const pointsAllowedDelta = pointsAllowedPerGame === null || leaguePointsPerTeamGame === null ? null : pointsAllowedPerGame - leaguePointsPerTeamGame;
  const pointDifferenceDelta = pointDifferencePerGame;
  const comparisonTone = (delta: number | null, lowerIsBetter = false) => delta === null || delta === 0 ? "neutral" : (delta < 0) === lowerIsBetter ? "positive" : "negative";
  const comparison = (delta: number | null, label: string, lowerIsBetter = false, suffix = "") => {
    if (matchStatus !== "ready" || delta === null) return null;
    const tone = comparisonTone(delta, lowerIsBetter);
    return <span className={`team-summary-comparison team-summary-comparison--${tone}`} aria-label={`${label}: ${formatSigned(delta)}${suffix} ${tr("verrattuna sarjan keskiarvoon", "compared with the league average")}`}>
      <span className="team-summary-comparison-value"><Icon name={delta > 0 ? "trendUp" : delta < 0 ? "trendDown" : "minus"} size={14} /><b>{formatSigned(delta)}{suffix}</b></span>
      <small>{tr("vs. sarjan ka.", "vs. league avg.")}</small>
    </span>;
  };
  const sparklineColor = (delta: number | null, lowerIsBetter = false) => {
    const tone = comparisonTone(delta, lowerIsBetter);
    return tone === "positive" ? "var(--success-strong)" : tone === "negative" ? "var(--danger-strong)" : "var(--muted)";
  };
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
    <section id="team-profile" className="panel team-profile-banner overview-section-anchor" aria-labelledby="team-profile-heading">
      <div className="team-profile-banner-art" aria-hidden="true" />
      <div className="team-profile-banner-mark" aria-hidden="true">{teamInitials(team.name)}</div>
      <div className="team-profile-banner-copy">
        <h2 id="team-profile-heading">{team.name}</h2>
        <div className="team-profile-banner-meta" id="profile-team-context">
          <span><Icon name="games" size={14} />{tr(leagueName, leagueNameEn)} {seasonLabel}</span>
          <span><Icon name="check" size={14} />{team.games} {tr("tarkistettua ottelua", "verified games")}</span>
        </div>
      </div>
    </section>
    <section className="team-season-summary" aria-label={tr("Kauden tilastot", "Season statistics")} aria-busy={matchStatus === "loading"}>
      <div className="team-season-summary-grid">
        <article className="team-summary-card">
          <div className="team-summary-card-top"><div className="team-summary-card-label"><span className="team-summary-card-icon team-summary-card-icon--win"><Icon name="trophy" size={17} /></span><span>{tr("Voitot - tappiot", "Wins - losses")}</span></div>{comparison(winPercentageDelta, tr("Voittoprosentti", "Win percentage"), false, language === "fi" ? " %" : " pp")}</div>
          <div className="team-summary-card-value-row"><strong>{matchStatus === "ready" ? `${seasonSummary.wins}-${seasonSummary.losses}` : "—"}</strong></div>
          <div className="team-summary-card-bottom"><small>{matchStatus === "ready" ? winPercentage === null ? tr("Ei pelattuja otteluita", "No games played") : `${format(winPercentage, "%")} ${tr("voittoprosentti", "win rate")}` : "—"}</small><MetricSparkline values={recentTeamMetrics.map((game) => game.won ? 100 : 0)} label={tr("Voittoprosentti viime otteluissa", "Recent win percentage")} language={language} color={sparklineColor(winPercentageDelta)} /></div>
        </article>
        <article className="team-summary-card">
          <div className="team-summary-card-top"><div className="team-summary-card-label"><span className="team-summary-card-icon team-summary-card-icon--win"><Icon name="trendUp" size={17} /></span><span>{tr("Tehdyt pisteet", "Points scored")}</span></div>{comparison(pointsDelta, tr("Tehdyt pisteet per ottelu", "Points scored per game"))}</div>
          <div className="team-summary-card-value-row"><strong>{matchStatus === "ready" ? formatInteger(seasonSummary.pointsFor) : "—"}</strong></div>
          <div className="team-summary-card-bottom"><small>{matchStatus === "ready" && seasonSummary.games > 0 ? `${formatPerGame(seasonSummary.pointsFor)} ${tr("ottelua kohti", "per game")}` : "—"}</small><MetricSparkline values={recentTeamMetrics.map((game) => game.pointsFor)} label={tr("Tehdyt pisteet otteluittain", "Points scored by game")} language={language} color={sparklineColor(pointsDelta)} /></div>
        </article>
        <article className="team-summary-card">
          <div className="team-summary-card-top"><div className="team-summary-card-label"><span className="team-summary-card-icon team-summary-card-icon--defense"><Icon name="trendDown" size={17} /></span><span>{tr("Päästetyt pisteet", "Points allowed")}</span></div>{comparison(pointsAllowedDelta, tr("Päästetyt pisteet per ottelu", "Points allowed per game"), true)}</div>
          <div className="team-summary-card-value-row"><strong>{matchStatus === "ready" ? formatInteger(seasonSummary.pointsAgainst) : "—"}</strong></div>
          <div className="team-summary-card-bottom"><small>{matchStatus === "ready" && seasonSummary.games > 0 ? `${formatPerGame(seasonSummary.pointsAgainst)} ${tr("ottelua kohti", "per game")}` : "—"}</small><MetricSparkline values={recentTeamMetrics.map((game) => game.pointsAgainst)} label={tr("Päästetyt pisteet otteluittain", "Points allowed by game")} language={language} color={sparklineColor(pointsAllowedDelta, true)} /></div>
        </article>
        <article className="team-summary-card">
          <div className="team-summary-card-top"><div className="team-summary-card-label"><span className="team-summary-card-icon team-summary-card-icon--win"><Icon name="target" size={17} /></span><span>{tr("Piste-ero", "Point differential")}</span></div>{comparison(pointDifferenceDelta, tr("Piste-ero per ottelu", "Point differential per game"))}</div>
          <div className="team-summary-card-value-row"><strong className={matchStatus === "ready" ? pointDifference > 0 ? "metric-positive" : pointDifference < 0 ? "metric-negative" : "" : ""}>{matchStatus === "ready" ? `${pointDifference > 0 ? "+" : ""}${formatInteger(pointDifference)}` : "—"}</strong></div>
          <div className="team-summary-card-bottom"><small>{matchStatus === "ready" && pointDifferencePerGame !== null ? `${tr("tehdyt − päästetyt", "scored − allowed")} · ${formatSigned(pointDifferencePerGame)} ${tr("per ottelu", "per game")}` : tr("tehdyt − päästetyt", "scored − allowed")}</small><MetricSparkline values={recentTeamMetrics.map((game) => game.pointsFor - game.pointsAgainst)} label={tr("Piste-ero otteluittain", "Point differential by game")} language={language} color={sparklineColor(pointDifferenceDelta)} /></div>
        </article>
      </div>
    </section>
    <section className="team-game-snapshot" aria-label={tr(`${team.name}: viimeiset ottelut, seuraava ottelu ja keskeinen havainto`, `${team.name}: recent games, next game, and key insight`)}>
        <div className="team-game-snapshot-column">
          <div className="team-game-snapshot-heading"><h3>{tr("Viimeiset pelit", "Recent games")}</h3><button type="button" className="team-game-all-link" onClick={onOpenMatches}>{tr("Katso kaikki", "See all")} <Icon name="arrowOutward" size={14} /></button></div>
          {recentGames.length ? <div className="team-recent-games-wrap"><table className="team-recent-games" aria-label={tr(`${team.name}: viimeiset viisi ottelua`, `${team.name}: last five games`)}>
            <thead><tr><th scope="col">{tr("Pvm", "Date")}</th><th scope="col">{tr("Vastustaja", "Opponent")}</th><th scope="col">{tr("Tulos", "Result")}</th><th scope="col">{tr("Tehdyt", "For")}</th><th scope="col">{tr("Päästetyt", "Against")}</th><th scope="col">{tr("Piste-ero", "Diff.")}</th></tr></thead>
            <tbody>{recentGames.map((game) => {
              const isHome = game.homeName === team.name;
              const pointsFor = isHome ? game.homeScore : game.awayScore;
              const pointsAgainst = isHome ? game.awayScore : game.homeScore;
              const differential = pointsFor - pointsAgainst;
              return <tr key={game.id}>
                <td>{game.verified ? <button type="button" className="team-recent-match-open-text" onClick={() => onOpenMatch(game.id)} aria-label={`${tr("Avaa ottelu vastaan", "Open game against")} ${game.opponent}`}><time dateTime={game.date ?? undefined}>{gameDate(game.date, language)}</time></button> : <time dateTime={game.date ?? undefined}>{gameDate(game.date, language)}</time>}</td>
                <td><div className="team-recent-opponent"><span className="team-recent-match-logo" aria-hidden="true">{teamInitials(game.opponent)}</span><span>{game.opponent}</span></div></td>
                <td><span className={`team-recent-result${game.won ? " team-recent-result--win" : " team-recent-result--loss"}`}>{game.won ? tr("Voitto", "Win") : tr("Tappio", "Loss")}</span></td>
                <td className="team-recent-score">{pointsFor}</td>
                <td className="team-recent-score">{pointsAgainst}</td>
                <td className={`team-recent-score team-recent-differential${differential > 0 ? " team-recent-differential--positive" : differential < 0 ? " team-recent-differential--negative" : ""}`}>{differential > 0 ? "+" : ""}{differential}</td>
              </tr>;
            })}</tbody>
          </table></div> : <p className="team-game-empty">{matchStatus === "loading" ? tr("Ladataan otteluita…", "Loading games…") : matchStatus === "error" ? tr("Ottelutietoja ei saatu ladattua.", "Could not load game data.") : tr("Pelattuja otteluita ei vielä ole.", "There are no played games yet.")}</p>}
        </div>
        <div className="team-game-snapshot-column team-next-game">
          <div className="team-game-snapshot-heading"><h3>{tr("Seuraava ottelu", "Next game")}</h3><button type="button" className="team-game-all-link" onClick={onOpenMatches}>{tr("Kaikki ottelut", "All games")} <Icon name="arrowOutward" size={14} /></button></div>
          {nextFixture ? <>
            <div className="team-next-game-scoreboard">
              <div className="team-next-game-team"><span className="team-recent-match-logo" aria-hidden="true">{teamInitials(nextFixture.home.name)}</span><strong>{nextFixture.home.name}</strong></div>
              <div className="team-next-game-time"><time dateTime={`${nextFixture.scheduled_date ?? ""}${nextFixture.scheduled_time ? `T${nextFixture.scheduled_time}` : ""}`}>{gameDate(nextFixture.scheduled_date, language)}</time><b>{nextFixture.scheduled_time?.slice(0, 5) ?? "—"}</b></div>
              <div className="team-next-game-team"><span className="team-recent-match-logo" aria-hidden="true">{teamInitials(nextFixture.away.name)}</span><strong>{nextFixture.away.name}</strong></div>
            </div>
            {nextFixture.venue && <p className="team-next-game-venue">{nextFixture.venue}</p>}
          </> : <p className="team-game-empty">{seasonId === "2026-27" ? tr("Seuraavaa ottelua ei ole vielä päivätty.", "No upcoming game with a confirmed date.") : tr("Seuraava ottelu näkyy kuluvan kauden ohjelmassa.", "Upcoming games appear in the current season schedule.")}</p>}
        </div>
        <section className="team-game-snapshot-column team-key-insight" aria-labelledby="team-key-insight-heading">
          <div className="team-game-snapshot-heading"><h3 id="team-key-insight-heading">{tr("Keskeinen havainto", "Key insight")}</h3></div>
          <strong className="team-key-insight-title">{threeStatus === null ? tr("Heittoprofiili tarkentuu datan karttuessa", "Shooting profile will sharpen as data grows") : threeStatus.status === "level" ? tr("Kolmosten osuus on lähellä sarjan tasoa", "Three-point share is near the league level") : threeStatus.status === "above" ? tr("Kolmosia sarjan tasoa enemmän", "More threes than the league level") : tr("Kolmosia sarjan tasoa vähemmän", "Fewer threes than the league level")}</strong>
          <p>{threeDelta === null ? tr("Kolmosten osuudesta ei ole vielä riittävästi vertailukelpoista tietoa.", "There is not enough comparable data for three-point share yet.") : tr(`Kolmoset muodostavat ${format(metrics.three_point_attempt_rate, "%")} heittoyrityksistä, sarjan taso on ${format(threeBaseline, "%")}. Ero ${format(Math.abs(threeDelta))} prosenttiyksikköä.`, `Threes account for ${displayValue(metrics.three_point_attempt_rate, "%")} of attempts, compared with ${displayValue(threeBaseline, "%")} for the league. The difference is ${displayValue(Math.abs(threeDelta))} percentage points.`)}</p>
          {threeDelta !== null && <div className="team-key-insight-comparison" aria-label={tr("Kolmosten yritysosuus verrattuna sarjan tasoon", "Three-point attempt share compared with the league")}>
            <div><span>{team.name}</span><b>{format(metrics.three_point_attempt_rate, "%")}</b></div>
            <span className="team-key-insight-track" aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, metrics.three_point_attempt_rate ?? 0))}%` }} /></span>
            <div><span>{tr("Sarjan keskiarvo", "League average")}</span><b>{format(threeBaseline, "%")}</b></div>
            <span className="team-key-insight-track team-key-insight-track--league" aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, threeBaseline ?? 0))}%` }} /></span>
          </div>}
          {threeStatus && <span className={`profile-status profile-status--${threeStatus.tone} profile-status--${threeStatus.intensity}`}><span><ProfileStatusIcon status={threeStatus.status} tone={threeStatus.tone} /></span>{localizedStatus(threeStatus)}</span>}
        </section>
      </section>
    <div className="team-profile-analysis">
      <TeamShootingChart teamName={team.name} teamTotals={team.totals} leagueTotals={season.aggregate.league.totals} />
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
    </div>
    <section className="panel profile-intro">
      <h3>{tr("Näin luet profiilia", "How to read the profile")}</h3>
      <p>{tr("Asteikon pisteet ovat joukkueita, valkoinen viiva on sarjan taso ja korostettu rengas valitsemasi joukkue. Asteikko vaihtuu mittarin mukaan.", "The dots are teams, the white line is the league level, and the highlighted ring is the selected team. The scale changes by metric.")}</p>
      <p>{tr("Vihreä kertoo paremmasta, punainen heikommasta tuloksesta suhteessa sarjan tasoon. Menetyksissä ja puolustustehokkuudessa pienempi luku on parempi. Pallonhallintamäärä ja kolmosten osuus kuvaavat pelitapaa, joten niiden väri on neutraali.", "Green indicates better and red worse performance relative to the league. Lower turnovers and defensive rating are better. Possession volume and three-point share describe playing style, so their color is neutral.")}</p>
      <p>{tr("Tehokkuusluvut perustuvat box scoresta arvioituihin pallonhallintoihin. Vastustajien tasoa ei ole vakioitu. Kolmosten suuri osuus ei yksin tarkoita tehokasta hyökkäystä.", "Efficiency metrics use possessions estimated from the box score. Opponent strength is not adjusted for. A high three-point share does not by itself mean a more efficient offense.")}</p>
      <details><summary>{tr("Laskentatapa", "Method")}</summary><p>{tr("Prosentit lasketaan osumien ja yritysten yhteismääristä. Pallonhallinta-arvio = 2PA + 3PA + 0,44 × FTA − hyökkäyslevypallot + menetykset. ORtg ja DRtg käyttävät molempien joukkueiden pallonhallinta-arvioiden keskiarvoa.", "Percentages use total makes and attempts. Estimated possessions = 2PA + 3PA + 0.44 × FTA − offensive rebounds + turnovers. ORtg and DRtg use the average possession estimate for both teams.")}</p></details>
    </section>
  </>;
}
