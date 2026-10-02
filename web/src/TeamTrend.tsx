import { useEffect, useId, useMemo, useState } from "react";
import { estimatedPossessions } from "./TeamGameSplit";
import { scheduleByMatchId } from "./schedule";
import { useI18n } from "./i18n";
import { useSeason } from "./SeasonContext";
import { Icon } from "./Icon";

type Match = typeof import("../../data/normalized/season_verified.json")["matches"][number];
type Metric = "ORtg" | "DRtg" | "Net Rating";
const valueTone = (value: number) => value > 0 ? "positive" : value < 0 ? "negative" : "neutral";

export function buildTeamTrend(matches: Match[], teamId: string) {
  return matches.flatMap(match => {
    const team = match.teams.find(t => t.source_id === teamId);
    const opponent = match.teams.find(t => t.source_id !== teamId);
    if (!team || !opponent || match.teams.length !== 2) return [];
    const own = estimatedPossessions(team.stats);
    const other = estimatedPossessions(opponent.stats);
    const date = scheduleByMatchId[match.game.source_id] ?? match.game.scheduled_at;
    if (own === null || other === null || own + other <= 0 || !date || !Number.isFinite(Date.parse(date))) return [];
    const possessions = (own + other) / 2;
    return [{ id: match.game.source_id, date, teamName: team.name, opponent: opponent.name, home: team.home_away === "home", points: team.score, against: opponent.score,
      ownPossessions: own, opponentPossessions: other, sharedPossessions: possessions,
      ORtg: 100 * team.score / possessions, DRtg: 100 * opponent.score / possessions, "Net Rating": 100 * (team.score - opponent.score) / possessions }];
  }).sort((a, b) => Date.parse(a.date) - Date.parse(b.date) || a.id.localeCompare(b.id));
}

export function TeamTrend({ teamId, baseline, onOpenMatch }: { teamId: string; baseline: Record<Metric, number>; onOpenMatch: (id: string) => void }) {
  const { tr, language } = useI18n();
  const { loadMatches } = useSeason();
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [metric, setMetric] = useState<Metric>("Net Rating");
  const [selected, setSelected] = useState<string | null>(null);
  const chartId = useId();
  useEffect(() => {
    let cancelled = false;
    setError(false);
    loadMatches().then(matches => { if (!cancelled) setMatches(matches); }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [attempt, loadMatches]);
  const rows = useMemo(() => buildTeamTrend(matches ?? [], teamId), [matches, teamId]);
  const active = rows.find(row => row.id === selected) ?? rows.at(-1);
  const rolling = rows.map((_, i) => i < 4 ? null : rows.slice(i - 4, i + 1).reduce((sum, row) => sum + row[metric], 0) / 5);
  const isNetRating = metric === "Net Rating";
  const values = [...rows.map(row => row[metric]), baseline[metric], ...(isNetRating ? [0] : [])];
  const low = Math.floor((Math.min(...values) - 5) / 10) * 10;
  const high = Math.ceil((Math.max(...values) + 5) / 10) * 10;
  const x = (i: number) => 55 + (rows.length < 2 ? .5 : i / (rows.length - 1)) * 690;
  const y = (value: number) => 260 - (value - low) / (high - low) * 225;
  const fmt = (value: number) => value.toLocaleString(language === "fi" ? "fi-FI" : "en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const signed = (value: number) => `${value > 0 ? "+" : ""}${fmt(value)}`;
  const averagePoints = rolling.flatMap((value, i) => value === null ? [] : [`${x(i)},${y(value)}`]).join(" ");
  const ticks = [0, 1, 2, 3, 4].map(i => low + (high - low) * i / 4);
  if (isNetRating && !ticks.includes(0)) {
    // Keep the zero reference legible without crowding nearby axis labels.
    const nearby = ticks.findIndex(value => Math.abs(y(value) - y(0)) < 16);
    if (nearby !== -1) ticks.splice(nearby, 1);
    ticks.push(0);
  }
  ticks.sort((a, b) => a - b);
  const difference = active ? active[metric] - baseline[metric] : 0;
  const dateLabel = (date: string) => new Date(date).toLocaleDateString(language === "fi" ? "fi-FI" : "en-GB", { timeZone: "Europe/Helsinki", day: "numeric", month: "numeric" });
  return <section id="team-season-development" className="panel team-trend overview-section-anchor" aria-labelledby="team-trend-heading">
    <h3 id="team-trend-heading">{tr("Kauden kehitys", "Season development")}</h3>
    <p className="panel-subcopy">{tr("Näkyykö viime otteluissa muutos? Valitse ottelu tutkiaksesi sen lukuja.", "Is recent form changing? Select a game to inspect its numbers.")}</p>
    <div className="team-trend-controls">
      <label>{tr("Mittari", "Metric")} <select value={metric} onChange={e => setMetric(e.target.value as Metric)}>{(["ORtg", "DRtg", "Net Rating"] as const).map(key => <option key={key}>{key}</option>)}</select></label>
      <span>{metric === "DRtg" ? tr("Pienempi on parempi", "Lower is better") : tr("Suurempi on parempi", "Higher is better")}</span>
    </div>
    {error ? <p role="alert">{tr("Otteluiden lataus epäonnistui.", "Could not load games.")} <button className="outline-button" onClick={() => setAttempt(n => n + 1)}>{tr("Yritä uudelleen", "Retry")}</button></p> : matches === null ? <p role="status">{tr("Ladataan otteluita…", "Loading games…")}</p> : !rows.length ? <p>{tr("Kehityskuvaajaan ei ole riittäviä ottelutietoja.", "No complete game data for the trend.")}</p> : <>
      <div className="team-trend-legend"><span>● {tr("Ottelu", "Game")}</span><span>━ {tr("5 ottelun keskiarvo", "5-game average")}</span><span>┄ {tr("Oma kausitaso", "Season baseline")}: <b data-tone={isNetRating ? valueTone(baseline[metric]) : "neutral"}>{isNetRating ? signed(baseline[metric]) : fmt(baseline[metric])}</b></span></div>
      {isNetRating && <p className="team-trend-sign-key"><span data-tone="positive">+ {tr("Positiivinen", "Positive")}</span><span data-tone="negative">− {tr("Negatiivinen", "Negative")}</span></p>}
      <div className="team-trend-chart">
        <svg viewBox="0 0 800 310" role="group" aria-label={tr(`${metric}: ottelut aikajärjestyksessä`, `${metric}: games in chronological order`)}>
          {isNetRating && <defs>
            <clipPath id={`${chartId}-positive`}><rect x="0" y="0" width="800" height={y(0)} /></clipPath>
            <clipPath id={`${chartId}-negative`}><rect x="0" y={y(0)} width="800" height={310 - y(0)} /></clipPath>
          </defs>}
          {ticks.map(value => <g key={value}><line x1="55" x2="745" y1={y(value)} y2={y(value)} className={isNetRating && value === 0 ? "team-trend-zero" : "team-trend-grid"} /><text x="45" y={y(value) + 4} textAnchor="end">{fmt(value)}</text></g>)}
          <line x1="55" x2="745" y1={y(baseline[metric])} y2={y(baseline[metric])} className="team-trend-baseline" />
          {isNetRating ? <>
            <polyline points={averagePoints} className="team-trend-average team-trend-average--positive" clipPath={`url(#${chartId}-positive)`} />
            <polyline points={averagePoints} className="team-trend-average team-trend-average--negative" clipPath={`url(#${chartId}-negative)`} />
          </> : <polyline points={averagePoints} className="team-trend-average" />}
          {rows.map((row, i) => <g key={row.id} role="button" tabIndex={0} aria-pressed={active?.id === row.id} aria-label={`${dateLabel(row.date)} ${row.opponent}: ${metric} ${isNetRating ? signed(row[metric]) : fmt(row[metric])}`} onClick={() => setSelected(row.id)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(row.id); } }} className="team-trend-point" data-tone={isNetRating ? valueTone(row[metric]) : "neutral"}><circle cx={x(i)} cy={y(row[metric])} r="14" fill="transparent" /><circle cx={x(i)} cy={y(row[metric])} r={active?.id === row.id ? 7 : 4} className={active?.id === row.id ? "selected" : ""} /></g>)}
          {[...new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1])].map(i => <text key={i} x={x(i)} y="287" textAnchor="middle">{dateLabel(rows[i].date)}</text>)}
        </svg>
      </div>
      <label className="team-trend-game-label">{tr("Tutki ottelua", "Inspect game")}<select value={active?.id} onChange={e => setSelected(e.target.value)}>{rows.map(row => <option key={row.id} value={row.id}>{dateLabel(row.date)} · {row.opponent} · {row.points}–{row.against}</option>)}</select></label>
      {active && <div className="team-trend-readout" aria-live="polite"><strong>{dateLabel(active.date)} · {active.opponent} · {active.home ? tr("koti", "home") : tr("vieras", "away")} · {active.points}–{active.against}</strong><div>{(["ORtg", "DRtg", "Net Rating"] as const).map(key => <span key={key}>{key} <b data-tone={key === "Net Rating" ? valueTone(active[key]) : "neutral"}>{key === "Net Rating" ? signed(active[key]) : fmt(active[key])}</b></span>)}</div><p>{tr("Ero omaan kausitasoon", "Difference from season baseline")} ({metric}): <b data-tone={valueTone(difference * (metric === "DRtg" ? -1 : 1))}>{signed(difference)}</b></p><p className="team-trend-possession-note">{tr(`Arvioidut pallonhallinnat: ${active.teamName} ${fmt(active.ownPossessions)} · ${active.opponent} ${fmt(active.opponentPossessions)}. ORtg ja DRtg käyttävät näiden keskiarvoa ${fmt(active.sharedPossessions)}.`, `Estimated possessions: ${active.teamName} ${fmt(active.ownPossessions)} · ${active.opponent} ${fmt(active.opponentPossessions)}. ORtg and DRtg use their average, ${fmt(active.sharedPossessions)}.`)}<br />{tr("ORtg = joukkueen pisteet / yhteinen arvio × 100. DRtg = vastustajan pisteet / sama arvio × 100.", "ORtg = team points / shared estimate × 100. DRtg = opponent points / the same estimate × 100.")}</p><button className="outline-button" onClick={() => onOpenMatch(active.id)}>{tr("Avaa ottelun analyysi", "Open game analysis")} <Icon name="arrowOutward" size={16} /></button></div>}
      <p className="scratchpad-note">{tr("Viiva on viimeisten viiden ottelun lukujen keskiarvo ja alkaa viidennestä ottelusta. Pisteet ovat tasavälein ottelujärjestyksessä. Tehokkuusluvut perustuvat arvioituihin pallonhallintoihin; vastustajan tasoa ei ole vakioitu.", "The line averages the last five game ratings, starting at game five. Points are equally spaced in game order. Ratings use estimated possessions; opponent strength is not adjusted.")}</p>
    </>}
  </section>;
}
