import { useEffect, useMemo, useRef, useState } from "react";
import { useSeason, seasonIds, type SeasonId, type SeasonMatchRecord } from "./SeasonContext";
import { aggregateSeasonPlayers, playerAttemptsPer40, playerPerGame, playerTrueShootingPctFromTotals, progressivePlayerQualification, type SeasonPlayerRow } from "./playerStats";
import { useI18n } from "./i18n";

type MetricKey = "points" | "minutes" | "trueShooting" | "attemptsPer40" | "blocksReceived" | "plusMinus";
type Metric = { key: MetricKey; label: string; unit: "" | " min" | "%" };
type TeammateVolume = { id: string; name: string; games: number; minutes: number; attempts: number; attemptsComplete: boolean; attemptsPer40: number | null; teamShare: number | null };
type SeasonTeamContext = { id: string; name: string; games: number; attempts: number; attemptsComplete: boolean; validAttemptGames: number; playerAttempts: number; playerAttemptsComplete: boolean; playerTeamAttempts: number; playerTeamAttemptsComplete: boolean; teammates: TeammateVolume[] };
type SeasonComparisonRow = { season: SeasonId; games: number; minutes: number; minimumGames: number; minimumMinutes: number; player: SeasonPlayerRow | null; averages: Record<MetricKey, number | null>; teamContext: SeasonTeamContext | null; failed?: boolean };

function metricValue(player: SeasonPlayerRow | null, key: MetricKey) {
  if (!player) return null;
  if (key === "points") return playerPerGame(player, "points");
  if (key === "minutes") return player.games > 0 ? player.minutes / player.games : null;
  if (key === "trueShooting") return playerTrueShootingPctFromTotals(player);
  if (key === "blocksReceived") return playerPerGame(player, "blocksReceived");
  if (key === "plusMinus") return playerPerGame(player, "plusMinus");
  return playerAttemptsPer40(player);
}

function average(values: Array<number | null>) {
  const available = values.filter((value): value is number => value != null && Number.isFinite(value));
  return available.length ? available.reduce((sum, value) => sum + value, 0) / available.length : null;
}

function pointsPath(points: Array<{ x: number; y: number }>) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
}

export function PlayerSeasonComparison({ playerId, playerName, seasonLimit, phase }: { playerId: string; playerName: string; seasonLimit: SeasonId; phase: "regular" | "playoffs" }) {
  const { loadMatchesForSeason } = useSeason();
  const { language, tr } = useI18n();
  const [metricKey, setMetricKey] = useState<MetricKey>("points");
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(720);
  const [state, setState] = useState<{ rows: SeasonComparisonRow[]; loading: boolean; failures: number }>({ rows: [], loading: true, failures: 0 });
  const metrics: Metric[] = [
    { key: "points", label: tr("Pisteet / ottelu", "Points per game"), unit: "" },
    { key: "minutes", label: tr("Peliaika / ottelu", "Minutes per game"), unit: " min" },
    { key: "trueShooting", label: "TS%", unit: "%" },
    { key: "attemptsPer40", label: "FGA/40", unit: "" },
    { key: "blocksReceived", label: tr("Vastustajan torjumat heitot / ottelu", "Blocked shots received per game"), unit: "" },
    { key: "plusMinus", label: "+/− / ottelu", unit: "" },
  ];
  const selectedMetric = metrics.find((metric) => metric.key === metricKey) ?? metrics[0];
  const seasons = useMemo(() => seasonIds.filter((season) => seasonIds.indexOf(season) <= seasonIds.indexOf(seasonLimit)), [seasonLimit]);

  useEffect(() => {
    let cancelled = false;
    setState({ rows: [], loading: true, failures: 0 });
    void Promise.allSettled(seasons.map(async (season): Promise<SeasonComparisonRow> => {
      const records: SeasonMatchRecord[] = await loadMatchesForSeason(season, phase);
      const players = aggregateSeasonPlayers(records);
      const player = players.find((row) => row.id === playerId) ?? null;
      const qualification = progressivePlayerQualification(records);
      const teams = new Map<string, { id: string; name: string; games: number; attempts: number; attemptsComplete: boolean; validAttemptGames: number; playerAppearances: number; playerAttempts: number; playerAttemptsComplete: boolean; playerTeamAttempts: number; playerTeamAttemptsComplete: boolean; roster: Map<string, { name: string; games: number; minutes: number; attempts: number; attemptsComplete: boolean }> }>();
      records.forEach((record) => record.teams.forEach((team) => {
        const teamRow = teams.get(team.source_id) ?? { id: team.source_id, name: team.name, games: 0, attempts: 0, attemptsComplete: true, validAttemptGames: 0, playerAppearances: 0, playerAttempts: 0, playerAttemptsComplete: true, playerTeamAttempts: 0, playerTeamAttemptsComplete: true, roster: new Map() };
        teamRow.games += 1;
        const teamAttempts = team.stats.two_pa == null || team.stats.three_pa == null ? null : team.stats.two_pa + team.stats.three_pa;
        if (teamAttempts != null) { teamRow.attempts += teamAttempts; teamRow.validAttemptGames += 1; } else teamRow.attemptsComplete = false;
        team.players.forEach((appearance) => {
          if ((appearance.minutes ?? 0) <= 0) return;
          const attempts = appearance.stats.two_pa == null || appearance.stats.three_pa == null ? null : appearance.stats.two_pa + appearance.stats.three_pa;
          const rosterRow = teamRow.roster.get(appearance.source_player_id) ?? { name: appearance.display_name, games: 0, minutes: 0, attempts: 0, attemptsComplete: true };
          rosterRow.games += 1;
          rosterRow.minutes += appearance.minutes ?? 0;
          if (attempts != null) rosterRow.attempts += attempts; else rosterRow.attemptsComplete = false;
          teamRow.roster.set(appearance.source_player_id, rosterRow);
          if (appearance.source_player_id === playerId) {
            teamRow.playerAppearances += 1;
            if (attempts != null) teamRow.playerAttempts += attempts; else teamRow.playerAttemptsComplete = false;
            if (teamAttempts != null) teamRow.playerTeamAttempts += teamAttempts; else teamRow.playerTeamAttemptsComplete = false;
          }
        });
        teams.set(team.source_id, teamRow);
      }));
      const primaryTeam = [...teams.values()].filter((team) => team.playerAppearances > 0).sort((a, b) => b.playerAppearances - a.playerAppearances)[0];
      const teamContext: SeasonTeamContext | null = primaryTeam ? {
        id: primaryTeam.id,
        name: primaryTeam.name,
        games: primaryTeam.games,
        attempts: primaryTeam.attempts,
        attemptsComplete: primaryTeam.attemptsComplete,
        validAttemptGames: primaryTeam.validAttemptGames,
        playerAttempts: primaryTeam.playerAttempts,
        playerAttemptsComplete: primaryTeam.playerAttemptsComplete,
        playerTeamAttempts: primaryTeam.playerTeamAttempts,
        playerTeamAttemptsComplete: primaryTeam.playerTeamAttemptsComplete,
        teammates: [...primaryTeam.roster.entries()].filter(([id]) => id !== playerId).map(([id, row]) => ({
          id,
          name: row.name,
          games: row.games,
          minutes: row.minutes,
          attempts: row.attempts,
          attemptsComplete: row.attemptsComplete,
          attemptsPer40: row.minutes > 0 ? (row.attempts / row.minutes) * 40 : null,
          teamShare: primaryTeam.attemptsComplete && row.attemptsComplete && primaryTeam.attempts > 0 ? (row.attempts / primaryTeam.attempts) * 100 : null,
        })),
      } : null;
      const minLeagueGames = Math.max(2, Math.ceil(Math.max(0, ...[...teams.values()].map((team) => team.games)) / 2));
      const qualified = players.filter((row) => row.games >= minLeagueGames);
      const valuesFor = (key: MetricKey) => qualified.map((row) => metricValue(row, key));
      return {
        season,
        games: player?.games ?? 0,
        minutes: player?.minutes ?? 0,
        minimumGames: qualification.minimumGames,
        minimumMinutes: qualification.minimumMinutes,
        player,
        teamContext,
        averages: {
          points: average(valuesFor("points")),
          minutes: average(valuesFor("minutes")),
          trueShooting: average(valuesFor("trueShooting")),
          attemptsPer40: average(valuesFor("attemptsPer40")),
          blocksReceived: average(valuesFor("blocksReceived")),
          plusMinus: average(valuesFor("plusMinus")),
        },
      };
    })).then((results) => {
      if (cancelled) return;
      const failures = results.filter((result) => result.status === "rejected").length;
      const rows = results.map((result, index) => result.status === "fulfilled"
        ? result.value
        : { season: seasons[index], games: 0, minutes: 0, minimumGames: 2, minimumMinutes: 30, player: null, averages: { points: null, minutes: null, trueShooting: null, attemptsPer40: null, blocksReceived: null, plusMinus: null }, teamContext: null, failed: true });
      setState({ rows, loading: false, failures });
    });
    return () => { cancelled = true; };
  }, [loadMatchesForSeason, phase, playerId, seasons]);

  const decimal = (value: number | null) => value == null ? "—" : value.toLocaleString(language === "fi" ? "fi-FI" : "en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const displayValue = (value: number | null) => value == null ? "—" : selectedMetric.key === "plusMinus"
    ? `${value > 0 ? "+" : value < 0 ? "−" : ""}${decimal(Math.abs(value))}`
    : `${decimal(value)}${selectedMetric.unit}`;
  const chartRows = state.rows.filter((row) => !row.failed);
  const validPlayerValues = chartRows.map((row) => metricValue(row.player, metricKey)).filter((value): value is number => value != null);
  const validAverageValues = chartRows.map((row) => row.averages[metricKey]).filter((value): value is number => value != null);
  const allValues = [...validPlayerValues, ...validAverageValues];
  const qualifiedChangeRows = chartRows.filter((row) => row.player && row.games >= row.minimumGames && row.minutes >= row.minimumMinutes);
  const previousChangeRow = qualifiedChangeRows.at(-2);
  const currentChangeRow = qualifiedChangeRows.at(-1);
  const changeMetrics = previousChangeRow && currentChangeRow ? ([
    { key: "minutes" as const, label: tr("Peliaika / ottelu", "Minutes per game"), unit: tr(" min", " min"), previous: metricValue(previousChangeRow.player, "minutes"), current: metricValue(currentChangeRow.player, "minutes") },
    { key: "attemptsPer40" as const, label: "FGA / 40", unit: "", previous: metricValue(previousChangeRow.player, "attemptsPer40"), current: metricValue(currentChangeRow.player, "attemptsPer40") },
    { key: "points" as const, label: tr("Pisteet / ottelu", "Points per game"), unit: "", previous: metricValue(previousChangeRow.player, "points"), current: metricValue(currentChangeRow.player, "points") },
    { key: "trueShooting" as const, label: "TS%", unit: "%", previous: metricValue(previousChangeRow.player, "trueShooting"), current: metricValue(currentChangeRow.player, "trueShooting") },
  ]).filter((row) => row.previous != null && row.current != null) : [];
  const matchingTeamContext = previousChangeRow?.teamContext && currentChangeRow?.teamContext && previousChangeRow.teamContext.id === currentChangeRow.teamContext.id
    ? { previous: previousChangeRow.teamContext, current: currentChangeRow.teamContext }
    : null;
  const latestSeasonRow = chartRows.at(-1);
  const comparisonTeamLabel = previousChangeRow?.teamContext && currentChangeRow?.teamContext
    ? previousChangeRow.teamContext.name === currentChangeRow.teamContext.name
      ? currentChangeRow.teamContext.name
      : `${previousChangeRow.teamContext.name} → ${currentChangeRow.teamContext.name}`
    : currentChangeRow?.teamContext?.name ?? previousChangeRow?.teamContext?.name;
  const newHighVolumeTeammates = matchingTeamContext
    ? matchingTeamContext.current.teammates.filter((teammate) => !matchingTeamContext.previous.teammates.some((previous) => previous.id === teammate.id)
      && teammate.games >= currentChangeRow!.minimumGames && teammate.minutes >= currentChangeRow!.minimumMinutes && (teammate.teamShare ?? 0) >= 5)
      .sort((a, b) => (b.teamShare ?? 0) - (a.teamShare ?? 0)).slice(0, 2)
    : [];
  const signed = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${decimal(Math.abs(value))}`;
  const displayedDelta = (previous: number, current: number) => (Math.round(current * 10) - Math.round(previous * 10)) / 10;
  const changeValue = (key: MetricKey, value: number | null) => value == null ? "—" : key === "minutes" ? `${decimal(value)} min` : key === "trueShooting" ? `${decimal(value)}%` : decimal(value);
  const teamFgaPerGame = (team: SeasonTeamContext) => team.attemptsComplete && team.validAttemptGames > 0 ? team.attempts / team.validAttemptGames : null;
  const playerTeamShotShare = (team: SeasonTeamContext) => team.playerAttemptsComplete && team.playerTeamAttemptsComplete && team.playerTeamAttempts > 0 ? (team.playerAttempts / team.playerTeamAttempts) * 100 : null;
  const hasTrend = validPlayerValues.length >= 2;
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const nextWidth = Math.round(entry.contentRect.width);
      if (nextWidth > 0) setChartWidth((current) => current === nextWidth ? current : nextWidth);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [hasTrend, state.loading]);
  const chart = useMemo(() => {
    if (!allValues.length) return null;
    let min = Math.min(...allValues);
    let max = Math.max(...allValues);
    if (max === min) { const pad = Math.max(Math.abs(max) * 0.08, 1); min -= pad; max += pad; }
    else { const pad = (max - min) * 0.14; min -= pad; max += pad; }
    const width = chartWidth, height = 250, left = 54, right = 16, top = 18, bottom = 42;
    const plotWidth = width - left - right, plotHeight = height - top - bottom;
    const x = (index: number) => left + (chartRows.length < 2 ? plotWidth / 2 : (index / (chartRows.length - 1)) * plotWidth);
    const y = (value: number) => top + ((max - value) / (max - min)) * plotHeight;
    const playerPoints = chartRows.flatMap((row, index) => { const value = metricValue(row.player, metricKey); return value == null ? [] : [{ x: x(index), y: y(value), row, value }]; });
    const averagePoints = chartRows.flatMap((row, index) => { const value = row.averages[metricKey]; return value == null ? [] : [{ x: x(index), y: y(value), row, value }]; });
    return { width, height, left, right, top, bottom, plotWidth, plotHeight, x, y, min, max, playerPoints, averagePoints };
  }, [allValues, chartRows, chartWidth, metricKey]);

  return <section className="panel player-season-comparison" aria-labelledby="season-comparison-heading">
    <div className="panel-heading panel-heading--plain">
      <div><h2 id="season-comparison-heading">{tr("Kausivertailu", "Season comparison")}</h2><p className="panel-subcopy">{phase === "playoffs" ? tr("Pudotuspelit kausi kaudelta", "Playoffs season by season") : tr("Runkosarja kausi kaudelta", "Regular season season by season")}</p></div>
      <label className="season-comparison-select"><span>{tr("Mittari", "Metric")}</span><select value={metricKey} onChange={(event) => setMetricKey(event.target.value as MetricKey)}>{metrics.map((metric) => <option value={metric.key} key={metric.key}>{metric.label}</option>)}</select></label>
    </div>
    {state.loading ? <div className="season-comparison-state" role="status">{tr("Ladataan kausien tilastoja…", "Loading season statistics…")}</div> : state.failures === state.rows.length ? <div className="season-comparison-state" role="alert"><strong>{tr("Kausivertailua ei saatu ladattua", "Could not load season comparison")}</strong><p>{tr("Yritä päivittää sivu.", "Try refreshing the page.")}</p></div> : <>
      {state.failures > 0 && <p className="season-comparison-warning" role="status">{tr("Joidenkin kausien tiedot eivät latautuneet, joten vertailu on osittainen.", "Some seasons could not be loaded, so this comparison is partial.")}</p>}
      {hasTrend && chart ? <>
        <div className="season-comparison-legend" aria-hidden="true"><span className="season-comparison-legend-player">{playerName}</span><span className="season-comparison-legend-average">{tr("Sarjan keskiarvo", "League average")}</span></div>
        <div className="season-comparison-chart-wrap" ref={chartContainerRef}>
          <svg className="season-comparison-chart" viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label={`${selectedMetric.label} · ${tr("pelaajan kaudet ja sarjan keskiarvo", "player seasons and league average")}`}>
            {[0, 1, 2].map((tick) => {
              const value = chart.max - ((chart.max - chart.min) * tick) / 2;
              const y = chart.y(value);
              return <g key={tick}><line className="season-comparison-gridline" x1={chart.left} x2={chart.width - chart.right} y1={y} y2={y} /><text className="season-comparison-axis-label" x={chart.left - 9} y={y + 4} textAnchor="end">{displayValue(value)}</text></g>;
            })}
            {chart.averagePoints.length > 1 && <path className="season-comparison-average-line" d={pointsPath(chart.averagePoints)} />}
            {chart.playerPoints.length > 1 && <path className="season-comparison-player-line" d={pointsPath(chart.playerPoints)} />}
            {chart.averagePoints.map((point) => <circle className="season-comparison-average-point" key={`avg-${point.row.season}`} cx={point.x} cy={point.y} r="4"><title>{point.row.season.replace("-", "–")} · {tr("sarjan keskiarvo", "league average")}: {displayValue(point.value)}</title></circle>)}
            {chart.playerPoints.map((point) => <circle className="season-comparison-player-point" key={`player-${point.row.season}`} cx={point.x} cy={point.y} r="5"><title>{point.row.season.replace("-", "–")} · {tr("pelaaja", "player")}: {displayValue(point.value)} · {point.row.games} {tr("ottelua", "games")}</title></circle>)}
            {chartRows.map((row, index) => <text className="season-comparison-axis-label season-comparison-season-label" key={row.season} x={chart.x(index)} y={chart.height - 12} textAnchor="middle">{row.season.replace("-", "–")}</text>)}
          </svg>
        </div>
      </> : <div className="season-comparison-state"><strong>{tr("Kausia ei vielä riitä trendiin", "Not enough seasons for a trend yet")}</strong><p>{tr("Vähintään kahden kauden pelaajatilastot tarvitaan vertailukäyrään. Alla näkyvät kaudet ja pelimäärät.", "A trend needs player statistics from at least two seasons. Seasons and game counts are listed below.")}</p></div>}
      {state.rows.length > 1 && (previousChangeRow && currentChangeRow && changeMetrics.length > 0 ? <section className="season-change-panel" aria-labelledby="season-change-heading">
        <div className="season-change-heading"><div><h3 id="season-change-heading">{tr("Mitä muuttui?", "What changed?")}</h3><p>{comparisonTeamLabel && <>{comparisonTeamLabel} · </>}{previousChangeRow.season.replace("-", "–")} → {currentChangeRow.season.replace("-", "–")} · {tr("vertailussa otosrajan täyttävät kaudet", "only seasons meeting the sample threshold")}</p></div></div>
        <div className="season-change-metrics">{changeMetrics.map((metric) => <div className="season-change-metric" key={metric.key}>
          <span>{metric.label}</span>
          <strong>{changeValue(metric.key, metric.previous)} <span aria-hidden="true">→</span> {changeValue(metric.key, metric.current)}</strong>
          <small>{metric.key === "trueShooting"
            ? `${signed(displayedDelta(metric.previous!, metric.current!))} ${tr("prosenttiyksikköä", "percentage points")}`
            : `${signed(displayedDelta(metric.previous!, metric.current!))}${metric.unit}${metric.key === "points" ? tr(" / ottelu", " / game") : metric.key === "minutes" ? tr(" / ottelu", " / game") : metric.key === "attemptsPer40" ? tr(" / 40 min", " / 40 min") : ""}`}</small>
        </div>)}</div>
        {matchingTeamContext ? <div className="season-change-team-context">
          <h4>{tr(`${matchingTeamContext.current.name} · joukkueen konteksti`, `${matchingTeamContext.current.name} · team context`)}</h4>
          <div className="season-change-context-metrics">
            {teamFgaPerGame(matchingTeamContext.previous) != null && teamFgaPerGame(matchingTeamContext.current) != null && <p><span>{tr("Joukkueen kenttäheittoyritykset / ottelu", "Team field-goal attempts / game")}</span><strong>{decimal(teamFgaPerGame(matchingTeamContext.previous))} → {decimal(teamFgaPerGame(matchingTeamContext.current))} <small>({signed(displayedDelta(teamFgaPerGame(matchingTeamContext.previous)!, teamFgaPerGame(matchingTeamContext.current)!))} / {tr("ottelu", "game")})</small></strong></p>}
            {playerTeamShotShare(matchingTeamContext.previous) != null && playerTeamShotShare(matchingTeamContext.current) != null && <p><span>{tr("Pelaajan osuus joukkueen heitoista pelatuissa otteluissa", "Player share of team attempts in games played")}</span><strong>{decimal(playerTeamShotShare(matchingTeamContext.previous))}% → {decimal(playerTeamShotShare(matchingTeamContext.current))}% <small>({signed(displayedDelta(playerTeamShotShare(matchingTeamContext.previous)!, playerTeamShotShare(matchingTeamContext.current)!))} {tr("prosenttiyksikköä", "percentage points")})</small></strong></p>}
          </div>
          {newHighVolumeTeammates.length > 0 && <p className="season-change-teammates">{tr(`Kauden ${currentChangeRow.season.replace("-", "–")} ${matchingTeamContext.current.name} otteludatassa näkyy pelaajia, joita ei näy kauden ${previousChangeRow.season.replace("-", "–")} saman joukkueen otteluissa:`, `The ${currentChangeRow.season} ${matchingTeamContext.current.name} game data includes players not present in this team's ${previousChangeRow.season} games:`)} <strong>{newHighVolumeTeammates.map((teammate) => `${teammate.name} (${decimal(teammate.attemptsPer40)} FGA/40, ${decimal(teammate.teamShare)}%)`).join(" · ")}</strong></p>}
        </div> : <p className="season-change-team-context season-change-team-unavailable">{tr("Joukkueen heittovolyymin vertailu ei ole saatavilla näille kausille.", "Team shot-volume context is not available for these seasons.")}</p>}
        <p className="players-method-note season-change-caveat">{tr("Ottelutilastot näyttävät, miten pelaajan luvut ja joukkueen heittojakauma muuttuivat. Ne eivät yksin todista muutoksen syytä.", "Box scores show how the player's numbers and team shot distribution changed. They cannot prove the reason by themselves.")}</p>
        {latestSeasonRow?.player && latestSeasonRow.season !== currentChangeRow.season && <p className="season-change-sample-note">{tr(`${latestSeasonRow.season.replace("-", "–")}${latestSeasonRow.teamContext ? ` · ${latestSeasonRow.teamContext.name}` : ""}: ${latestSeasonRow.games} ottelua, alle ${latestSeasonRow.minimumGames} ottelun vertailurajan; sitä ei ole laskettu mukaan yllä olevaan vertailuun.`, `${latestSeasonRow.season.replace("-", "–")}${latestSeasonRow.teamContext ? ` · ${latestSeasonRow.teamContext.name}` : ""}: ${latestSeasonRow.games} game(s), below the ${latestSeasonRow.minimumGames}-game comparison threshold; it is not included above.`)}</p>}
      </section> : <div className="season-change-empty"><h3 id="season-change-heading">{tr("Mitä muuttui?", "What changed?")}</h3><p>{tr("Muutoksen vertailuun tarvitaan vähintään kaksi kautta, joilla pelaajan otosraja täyttyy.", "A change comparison needs at least two seasons that meet the player's sample threshold.")}</p></div>)}
      <div className="players-table-wrap season-comparison-table-wrap">
        <table className="players-table season-comparison-table">
          <caption className="sr-only">{selectedMetric.label} · {tr("kausittain", "by season")}</caption>
          <thead><tr><th scope="col">{tr("Kausi", "Season")}</th><th scope="col">{selectedMetric.label}</th><th scope="col">{tr("Sarjan keskiarvo", "League average")}</th><th scope="col">{tr("Ottelut", "Games")}</th></tr></thead>
          <tbody>{chartRows.map((row) => {
            const value = metricValue(row.player, metricKey);
            const smallSample = row.player != null && (row.games < row.minimumGames || row.minutes < row.minimumMinutes);
            return <tr key={row.season}><th scope="row">{row.season.replace("-", "–")}</th><td className="season-comparison-player-value">{displayValue(value)}</td><td>{displayValue(row.averages[metricKey])}</td><td>{row.games || "—"}{smallSample && <small className="season-comparison-sample">{tr("Pieni otos", "Small sample")}</small>}</td></tr>;
          })}</tbody>
        </table>
      </div>
      <p className="players-method-note season-comparison-method">{tr("Sarjan keskiarvo lasketaan pelaajista, jotka ovat pelanneet vähintään puolet joukkueensa otteluista (vähintään 2). Pienet pelaajaotokset näkyvät taulukossa ottelumäärän yhteydessä.", "League averages include players who appeared in at least half of their team's games (minimum 2). Small player samples are marked beside the game count.")}</p>
    </>}
  </section>;
}
