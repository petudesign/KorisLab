import type { MouseEvent, ReactNode } from "react";
import { routeHref, followLink } from "./routing";
import type { LeagueId } from "./leagues";
import type { SeasonId } from "./SeasonContext";
import type { QueryResolution, QueryTarget } from "./basketballQuery";
import { Icon } from "./Icon";
import { useI18n } from "./i18n";
import { PlayerPortrait } from "./PlayerPortrait";

function dateLabel(value: string | null, language: "fi" | "en") {
  if (!value) return "—";
  const date = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat(language === "fi" ? "fi-FI" : "en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function TargetLink({ target, onOpenTarget, children }: { target: QueryTarget; onOpenTarget: (target: QueryTarget) => void; children: ReactNode }) {
  const href = routeHref(target.view, target.season, target.id ?? target.teamId, target.league);
  return <a href={href} onClick={(event: MouseEvent<HTMLAnchorElement>) => followLink(event, () => onOpenTarget(target))}>{children}</a>;
}

function TeamLogoSlot({ name, src, compact = false }: { name: string; src?: string | null; compact?: boolean }) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = (words.length > 1 ? words.slice(0, 2).map((part) => part.slice(0, 1)).join("") : words[0]?.slice(0, 2) ?? "")
    .toLocaleUpperCase("fi-FI");
  return <span className={`ask-team-logo-slot${compact ? " ask-team-logo-slot--compact" : ""}`} aria-hidden="true">
    {src ? <img src={src} alt="" loading="lazy" /> : initials}
  </span>;
}

export function AskPage({ query, resolution, loading, leagueId, seasonId, suggestions, onOpenTarget }: {
  query: string;
  resolution: QueryResolution | null;
  loading: boolean;
  leagueId: LeagueId;
  seasonId: SeasonId;
  onOpenTarget: (target: QueryTarget) => void;
  suggestions: string[];
}) {
  const { language, tr } = useI18n();
  const answer = resolution?.answer;
  const isPlayerAnswer = answer?.kind === "player-stat" || answer?.kind === "player-leader";
  const displayedSuggestions = resolution?.feedback.suggestions?.length ? resolution.feedback.suggestions : suggestions;
  const teamHref = answer?.kind === "team-games" ? routeHref("teams", answer.season, answer.teamId, leagueId) : undefined;

  return <article className="ask-page" aria-labelledby="ask-question-heading">
    <div className="ask-page-crumb"><span>{tr("Kysymys", "Question")}</span><span aria-hidden="true">/</span><span>{tr("Vastaus", "Answer")}</span></div>
    <h1 id="ask-question-heading">{query || tr("Kysy KorisIQ:lta", "Ask KorisIQ")}</h1>

    {loading ? <section className="panel ask-state" role="status"><span className="ask-kicker">{tr("HAETAAN AINEISTOSTA", "SEARCHING THE DATA")}</span><strong>{tr("Etsitään vastausta…", "Finding an answer…")}</strong></section>
      : !resolution ? <section className="panel ask-state"><span className="ask-kicker">{tr("KORISIQ-KYSYMYS", "KORISIQ QUESTION")}</span><strong>{tr("Kirjoita kysymys hakukenttään.", "Enter a question in the search field.")}</strong></section>
        : <>
          <section className={`panel ask-answer ask-answer--${resolution.feedback.tone}`} aria-live="polite">
            {resolution.feedback.tone !== "answer" && <span className="ask-kicker">{tr("HAUN TULOS", "SEARCH RESULT")}</span>}
            <div className={`ask-answer-layout${isPlayerAnswer ? " ask-answer-layout--player" : ""}`}>
              <div className="ask-answer-copy">
                {answer?.kind === "team-games" ? <div className="ask-team-answer-heading">
                  <TeamLogoSlot name={answer.teamName} />
                  <div><h2>{resolution.feedback.title}</h2><p>{resolution.feedback.detail}</p></div>
                </div> : <><h2>{resolution.feedback.title}</h2><p>{resolution.feedback.detail}</p></>}
                {answer?.kind === "fixture" && <div className="ask-fixture">
                  <div className="ask-fixture-team"><TeamLogoSlot name={answer.fixture.home.name} compact /><span>{answer.fixture.home.name}</span><b>{answer.fixture.home.score ?? "—"}</b></div>
                  <span className="ask-fixture-separator">{answer.fixture.status === "Played" ? "–" : tr("vastaan", "vs")}</span>
                  <div className="ask-fixture-team"><TeamLogoSlot name={answer.fixture.away.name} compact /><span>{answer.fixture.away.name}</span><b>{answer.fixture.away.score ?? "—"}</b></div>
                  <small>{answer.fixture.venue || tr("Pelipaikkaa ei ole ilmoitettu", "Venue not listed")}</small>
                </div>}
                {isPlayerAnswer && <div className="ask-player-answer">
                  <strong>{answer.value.toLocaleString(language === "fi" ? "fi-FI" : "en-GB", { maximumFractionDigits: 1 })}</strong>
                  <div className="ask-player-answer-copy">
                    <span>{answer.statLabel} · {answer.playerName}</span>
                    <span className="ask-player-answer-team"><TeamLogoSlot name={answer.teamName} compact />{answer.teamName} · {answer.games} {tr("ottelua", "games")}</span>
                    <TargetLink target={{ view: "player-profile", season: answer.season, id: answer.playerId, league: leagueId }} onOpenTarget={onOpenTarget}>{tr("Avaa pelaajaprofiili", "Open player profile")} <Icon name="arrowOutward" size={14} /></TargetLink>
                  </div>
                </div>}
                {resolution.feedback.actions?.length ? <div className="ask-actions">{resolution.feedback.actions.map((action) => <TargetLink key={`${action.target.view}-${action.target.id ?? action.target.teamId ?? ""}`} target={{ ...action.target, league: leagueId }} onOpenTarget={onOpenTarget}>{action.label} <Icon name="arrowOutward" size={14} /></TargetLink>)}</div> : null}
              </div>
              {isPlayerAnswer && <PlayerPortrait className="ask-answer-portrait" />}
            </div>
          </section>

          {answer?.kind === "team-games" && <section className="panel ask-evidence" aria-labelledby="ask-evidence-heading">
            <div className="panel-heading panel-heading--plain"><div><h2 id="ask-evidence-heading">{tr("Ottelut", "Games")}</h2><p className="panel-subcopy">{tr("Varmennetut tulokset · uusimmat ensin", "Verified results · newest first")}</p></div><span className="panel-context">{answer.season.replace("-", "–")}</span></div>
            {answer.nextFixture && <div className="ask-next-fixture">
              <span className="ask-kicker">{tr("SEURAAVA OTTELU", "NEXT GAME")}</span>
              <div className="ask-fixture">
                <div className="ask-fixture-team"><TeamLogoSlot name={answer.nextFixture.home.name} compact /><span>{answer.nextFixture.home.name}</span>{answer.nextFixture.home.score !== null && <b>{answer.nextFixture.home.score}</b>}</div>
                <span className="ask-fixture-separator">{tr("vastaan", "vs")}</span>
                <div className="ask-fixture-team"><TeamLogoSlot name={answer.nextFixture.away.name} compact /><span>{answer.nextFixture.away.name}</span>{answer.nextFixture.away.score !== null && <b>{answer.nextFixture.away.score}</b>}</div>
                <small>{[dateLabel(answer.nextFixture.scheduled_date, language), answer.nextFixture.scheduled_time?.slice(0, 5), answer.nextFixture.venue].filter(Boolean).join(" · ")}</small>
              </div>
            </div>}
            {answer.games.length ? <ol className="ask-game-list">{answer.games.map((game) => <li key={game.id}>
              <span className="ask-game-date">{dateLabel(game.date, language)}</span>
              <TargetLink target={{ view: "story", season: answer.season, id: game.id, league: leagueId }} onOpenTarget={onOpenTarget}>
                <span className="ask-game-score"><b>{answer.teamName}</b><strong>{game.teamScore}–{game.opponentScore}</strong><span>{game.opponent}</span></span>
                <span className={`ask-game-outcome ${game.won ? "is-win" : "is-loss"}`}>{game.won ? tr("Voitto", "Win") : tr("Tappio", "Loss")}</span>
                <Icon name="arrowOutward" size={14} />
              </TargetLink>
            </li>)}</ol> : <p className="ask-empty-evidence">{tr("Tälle haulle ei löytynyt varmennettuja otteluita.", "No verified games were found for this search.")}</p>}
            {teamHref && <a className="ask-profile-link" href={teamHref} onClick={(event) => followLink(event, () => onOpenTarget({ view: "teams", season: answer.season, teamId: answer.teamId, league: leagueId }))}>{tr("Avaa joukkueprofiili", "Open team profile")} <Icon name="arrowOutward" size={14} /></a>}
          </section>}

          {answer?.kind === "fixture" && <p className="ask-source-note">{tr("Lähde: kauden otteluohjelma. Päivämäärä ja pelipaikka näytetään, jos ne ovat lähteessä saatavilla.", "Source: season schedule. Date and venue are shown when available in the source.")}</p>}
          {(answer?.kind === "team-games" || answer?.kind === "player-stat" || answer?.kind === "player-leader") && <p className="ask-source-note">{tr("Lähde: varmennetut ottelutilastot. Vastaus koskee valittua kautta ja saatavilla olevaa aineistoa.", "Source: verified game statistics. The answer reflects the selected season and available data.")}</p>}

          {resolution.feedback.tone === "empty" && <section className="panel ask-suggestions">
            <span className="ask-kicker">{tr("KOKEILE NÄITÄ", "TRY THESE")}</span>
            <div>
              {displayedSuggestions.map((suggestion) => <a key={suggestion} href={routeHref("ask", seasonId, suggestion, leagueId)} onClick={(event) => followLink(event, () => onOpenTarget({ view: "ask", season: seasonId, id: suggestion, league: leagueId }))}>{suggestion}<Icon name="arrowOutward" size={14} /></a>)}
            </div>
          </section>}
        </>}
  </article>;
}
