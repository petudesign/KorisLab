import { useMemo, useState } from "react";
import { isCompletedScheduleStatus, isLiveScheduleStatus, useSeason, type ScheduleMatch } from "./SeasonContext";
import { useI18n } from "./i18n";
import { Icon } from "./Icon";
import { TeamLogo } from "./TeamLogo";

function isPlayed(match: ScheduleMatch) {
  return isCompletedScheduleStatus(match.status);
}

function compareScheduleMatches(a: ScheduleMatch, b: ScheduleMatch) {
  const aPlayed = isPlayed(a);
  const bPlayed = isPlayed(b);
  if (aPlayed !== bPlayed) return aPlayed ? -1 : 1;

  const aDate = a.scheduled_date ? `${a.scheduled_date} ${a.scheduled_time ?? ""}` : null;
  const bDate = b.scheduled_date ? `${b.scheduled_date} ${b.scheduled_time ?? ""}` : null;
  if (!aDate && !bDate) return 0;
  if (!aDate) return 1;
  if (!bDate) return -1;
  return aPlayed ? bDate.localeCompare(aDate) : aDate.localeCompare(bDate);
}

function scheduleDate(match: ScheduleMatch, language: string) {
  if (!match.scheduled_date) return language === "fi" ? "Aika vahvistetaan" : "Time to be confirmed";
  // Schedule dates and times are Finnish local wall time, not UTC timestamps.
  const date = new Date(`${match.scheduled_date}T12:00:00Z`);
  const label = date.toLocaleDateString(language === "fi" ? "fi-FI" : "en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "numeric", year: "numeric" });
  return `${label}${match.scheduled_time ? ` · ${match.scheduled_time.slice(0, 5)}` : ""}`;
}

export function CurrentSeasonPending({ onOpenMatches }: { onOpenMatches: () => void }) {
  const { current, loading, error, refreshCurrent } = useSeason();
  const { tr, language } = useI18n();
  const next = current?.schedule.find((match) => !isPlayed(match) && !isLiveScheduleStatus(match.status));
  return <section className="panel current-season-pending">
    <h2>{error && !current ? tr("Kauden lataus epäonnistui", "Could not load the season") : !current && loading ? tr("Ladataan kautta 2026–27…", "Loading 2026–27…") : tr("Kausi 2026–27 on valmiina seurattavaksi", "The 2026–27 season is ready to follow")}</h2>
    <p>{tr("Otteluohjelma on julkaistu. Pääluvut, pelaajat ja joukkueanalyysit avautuvat, kun pelatuista otteluista on tarkistettuja tilastoja.", "The schedule is published. Season metrics, players and team analysis open when verified game statistics are available.")}</p>
    {current && <div className="current-season-facts"><span><strong>{current.schedule_summary.games}</strong>{tr("ottelua ohjelmassa", "scheduled games")}</span><span><strong>{current.schedule_summary.played_games}</strong>{tr("pelattua ottelua", "played games")}</span><span><strong>{current.summary.valid_games}</strong>{tr("tarkistettua box scorea", "verified box scores")}</span></div>}
    {next && <div className="current-season-next"><span>{tr("Seuraava ottelu", "Next game")}</span><h3>{next.home.name} – {next.away.name}</h3><p>{scheduleDate(next, language)}{next.venue ? ` · ${next.venue}` : ""}</p></div>}
    <button className="outline-button" onClick={onOpenMatches}>{tr("Avaa otteluohjelma", "Open schedule")} <Icon name="arrowOutward" size={16} /></button>
    {error && <button className="outline-button" onClick={() => void refreshCurrent()}>{tr("Yritä latausta uudelleen", "Retry loading")}</button>}
  </section>;
}

export function CurrentSeasonMatches({ onOpenMatch }: { onOpenMatch: (id: string) => void }) {
  const { leagueName, leagueNameEn, current, loading, error, refreshCurrent } = useSeason();
  const { tr, language } = useI18n();
  const [query, setQuery] = useState("");
  const [team, setTeam] = useState("all");
  const [status, setStatus] = useState("all");
  const rows = useMemo(() => (current?.schedule ?? []).filter((row) => {
    return (team === "all" || [row.home.name, row.away.name].includes(team)) &&
      (status === "all" || (status === "played" ? isPlayed(row) : status === "upcoming" ? !isPlayed(row) && !isLiveScheduleStatus(row.status) : true)) &&
      `${row.home.name} ${row.away.name} ${row.source_match_id}`.toLocaleLowerCase("fi-FI").includes(query.trim().toLocaleLowerCase("fi-FI"));
  }).sort(compareScheduleMatches), [current, team, status, query]);
  const verified = new Set(current?.matches.map((match) => match.game.source_id));
  return <>
    <section className="matches-toolbar panel">
      <div><strong>{tr(leagueName, leagueNameEn)} · 2026–27</strong><p>{tr("Otteluohjelma ja tulokset · ajat Suomen aikaa. Box score -analyysi avautuu tilastojen tarkistuksen jälkeen.", "Schedule and results · Finnish local time. Box score analysis opens after statistics are verified.")}</p></div>
      <div className="matches-toolbar-controls"><label>{tr("Hae otteluista", "Search games")}<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tr("Joukkue tai ottelu-ID", "Team or game ID")} /></label><label>{tr("Rajaa joukkueella", "Filter by team")}<select value={team} onChange={(event) => setTeam(event.target.value)}><option value="all">{tr("Kaikki joukkueet", "All teams")}</option>{current?.schedule_summary.teams.map((name) => <option key={name}>{name}</option>)}</select></label></div>
    </section>
    <section className="matches-panel panel" aria-labelledby="current-matches-heading">
      <div className="matches-panel-heading"><div><h2 id="current-matches-heading">{tr("Otteluohjelma ja tulokset", "Schedule and results")}</h2><p>{current ? `${current.schedule_summary.games} ${tr("ohjelmassa", "scheduled")} · ${current.schedule_summary.played_games} ${tr("pelattua", "played")}` : tr("Ladataan ohjelmaa…", "Loading schedule…")}</p></div><span>{rows.length} / {current?.schedule.length ?? "—"}</span></div>
      <div className="current-schedule-filters"><label>{tr("Näytä ottelut", "Show games")}<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">{tr("Kaikki ottelut", "All games")}</option><option value="upcoming">{tr("Tulevat", "Upcoming")}</option><option value="played">{tr("Pelatut", "Played")}</option></select></label><div><p>{current ? `${tr("Päivitetty", "Updated")}: ${new Date(current.updated_at).toLocaleString(language === "fi" ? "fi-FI" : "en-GB", { timeZone: "Europe/Helsinki", dateStyle: "short", timeStyle: "short" })}` : ""}</p><button className="text-button" disabled={loading} onClick={() => void refreshCurrent()}>{loading ? tr("Ladataan…", "Loading…") : tr("Lataa päivitykset", "Load updates")}</button></div></div>
      {error && <p role="status" className="current-schedule-error">{tr("Päivityksen lataus epäonnistui. Näytämme viimeksi ladatut tiedot.", "Could not load updates. Showing the last loaded data.")}</p>}
      {!current ? <div className="match-list-empty"><strong>{error ? tr("Otteluohjelmaa ei voitu ladata", "Could not load the schedule") : tr("Ladataan otteluohjelmaa…", "Loading schedule…")}</strong></div> : rows.length === 0 ? <div className="match-list-empty"><strong>{tr("Ei otteluita tässä rajauksessa", "No games with these filters")}</strong><p>{status === "played" && current.schedule_summary.played_games === 0 ? tr("Kautta ei ole vielä pelattu. Valitse Tulevat tai Kaikki ottelut.", "No games have been played yet. Select Upcoming or All games.") : tr("Muuta hakua tai rajausta.", "Change the search or filters.")}</p></div> : <div className="match-list" role="list">{rows.map((row) => {
        const played = isPlayed(row);
        const live = isLiveScheduleStatus(row.status);
        const homeWon = played && row.home.score != null && row.away.score != null && row.home.score > row.away.score;
        const awayWon = played && row.home.score != null && row.away.score != null && row.away.score > row.home.score;
        const available = played && verified.has(row.source_match_id);
        const content = <><span className="match-list-meta"><strong>#{row.source_match_id}</strong><small>{scheduleDate(row, language)}</small></span><span className="match-list-teams"><span className="match-team-side"><strong>{row.home.name}</strong><TeamLogo teamName={row.home.name} className="match-list-team-logo" /><b className={homeWon ? "match-winner" : undefined}>{played ? row.home.score ?? "—" : ""}</b></span><span className="match-list-vs">vs</span><span className="match-team-side match-team-side-away"><b className={awayWon ? "match-winner" : undefined}>{played ? row.away.score ?? "—" : ""}</b><TeamLogo teamName={row.away.name} className="match-list-team-logo" /><strong>{row.away.name}</strong></span><small>{row.venue ?? tr("Pelipaikka vahvistetaan", "Venue to be confirmed")} · {live ? <span className="match-live-badge" role="status" aria-label={tr("Ottelu käynnissä", "Game in progress")}>Live</span> : played ? available ? tr("Pelattu", "Final") : tr("Pelattu · tilastot odottavat", "Final · statistics pending") : tr("Tulossa", "Upcoming")}</small></span></>;
        return <div role="listitem" key={row.source_match_id}>{available ? <button className="match-list-row" onClick={() => onOpenMatch(row.source_match_id)}>{content}<span className="match-list-open">{tr("Avaa analyysi", "Open analysis")} <Icon name="arrowOutward" size={14} /></span></button> : <div className="match-list-row match-list-row--scheduled">{content}<a className="match-list-open" href={`https://tulospalvelu.basket.fi/match/${row.source_match_id}/statistics`} target="_blank" rel="noreferrer">{tr("Tilastosivu", "Game stats")} <Icon name="arrowOutward" size={14} /></a></div>}</div>;
      })}</div>}
    </section>
  </>;
}
