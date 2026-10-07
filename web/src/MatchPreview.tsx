import { useMemo } from "react";
import { isCompletedScheduleStatus, isLiveScheduleStatus, type ScheduleMatch, type SeasonMatchRecord } from "./SeasonContext";
import { useI18n } from "./i18n";

type PreviewMetric = "points" | "rebounds" | "turnovers" | "threePct";
type TeamPreview = { average: Partial<Record<PreviewMetric, number>>; samples: Partial<Record<PreviewMetric, number>>; games: ScheduleMatch[] };

function teamNameKey(name: string) {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fi-FI").replace(/\s+/g, " ").trim();
}

function isBeforeFixture(game: ScheduleMatch, fixture: ScheduleMatch) {
  if (!game.scheduled_date || !fixture.scheduled_date) return false;
  if (game.scheduled_date !== fixture.scheduled_date) return game.scheduled_date < fixture.scheduled_date;
  if (!game.scheduled_time || !fixture.scheduled_time) return false;
  return game.scheduled_time < fixture.scheduled_time;
}

function summarizeTeam(teamId: string, fixture: ScheduleMatch, schedule: ScheduleMatch[], matches: SeasonMatchRecord[]): TeamPreview {
  const previousGames = schedule.filter((game) => game.source_match_id !== fixture.source_match_id && isBeforeFixture(game, fixture) &&
    isCompletedScheduleStatus(game.status) && game.home.score !== null && game.away.score !== null &&
    (game.home.source_team_id === teamId || game.away.source_team_id === teamId));
  const previousGamesById = new Map(previousGames.map((game) => [game.source_match_id, game]));
  const stats = matches.flatMap((record) => {
    const scheduleGame = previousGamesById.get(record.game.source_id);
    if (!scheduleGame) return [];
    const scheduleTeam = scheduleGame.home.source_team_id === teamId ? scheduleGame.home : scheduleGame.away;
    const statsTeam = record.teams.find((gameTeam) => gameTeam.source_id === teamId)
      ?? record.teams.find((gameTeam) => teamNameKey(gameTeam.name) === teamNameKey(scheduleTeam.name));
    return statsTeam ? [statsTeam.stats] : [];
  });
  const sum = (key: string) => {
    const values = stats.map((row) => row[key as keyof typeof row]).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    return { total: values.reduce((total, value) => total + value, 0), count: values.length };
  };
  const perGame = (key: string) => {
    const value = sum(key);
    return { average: value.count ? value.total / value.count : undefined, sample: value.count };
  };
  const points = perGame("points"), rebounds = perGame("rebounds"), turnovers = perGame("turnovers");
  const threePointRows = stats.filter((row) => typeof row.three_pm === "number" && typeof row.three_pa === "number");
  const madeTotal = threePointRows.reduce((total, row) => total + row.three_pm!, 0);
  const attemptedTotal = threePointRows.reduce((total, row) => total + row.three_pa!, 0);
  return {
    average: { points: points.average, rebounds: rebounds.average, turnovers: turnovers.average, threePct: attemptedTotal ? 100 * madeTotal / attemptedTotal : undefined },
    samples: { points: points.sample, rebounds: rebounds.sample, turnovers: turnovers.sample, threePct: threePointRows.length },
    games: previousGames.sort((a, b) => `${b.scheduled_date} ${b.scheduled_time ?? ""}`.localeCompare(`${a.scheduled_date} ${a.scheduled_time ?? ""}`)).slice(0, 5),
  };
}

export function MatchPreview({ fixture, schedule, matches, onOpenMatch }: {
  fixture: ScheduleMatch; schedule: ScheduleMatch[]; matches: SeasonMatchRecord[]; onOpenMatch: (id: string) => void;
}) {
  const { tr, language } = useI18n();
  const home = useMemo(() => summarizeTeam(fixture.home.source_team_id, fixture, schedule, matches), [fixture, schedule, matches]);
  const away = useMemo(() => summarizeTeam(fixture.away.source_team_id, fixture, schedule, matches), [fixture, schedule, matches]);
  const live = isLiveScheduleStatus(fixture.status);
  const played = isCompletedScheduleStatus(fixture.status);
  const rows: { key: PreviewMetric; label: string; suffix: string }[] = [
    { key: "points", label: tr("Pisteitä ottelussa", "Points per game"), suffix: "" },
    { key: "rebounds", label: tr("Levypalloja ottelussa", "Rebounds per game"), suffix: "" },
    { key: "turnovers", label: tr("Menetyksiä ottelussa", "Turnovers per game"), suffix: "" },
    { key: "threePct", label: tr("Kolmosten osumatarkkuus", "Three-point accuracy"), suffix: "%" },
  ];
  const format = (value: number | undefined, suffix: string) => value === undefined ? "—" : `${value.toLocaleString(language === "fi" ? "fi-FI" : "en-GB", { maximumFractionDigits: 1 })}${suffix}`;
  const date = fixture.scheduled_date ? new Intl.DateTimeFormat(language === "fi" ? "fi-FI" : "en-GB", { day: "numeric", month: "numeric", year: "numeric", timeZone: "Europe/Helsinki" }).format(new Date(`${fixture.scheduled_date}T12:00:00Z`)) : tr("Päivä vahvistetaan", "Date to be confirmed");
  const period = live ? tr("Ottelu käynnissä", "Game in progress") : played ? tr("Pelattu · box score odottaa tarkistusta", "Final · box score pending verification") : tr("Otteluennakko", "Game preview");
  return <div className="match-preview">
    <section className="panel match-preview-score" aria-labelledby="match-preview-title">
      <div className="match-preview-eyebrow">{period}</div>
      <h2 id="match-preview-title">{fixture.home.name} – {fixture.away.name}</h2>
      <p>{date}{fixture.scheduled_time ? ` · ${fixture.scheduled_time.slice(0, 5)}` : ""}{fixture.venue ? ` · ${fixture.venue}` : ""}</p>
      {fixture.home.score !== null && fixture.away.score !== null && <strong className="match-preview-live-score">{fixture.home.score}–{fixture.away.score}</strong>}
    </section>

    <section className="panel match-preview-context" aria-labelledby="match-preview-context-title">
      <div className="panel-heading panel-heading--plain"><div><h2 id="match-preview-context-title">{tr("Joukkueiden tilanne ennen tätä ottelua", "Team form before this game")}</h2><p className="panel-subcopy">{tr("Keskiarvot lasketaan aiempien otteluiden tarkistetuista box scoreista. Rivin alla näkyy, monesta ottelusta kyseinen luku löytyy.", "Averages use verified box scores from earlier games. The count below each figure shows how many games have that statistic available.")}</p></div></div>
      <div className="match-preview-table-wrap"><table className="match-preview-table">
        <thead><tr><th scope="col">{tr("Mittari", "Metric")}</th><th scope="col">{fixture.home.name}</th><th scope="col">{fixture.away.name}</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.key}><th scope="row">{row.label}</th>
          {[home, away].map((team, index) => {
            const sample = team.samples[row.key] ?? 0;
            const sampleLabel = language === "fi"
              ? `${sample} ${sample === 1 ? "ottelu, josta luku löytyy" : "ottelua, joista luku löytyy"}`
              : `${sample} ${sample === 1 ? "game with data" : "games with data"}`;
            return <td key={index}>{format(team.average[row.key], row.suffix)}<small>{sampleLabel}</small></td>;
          })}
        </tr>)}</tbody>
      </table></div>
      <div className="match-preview-recent"><h3>{tr("Viimeisimmät tulokset ennen ottelua", "Recent results before this game")}</h3>
        <div className="match-preview-recent-columns">{[{ id: fixture.home.source_team_id, name: fixture.home.name, games: home.games }, { id: fixture.away.source_team_id, name: fixture.away.name, games: away.games }].map((team) => <section key={team.name} aria-label={team.name}>
          <h4>{team.name}</h4>
          {team.games.length ? <ol>{team.games.map((game) => {
            const isHome = game.home.source_team_id === team.id;
            const scored = isHome ? game.home.score! : game.away.score!;
            const allowed = isHome ? game.away.score! : game.home.score!;
            const won = scored > allowed;
            const gameDate = game.scheduled_date ? new Intl.DateTimeFormat(language === "fi" ? "fi-FI" : "en-GB", { day: "numeric", month: "numeric" }).format(new Date(`${game.scheduled_date}T12:00:00Z`)) : "—";
            return <li key={game.source_match_id}><button type="button" onClick={() => onOpenMatch(game.source_match_id)} aria-label={`${game.home.name} ${game.home.score}–${game.away.score} ${game.away.name}`}>
              <span data-result={won ? "win" : "loss"}>{tr(won ? "V" : "H", won ? "W" : "L")}</span><strong>{scored}–{allowed}</strong><small>{gameDate}</small>
            </button></li>;
          })}</ol> : <p>{tr("Ei aiempia pelattuja otteluita.", "No previous games played.")}</p>}
        </section>)}</div>
      </div>
      <p className="match-preview-method">{tr("Tilastorivillä näkyy kunkin luvun oma ottelumäärä. Viimeiset tulokset on järjestetty ottelupäivän mukaan. Ennakko kuvaa aiempia otteluita, ei ennusta tämän ottelun lopputulosta.", "Each statistic shows its own game count. Recent results are ordered by game date. This preview describes prior games and does not predict the result.")}</p>
    </section>
  </div>;
}
