import { useMemo } from "react";
import { useSeason } from "./SeasonContext";
import { useI18n } from "./i18n";
import { aggregateSeasonPlayers } from "./playerStats";
import { playerDisplayName } from "./playerName";
import { Icon } from "./Icon";

function Card({ eyebrow, title, value, detail, action, onClick, secondaryAction, onSecondaryClick }: { eyebrow: string; title: string; value: string; detail: string; action?: string; onClick?: () => void; secondaryAction?: string; onSecondaryClick?: () => void }) {
  return <article className="live-season-card"><span className="live-season-eyebrow"><i />{eyebrow}</span><h3>{title}</h3><strong className="live-season-value">{value}</strong><p>{detail}</p>{(action && onClick || secondaryAction && onSecondaryClick) && <div className="live-season-actions">{action && onClick && <button className="live-season-action" onClick={onClick}>{action}<Icon name="arrowOutward" size={15} /></button>}{secondaryAction && onSecondaryClick && <button className="live-season-action live-season-action--secondary" onClick={onSecondaryClick}>{secondaryAction}<Icon name="arrowOutward" size={15} /></button>}</div>}</article>;
}

export function LiveSeason({ onOpenMatches, onOpenMatch, onOpenPlayer }: { onOpenMatches: () => void; onOpenMatch: (id: string) => void; onOpenPlayer: (id: string) => void }) {
  const { current, loading, error } = useSeason();
  const { tr, language } = useI18n();
  const date = (value: string | null) => value ? new Date(`${value}T12:00:00Z`).toLocaleDateString(language === "fi" ? "fi-FI" : "en-GB", { timeZone: "UTC", day: "numeric", month: "numeric" }) : "—";
  const highlights = useMemo(() => {
    const matches = current?.matches ?? [];
    const latest = [...matches].sort((a, b) => (b.game.scheduled_at ?? "").localeCompare(a.game.scheduled_at ?? ""))[0];
    const leadingPlayers = aggregateSeasonPlayers(matches)
      .filter(player => player.games >= 3 && player.minutes >= 120)
      .sort((a, b) => b.points / b.games - a.points / a.games);
    const topPlayer = latest && latest.teams.flatMap(team => team.players.filter(player => (player.minutes ?? 0) > 0).map(player => ({ player, team: team.name }))).sort((a, b) => (b.player.stats.points ?? -1) - (a.player.stats.points ?? -1))[0];
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Helsinki", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const today = `${parts.find(part => part.type === "year")?.value}-${parts.find(part => part.type === "month")?.value}-${parts.find(part => part.type === "day")?.value}`;
    const upcoming = [...(current?.schedule ?? [])].filter(game => game.scheduled_date && game.scheduled_date >= today && !["played", "finished", "completed"].includes(game.status.toLowerCase())).sort((a, b) => `${a.scheduled_date} ${a.scheduled_time ?? ""}`.localeCompare(`${b.scheduled_date} ${b.scheduled_time ?? ""}`))[0];
    const number = (value: number) => value.toLocaleString(language === "fi" ? "fi-FI" : "en-GB", { maximumFractionDigits: 1 });
    return { latest, topPlayer, upcoming, leader: leadingPlayers[0], number };
  }, [current, language]);

  return <section className="live-season" aria-labelledby="live-season-title">
    <div className="live-season-heading"><div><h2 id="live-season-title">{tr("Kausi livenä", "Season live")}</h2><p>{tr("Kauden 2026–27 nostot syntyvät pelatuista otteluista ja varmennetuista tilastoista.", "2026–27 highlights from played games and verified statistics.")}</p></div><span className="live-season-coverage">{current?.summary.valid_games ?? 0} / {current?.summary.available_played_games ?? 0} {tr("ottelua tarkistettu", "games verified")}</span></div>
    {!current && loading ? <p className="live-season-empty" role="status">{tr("Ladataan otteluohjelmaa ja kauden tilastoja…", "Loading the schedule and season statistics…")}</p> : <div className="live-season-grid">
      <Card eyebrow={highlights.upcoming ? tr("Ohjelmassa seuraavaksi", "Coming up") : tr("Otteluohjelma", "Schedule")} title={highlights.upcoming ? `${highlights.upcoming.home.name} – ${highlights.upcoming.away.name}` : tr("Uusia otteluita ei ole ohjelmassa", "No upcoming games in the schedule")} value={highlights.upcoming ? `${date(highlights.upcoming.scheduled_date)}${highlights.upcoming.scheduled_time ? ` · ${highlights.upcoming.scheduled_time.slice(0, 5)}` : ""}` : tr("2026–27", "2026–27")} detail={highlights.upcoming?.venue ?? tr("Otteluajat Suomen aikaa", "Game times in Finnish local time")} action={tr("Selaa otteluita", "Browse games")} onClick={onOpenMatches} />
      {highlights.latest && highlights.topPlayer ? <Card eyebrow={tr("Tuorein tarkistettu peli · ", "Latest verified game · ") + highlights.latest.teams.map(team => team.name).join(" – ")} title={playerDisplayName(highlights.topPlayer.player.display_name)} value={`${highlights.topPlayer.player.stats.points ?? "—"} ${tr("pistettä", "points")}`} detail={`${highlights.topPlayer.team} · ${highlights.latest.teams[0].score}–${highlights.latest.teams[1].score} · ${highlights.topPlayer.player.stats.rebounds ?? "—"} ${tr("levypalloa", "rebounds")} · ${highlights.topPlayer.player.stats.assists ?? "—"} ${tr("syöttöä", "assists")}`} action={tr("Ottelun tarina", "Game story")} onClick={() => onOpenMatch(highlights.latest!.game.source_id)} secondaryAction={tr("Pelaajaprofiili", "Player profile")} onSecondaryClick={() => onOpenPlayer(highlights.topPlayer!.player.source_player_id)} /> : <Card eyebrow={tr("Ensimmäiset nostot", "First highlights")} title={tr("Kausi on käynnistynyt", "The season has started")} value={current?.summary.valid_games ?? 0 ? `${current!.summary.valid_games} ${tr("box scorea", "box scores")}` : tr("Odotetaan pelejä", "Waiting for games")} detail={tr("Pelaajakohtaiset nostot ilmestyvät tänne, kun pelattujen otteluiden tilastot on tarkistettu.", "Player highlights appear here once game statistics are verified.")} />}
      {highlights.leader ? <Card eyebrow={tr("Pistekeskiarvojen kärki", "Scoring average leader")} title={highlights.leader.name} value={`${highlights.number(highlights.leader.points / highlights.leader.games)} ${tr("pistettä / ottelu", "points per game")}`} detail={`${highlights.leader.games} ${tr("ottelua · vähintään 3 ottelun otos", "games · minimum 3-game sample")}`} action={tr("Avaa pelaajaprofiili", "Open player profile")} onClick={() => onOpenPlayer(highlights.leader!.id)} /> : <Card eyebrow={tr("Pistekeskiarvojen kärki", "Scoring average leader")} title={tr("Vertailuun tarvitaan lisää pelejä", "More games needed for a comparison")} value={`${current?.summary.valid_games ?? 0} ${tr("tarkistettua ottelua", "verified games")}`} detail={tr("Näytämme pistekeskiarvojen kärjen, kun pelaajilla on vähintään kolme ottelua ja 120 peliminuuttia.", "Scoring leaders appear after players have at least three games and 120 minutes.")} />}
    </div>}
    {error && <p className="live-season-footnote">{tr("Päivitys epäonnistui; viimeksi ladatut luvut näkyvät edelleen.", "Refresh failed; showing the latest saved statistics.")}</p>}
    {current && <p className="live-season-footnote">{tr("Päivitys", "Updated")}: {new Date(current.updated_at).toLocaleString(language === "fi" ? "fi-FI" : "en-GB", { timeZone: "Europe/Helsinki", dateStyle: "short", timeStyle: "short" })}. {tr("Ottelukohtaiset nostot perustuvat box scoreen, eivät pelitapahtumien tulkintaan.", "Game highlights use box scores rather than interpretation of live events.")}</p>}
  </section>;
}
