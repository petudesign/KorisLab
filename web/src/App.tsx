import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { availability, insights, match, players, teamSummary, type BoxScore, type Player, type PlayerRole, type TeamStats, type ViewKey } from "./data";
import { deriveTeamMetrics, type DerivedTeamMetrics } from "./metrics";
import { leagues } from "./leagues";
import { TeamProfiles } from "./TeamProfiles";
import { TeamStyleMap } from "./TeamStyleMap";
import { TeamGameSplit } from "./TeamGameSplit";
import { scheduleByMatchId } from "./schedule";
import { useI18n, type Language } from "./i18n";
import { PaperLeaderShader } from "./PaperShaderBackdrop";
import { ThreePointStory } from "./ThreePointStory";
import { SeasonPhaseComparison } from "./SeasonPhaseComparison";
import { SeasonSelector, useSeason, type SeasonId } from "./SeasonContext";
import { aggregateSeasonPlayers, playerPerGame, playerFgPctFromTotals, playerThreePctFromTotals, playerFtPctFromTotals, playerEfGPctFromTotals, playerAssistTurnoverRatio, playerEfficiencyPer40, playerAttemptsPer40, type SeasonPlayerRow } from "./playerStats";
import { PlayerProfile } from "./PlayerProfile";
import { PlayerPortrait } from "./PlayerPortrait";
import { AssistCreation } from "./AssistCreation";
import { followLink, routeHref, useAppRoute } from "./routing";
import { usePageMetadata } from "./seo";
import { ShotChart, useMatchShots } from "./ShotChart";
import { SeasonShotDistance } from "./ShotDistanceProfile";
import { Icon, type IconName } from "./Icon";
import { parseQuarterStats, quarterValue, type QuarterStats, type ScratchMetricKey, type ScratchPeriodKey } from "./quarterStats";
import { CurrentSeasonMatches, CurrentSeasonPending } from "./CurrentSeason";
import { DecryptedText } from "./DecryptedText";
import { playerDisplayName } from "./playerName";
import { QuerySearch } from "./QuerySearch";
import { MatchupLab } from "./MatchupLab";
import { MatchReplay, useMatchReplay } from "./MatchReplay";
import { LiveSeason } from "./LiveSeason";
import { resolveBasketballQuery, type QueryFeedback, type QueryTarget } from "./basketballQuery";
import { AnalysesIndex, AnalysisArticlePage } from "./AnalysisArticles";

const CustomImportPage = lazy(() => import("./CustomImport"));

type SeasonMatchRecord = typeof import("../../data/normalized/season_verified.json")["matches"][number];

type MatchListItem = {
  id: string;
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  venue: string;
  scheduledAt: string | null;
};

type ThreePointGameRow = {
  id: string;
  date: string | null;
  opponent: string;
  home: boolean;
  points: number;
  opponentPoints: number;
  threePM: number;
  threePA: number;
};

type AppMatch = Omit<typeof match, "eventCount"> & { eventCount: number | null };

function toBoxScore(rawStats: Record<string, number | null>, minutes: string | null = null): BoxScore {
  return {
    minutes,
    points: rawStats.points ?? null,
    twoPM: rawStats.two_pm ?? null,
    twoPA: rawStats.two_pa ?? null,
    twoPct: rawStats.two_p_pct ?? null,
    threePM: rawStats.three_pm ?? null,
    threePA: rawStats.three_pa ?? null,
    threePct: rawStats.three_p_pct ?? null,
    ftm: rawStats.ftm ?? null,
    fta: rawStats.fta ?? null,
    ftPct: rawStats.ft_pct ?? null,
    offensiveRebounds: rawStats.offensive_rebounds ?? null,
    defensiveRebounds: rawStats.defensive_rebounds ?? null,
    rebounds: rawStats.rebounds ?? null,
    assists: rawStats.assists ?? null,
    turnovers: rawStats.turnovers ?? null,
    steals: rawStats.steals ?? null,
    blocks: rawStats.blocks ?? null,
    blocksReceived: rawStats.blocks_received ?? null,
    fouls: rawStats.fouls ?? null,
    foulsDrawn: rawStats.fouls_drawn ?? null,
    plusMinus: rawStats.plus_minus ?? null,
    efficiency: rawStats.efficiency ?? null,
  };
}

function normalizePosition(position: string | null): PlayerRole {
  return position === "C" || position === "PF" || position === "SF" || position === "SG" || position === "PG" ? position : null;
}

function teamMark(name: string) {
  return name.trim().split(/\s+/).at(-1)?.[0]?.toUpperCase() ?? "?";
}

function playerMark(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0][0]}${parts.at(-1)?.[0] ?? ""}`.toUpperCase() : (parts[0]?.slice(0, 2) ?? "?").toUpperCase();
}

function EntityPlaceholder({ name, kind }: { name: string; kind: "team" | "player" }) {
  return <span className={`entity-placeholder entity-placeholder--${kind}`} aria-hidden="true"><span>{kind === "team" ? teamMark(name) : playerMark(name)}</span></span>;
}

function NeutralPortrait() {
  return <span className="neutral-portrait" aria-hidden="true">
    <svg viewBox="0 0 120 170" role="presentation">
      <circle className="neutral-portrait-face" cx="60" cy="49" r="27" />
      <path className="neutral-portrait-neck" d="M44 69h32v25H44z" />
      <path className="neutral-portrait-body" d="M14 170c4-34 22-52 46-52s42 18 46 52H14Z" />
    </svg>
  </span>;
}

function formatScheduledDate(value: string | null, language: Language = "fi") {
  if (!value) return language === "fi" ? "Päivä ei lähteessä" : "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? language === "fi" ? "Päivä ei lähteessä" : "Date unavailable" : new Intl.DateTimeFormat(language === "fi" ? "fi-FI" : "en-GB", { day: "numeric", month: "numeric", year: "numeric" }).format(date);
}

function scheduledAtFor(record: SeasonMatchRecord) {
  return scheduleByMatchId[record.game.source_id] ?? record.game.scheduled_at;
}

function toMatchListItem(record: SeasonMatchRecord): MatchListItem {
  const home = record.teams.find((team) => team.home_away === "home") ?? record.teams[0];
  const away = record.teams.find((team) => team.home_away === "away") ?? record.teams[1];
  return {
    id: record.game.source_id,
    homeName: home.name,
    awayName: away.name,
    homeScore: record.game.final_score.home,
    awayScore: record.game.final_score.away,
    venue: record.game.venue.name,
    scheduledAt: scheduledAtFor(record),
  };
}

function buildMatchViewModel(record: SeasonMatchRecord, language: Language = "fi", seasonLabel = "2025–26"): { match: AppMatch; players: Player[]; teamSummary: typeof teamSummary; insights: typeof insights; availability: typeof availability } {
  const home = record.teams.find((team) => team.home_away === "home") ?? record.teams[0];
  const away = record.teams.find((team) => team.home_away === "away") ?? record.teams[1];
  const winner = home.score >= away.score ? home : away;
  const loser = winner === home ? away : home;
  const margin = Math.abs(home.score - away.score);
  const periods = record.game.periods.map((period) => ({ label: `${period.period}Q`, home: period.home_score, away: period.away_score }));
  const scheduledAt = scheduledAtFor(record);
  const biggestQuarter = periods.reduce((best, period) => Math.abs(period.home - period.away) > Math.abs(best.home - best.away) ? period : best, periods[0]);
  const playerRows: Player[] = record.teams.flatMap((team) => team.players.map((player) => ({
    name: playerDisplayName(player.display_name),
    team: team.name,
    teamColor: team.home_away === "home" ? "coral" : "mint",
    number: player.jersey_number,
    role: normalizePosition(player.position),
    starter: player.starter,
    stats: toBoxScore(player.stats as Record<string, number | null>, player.minutes_display),
  })));
  const homeStats: TeamStats = {
    ...toBoxScore(home.stats as Record<string, number | null>, "200:00"),
    leadTime: home.team_flow.timeInLead,
    leadChanges: home.team_flow.leadChanges,
    biggestLead: home.team_flow.biggestLead,
    longestRun: home.team_flow.biggestScoringRun,
  };
  const awayStats: TeamStats = {
    ...toBoxScore(away.stats as Record<string, number | null>, "200:00"),
    leadTime: away.team_flow.timeInLead,
    leadChanges: away.team_flow.leadChanges,
    biggestLead: away.team_flow.biggestLead,
    longestRun: away.team_flow.biggestScoringRun,
  };
  const matchModel = {
    competition: record.competition.name,
    season: seasonLabel,
    date: formatScheduledDate(scheduledAt, language),
    time: scheduledAt ? new Intl.DateTimeFormat(language === "fi" ? "fi-FI" : "en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(scheduledAt)) : "—",
    venue: record.game.venue.name,
    sourceMatchId: record.game.source_id,
    status: "Lopputulos",
    home: { name: home.name, score: home.score, color: "coral" },
    away: { name: away.name, score: away.score, color: "mint" },
    periods,
    eventCount: null,
    lineupCount: playerRows.length,
  };
  const insightModel = [
    { eyebrow: "Avaus", title: `${periods[0]?.home > periods[0]?.away ? home.name : away.name} aloitti vahvemmin`, body: `Ensimmäinen neljännes päättyi ${periods[0]?.home}–${periods[0]?.away}. ${winner.name} johti ottelua ${margin} pisteellä lopussa.`, accent: "mint" },
    { eyebrow: "Ratkaisu", title: `${winner.name} teki eron ${biggestQuarter?.label ?? "ottelussa"}`, body: `Suurin neljänneskohtainen ero syntyi lukemin ${biggestQuarter?.home}–${biggestQuarter?.away}. Se auttoi ${winner.name}a pitämään ottelun hallinnassa.`, accent: "amber" },
    { eyebrow: "Loppu", title: `${winner.name} voitti ${margin} pisteellä`, body: `${winner.name} teki ${winner.score} pistettä ja ${loser.name} ${loser.score}. Ottelun box score on saatavilla lähdedatassa.`, accent: "coral" },
  ] as typeof insights;
  const availabilityModel = availability.map((item) => item.label === "Box score -tilastot"
    ? { ...item, detail: `${playerRows.length} pelaajaa · MIN · heitot · levypallot · muut kentät` }
    : item.label === "Tapahtumat"
      ? { ...item, value: "Ei eritelty", tone: "warning", detail: "Tapahtumamäärä ei ole mukana kausi-indeksissä" }
      : item) as typeof availability;

  return {
    match: matchModel,
    players: playerRows,
    teamSummary: { home: { name: home.name, stats: homeStats }, away: { name: away.name, stats: awayStats } },
    insights: insightModel,
    availability: availabilityModel,
  };
}

function displayStat(value: number | null, suffix = "") {
  return value === null ? "—" : `${value}${suffix}`;
}

function displayPct(value: number | null) {
  return displayStat(value, "%");
}

function displayMinutes(value: string | null) {
  return value === null ? "—" : value;
}

function displayPair(home: number | null, away: number | null, formatter = displayStat) {
  return <>{formatter(home)}<span className="stat-pair-separator"> - </span>{formatter(away)}</>;
}

function displayAdvantage(homeName: string, awayName: string, home: number | null, away: number | null, suffix = "", language: Language = "fi") {
  if (home === null || away === null) return language === "fi" ? "Ei vertailtavaa dataa" : "No comparable data";
  const difference = Math.round(Math.abs(home - away) * 10) / 10;
  if (difference === 0) return language === "fi" ? "Tasainen vertailu" : "Even comparison";
  return `${home > away ? homeName : awayName} +${difference}${suffix}`;
}

function getMetricValue(metrics: DerivedTeamMetrics, key: keyof DerivedTeamMetrics) {
  return metrics[key];
}

function playerPoints(player: Player) {
  return player.stats.points ?? -1;
}

function playerFgPct(boxScore: BoxScore) {
  if (boxScore.twoPM === null || boxScore.threePM === null || boxScore.twoPA === null || boxScore.threePA === null) return null;
  const attempts = boxScore.twoPA + boxScore.threePA;
  return attempts === 0 ? 0 : Math.round(((boxScore.twoPM + boxScore.threePM) / attempts) * 1000) / 10;
}

function Mark({ className = "" }: { className?: string }) {
  return (
    <span className={`brand-mark ${className}`} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

function ArrowUpRight() {
  return <Icon name="arrowOutward" size={16} className="arrow-icon" />;
}

function MatchesView({ onOpenMatch }: { onOpenMatch: (id: string) => void }) {
  const { leagueName, leagueNameEn, seasonLabel, data: seasonData, loadMatches: loadSeasonMatches } = useSeason();
  const { language, tr } = useI18n();
  const [matchRows, setMatchRows] = useState<MatchListItem[]>([]);
  const [query, setQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadSeasonMatches()
      .then((records) => {
        if (!cancelled) setMatchRows(records.map(toMatchListItem));
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [loadSeasonMatches]);

  const teams = useMemo(() => Array.from(new Set(matchRows.flatMap((item) => [item.homeName, item.awayName])).values()).sort((a, b) => a.localeCompare(b, "fi")), [matchRows]);
  const filteredMatches = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("fi-FI");
    return matchRows.filter((item) => {
      const matchesTeam = teamFilter === "all" || item.homeName === teamFilter || item.awayName === teamFilter;
      const matchesQuery = normalizedQuery.length === 0 || `${item.id} ${item.homeName} ${item.awayName}`.toLocaleLowerCase("fi-FI").includes(normalizedQuery);
      return matchesTeam && matchesQuery;
    });
  }, [matchRows, query, teamFilter]);

  return (
    <>
      <section className="matches-toolbar panel">
        <div>
          <strong>{tr(leagueName, leagueNameEn)} · {seasonLabel}</strong>
          <p>{tr(`${seasonData.aggregate.games} validia box score -ottelua. Päivämäärät on yhdistetty kauden tuloslistalta.`, `${seasonData.aggregate.games} verified box score games. Dates are joined from the season results list.`)}</p>
        </div>
        <div className="matches-toolbar-controls">
          <label>{tr("Hae otteluista", "Search games")}<input aria-label={tr("Hae otteluista", "Search games")} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tr("Joukkue tai ottelu-ID", "Team or game ID")} /></label>
          <label>{tr("Joukkue", "Team")}<select aria-label={tr("Rajaa joukkueella", "Filter by team")} value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}><option value="all">{tr("Kaikki joukkueet", "All teams")}</option>{teams.map((team) => <option key={team} value={team}>{team}</option>)}</select></label>
        </div>
      </section>

      <section className="matches-panel panel" aria-labelledby="matches-heading">
        <div className="matches-panel-heading">
          <div><h2 id="matches-heading">{tr("Otteluindeksi", "Game index")}</h2><p>{tr("Valitse ottelu ja avaa sen analyysi.", "Choose a game to open its analysis.")}</p></div>
          <span>{matchRows.length > 0 ? `${filteredMatches.length} / ${matchRows.length}` : `${seasonData.aggregate.games} ${tr("ottelua", "games")}`}</span>
        </div>
        {loadError ? <div className="match-list-empty"><strong>{tr("Ottelulistan lataus epäonnistui", "Could not load games")}</strong><p>{tr("Yritä päivittää sivu. Datan lähde on paikallinen kausitiedosto.", "Try refreshing the page. The data source is a local season file.")}</p></div> : matchRows.length === 0 ? <div className="match-list-empty"><strong>{tr("Ladataan otteluita…", "Loading games…")}</strong><p>{tr("Haetaan tarkistettuja otteluita kausitiedostosta.", "Loading verified games from the season file.")}</p></div> : filteredMatches.length === 0 ? <div className="match-list-empty"><strong>{tr("Ei osumia", "No matches")}</strong><p>{tr("Muuta hakua tai joukkuevalintaa.", "Change the search or team filter.")}</p></div> : (
          <div className="match-list" role="list">
            {filteredMatches.map((item) => {
              const homeWon = item.homeScore > item.awayScore;
              return <button className="match-list-row" key={item.id} onClick={() => onOpenMatch(item.id)} aria-label={tr(`Avaa ottelun ${item.homeName} vastaan ${item.awayName} analyysi`, `Open analysis for ${item.homeName} vs ${item.awayName}`)}>
                <span className="match-list-meta"><strong>#{item.id}</strong><small>{formatScheduledDate(item.scheduledAt, language)}</small></span>
                <span className="match-list-teams"><span className="match-team-side"><strong>{item.homeName}</strong><b className={homeWon ? "match-winner" : ""}>{item.homeScore}</b></span><span className="match-list-vs">vs</span><span className="match-team-side match-team-side-away"><b className={!homeWon ? "match-winner" : ""}>{item.awayScore}</b><strong>{item.awayName}</strong></span><small>{item.venue} · {homeWon ? item.homeName : item.awayName} {tr("voitti", "won")}</small></span>
                <span className="match-list-open"><span>Box score</span><Icon name="chevron" size={14} /></span>
              </button>;
            })}
          </div>
        )}
      </section>
    </>
  );
}

function overviewValue(value: number | null, suffix = "") {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(1)}${suffix}`;
}

function overviewIntegerValue(value: number | null) {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value)}`;
}

function overviewSignedIntegerValue(value: number | null) {
  if (value === null || value === undefined) return "—";
  return value > 0 ? `+${overviewIntegerValue(value)}` : overviewIntegerValue(value);
}

function overviewSignedValue(value: number | null) {
  if (value === null || value === undefined) return "—";
  return value > 0 ? `+${overviewValue(value)}` : overviewValue(value);
}

type StandingRow = {
  name: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
};

function buildStandings(records: SeasonMatchRecord[], teams: ReturnType<typeof useSeason>["data"]["aggregate"]["teams"]) {
  const standings = new Map<string, StandingRow>();
  for (const team of teams) {
    standings.set(team.name, { name: team.name, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 });
  }

  for (const record of records) {
    const home = record.teams.find((team) => team.home_away === "home") ?? record.teams[0];
    const away = record.teams.find((team) => team.home_away === "away") ?? record.teams[1];
    if (!home || !away) continue;
    const homeStanding = standings.get(home.name);
    const awayStanding = standings.get(away.name);
    if (!homeStanding || !awayStanding) continue;
    homeStanding.pointsFor += home.score;
    homeStanding.pointsAgainst += away.score;
    awayStanding.pointsFor += away.score;
    awayStanding.pointsAgainst += home.score;
    if (home.score > away.score) {
      homeStanding.wins += 1;
      awayStanding.losses += 1;
    } else if (away.score > home.score) {
      awayStanding.wins += 1;
      homeStanding.losses += 1;
    }
  }

  return Array.from(standings.values()).sort((a, b) => {
    const winDifference = b.wins - a.wins;
    if (winDifference !== 0) return winDifference;
    const pointDifference = (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst);
    if (pointDifference !== 0) return pointDifference;
    return b.pointsFor - a.pointsFor;
  });
}

type TeamSortKey = "offensive_rating" | "defensive_rating" | "net_rating" | "three_point_attempt_rate";
type SortDirection = "asc" | "desc";

const teamSortLabels: Record<TeamSortKey, string> = {
  offensive_rating: "ORtg",
  defensive_rating: "DRtg",
  net_rating: "Net",
  three_point_attempt_rate: "3PA-osuus",
};

function teamSortLabel(key: TeamSortKey, translate: (finnish: string, english: string) => string) {
  return translate(teamSortLabels[key], key === "three_point_attempt_rate" ? "3PA share" : teamSortLabels[key]);
}

const teamDefaultDirections: Record<TeamSortKey, SortDirection> = {
  offensive_rating: "desc",
  defensive_rating: "asc",
  net_rating: "desc",
  three_point_attempt_rate: "desc",
};

function OverviewContext({ onOpenMatches }: { onOpenMatches: () => void }) {
  const { tr } = useI18n();
  const { seasonId, current, data } = useSeason();
  const count = seasonId === "2026-27" ? current?.schedule_summary.games ?? 0 : data.aggregate.games;
  return <div className="overview-context"><SeasonSelector /><div className="overview-context-stat"><strong>{count}</strong><span>{tr("ottelua", "games")}</span></div><button className="outline-button small" onClick={onOpenMatches}>{tr("Selaa otteluita", "Browse games")} <ArrowUpRight /></button></div>;
}

function PaperTeamMarker({ teamName, status }: { teamName: string; status: "winner" | "last" }) {
  const initials = teamName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
  return (
    <div className={`paper-team-marker paper-team-marker--${status}`} aria-hidden="true">
      <span className="paper-team-marker-initials">{initials}</span>
      <span className="paper-team-marker-status"><Icon name={status === "winner" ? "trophy" : "flag"} size={17} /></span>
    </div>
  );
}

function PaperLeaderCard({ title, playerName, value, team, shaderColor, valueColor, visual }: { title: string; playerName: string; value: string; team: string; shaderColor: string; valueColor: string; visual?: ReactNode }) {
  return (
    <div className="overview-leader-card overview-leader-card--ppg" style={{ "--ppg-value-color": valueColor } as CSSProperties}>
      <PaperLeaderShader colorFront={shaderColor} />
      <div className="ppg-card-content">
        <div className="ppg-card-title">{title}</div>
        <div className="ppg-card-player">{playerName}</div>
        <div className="ppg-card-value">{value}</div>
        <div className="ppg-card-team">{team}</div>
        {visual ?? <PlayerPortrait className="ppg-card-silhouette" />}
      </div>
    </div>
  );
}

type PageSectionLink = { href: string; label: string; scope?: string };

function PageSectionLinks({ links, tr }: { links: PageSectionLink[]; tr: (fi: string, en: string) => string }) {
  const [activeHref, setActiveHref] = useState(links[0]?.href);
  const sectionKey = links.map(link => link.href).join("|");
  useEffect(() => {
    const hrefs = sectionKey.split("|").filter(Boolean);
    if (hrefs.length <= 3) return;
    let frame = 0;
    const updateActive = () => {
      frame = 0;
      const sections = hrefs.flatMap(href => {
        const element = document.getElementById(href.slice(1));
        return element ? [{ href, top: element.getBoundingClientRect().top }] : [];
      });
      if (!sections.length) return;
      const readingLine = Math.min(160, window.innerHeight * .25);
      let current = sections[0].href;
      for (const section of sections) {
        if (section.top <= readingLine) current = section.href;
      }
      // Short final sections may never reach the reading line.
      if (window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
        current = sections[sections.length - 1].href;
      }
      setActiveHref(current);
    };
    const scheduleUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateActive);
    };
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    // Recheck when async content loads or a disclosure changes the page height.
    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(document.body);
    scheduleUpdate();
    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      resizeObserver.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [sectionKey]);
  if (links.length <= 3) return null;
  return <>
    <nav className="overview-section-nav overview-section-nav--desktop" aria-label={tr("Sivun osiot", "Page sections")}>
      <div className="overview-section-nav-rail">
        {links.map((link) => (
          <a className="overview-section-nav-marker" href={link.href} key={link.href} aria-current={activeHref === link.href ? "location" : undefined} aria-label={link.scope ? `${link.scope}: ${link.label}` : link.label}>
            <span className="overview-section-nav-marker-bar" aria-hidden="true" />
            <span className="overview-section-nav-marker-tooltip" aria-hidden="true">{link.scope ? `${link.scope}: ${link.label}` : link.label}</span>
          </a>
        ))}
      </div>
    </nav>

  </>;
}

const scratchMetrics: Array<{ key: ScratchMetricKey; labelFi: string; labelEn: string }> = [
  { key: "steals", labelFi: "riistot", labelEn: "steals" },
  { key: "fta", labelFi: "FTA", labelEn: "FTA" },
  { key: "three_pa", labelFi: "3PA", labelEn: "3PA" },
  { key: "turnovers", labelFi: "menetykset", labelEn: "turnovers" },
  { key: "points", labelFi: "pisteet", labelEn: "points" },
];

const scratchPeriods: Array<{ key: ScratchPeriodKey; labelFi: string; labelEn: string }> = [
  { key: "game", labelFi: "koko ottelussa", labelEn: "in the full game" },
  { key: "q1", labelFi: "ensimmäisellä neljänneksellä", labelEn: "in the first quarter" },
  { key: "q2", labelFi: "toisella neljänneksellä", labelEn: "in the second quarter" },
  { key: "q3", labelFi: "kolmannella neljänneksellä", labelEn: "in the third quarter" },
  { key: "q4", labelFi: "neljännellä neljänneksellä", labelEn: "in the fourth quarter" },
];

function AnalysisQuestion() {
  const { assetPath, data: seasonData, seasonId, seasonLabel, current } = useSeason();
  const { tr, language } = useI18n();
  const [subject, setSubject] = useState("all");
  const [metricKey, setMetricKey] = useState<ScratchMetricKey>("steals");
  const [periodKey, setPeriodKey] = useState<ScratchPeriodKey>("game");
  const quarterRevision = seasonId === "2026-27" ? current?.updated_at : undefined;
  const [quarters, setQuarters] = useState<{ seasonId: string; status: "loading" | "ready" | "missing" | "error"; data: QuarterStats | null }>({ seasonId, status: "loading", data: null });
  useEffect(() => {
    const controller = new AbortController();
    setQuarters({ seasonId, status: "loading", data: null });
    fetch(assetPath(`quarters-${seasonId}.json`), { signal: controller.signal, cache: "no-cache" }).then(async response => {
      if (response.status === 404) {
        if (!controller.signal.aborted) setQuarters({ seasonId, status: "missing", data: null });
        return;
      }
      if (!response.ok) throw new Error("Quarter summary unavailable");
      const data = parseQuarterStats(await response.json(), seasonId);
      if (!controller.signal.aborted) setQuarters({ seasonId, status: "ready", data });
    }).catch(() => { if (!controller.signal.aborted) setQuarters({ seasonId, status: "error", data: null }); });
    return () => controller.abort();
  }, [seasonId, quarterRevision, assetPath]);
  const quarterData = quarters.seasonId === seasonId ? quarters.data : null;
  const quarterStatus = quarters.seasonId === seasonId ? quarters.status : "loading";
  const quartersAvailable = quarterData?.teams.some(team => team.periods["1"][metricKey].games > 0) ?? false;
  const metric = scratchMetrics.find((item) => item.key === metricKey)!;
  const metricLabel = tr(metric.labelFi, metric.labelEn);
  const format = (value: number | null, digits = 0) => value == null ? "—" : value.toLocaleString(language === "fi" ? "fi-FI" : "en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const rows = seasonData.aggregate.teams
    .filter((team) => subject === "all" || team.name === subject)
    .map((team) => ({ name: team.name, expectedGames: team.games, ...(periodKey === "game"
      ? { games: team.games, total: team.totals[metricKey], average: team.games > 0 && team.totals[metricKey] != null ? team.totals[metricKey] / team.games : null }
      : quarterValue(quarterData, team.source_team_id, periodKey, metricKey)) }))
    .sort((a, b) => (b.average ?? -Infinity) - (a.average ?? -Infinity) || a.name.localeCompare(b.name, "fi"));

  return (
    <section id="overview-scratchpad" className="panel overview-scratchpad overview-section-anchor" aria-labelledby="overview-scratchpad-heading">
      <div className="panel-heading panel-heading--plain">
        <div>
          <h3 id="overview-scratchpad-heading">{tr("Rakenna analyysikysymys", "Build an analysis question")}</h3>
          <p className="panel-subcopy">{tr("Rakenna yksi analyysikysymys vaihdettavista palikoista.", "Build one analysis question from swappable building blocks.")}</p>
        </div>
        <span className="panel-context">{seasonLabel}</span>
      </div>

      <div className="overview-scratchpad-controls">
        <label>
          <span>{tr("Kuka?", "Who?")}</span>
          <select value={subject} onChange={(event) => setSubject(event.target.value)}>
            <option value="all">{tr("Jokaisen joukkueen", "Every team")}</option>
            {seasonData.aggregate.teams.map((team) => <option value={team.name} key={team.name}>{team.name}</option>)}
          </select>
        </label>
        <label>
          <span>{tr("Mitä?", "What?")}</span>
          <select value={metricKey} onChange={(event) => setMetricKey(event.target.value as ScratchMetricKey)}>
            {scratchMetrics.map((item) => <option value={item.key} key={item.key}>{tr(item.labelFi, item.labelEn)}</option>)}
          </select>
        </label>
        <label>
          <span>{tr("Milloin?", "When?")}</span>
          <select value={periodKey} onChange={event => setPeriodKey(event.target.value as ScratchPeriodKey)} aria-describedby="scratchpad-period-note">
            {scratchPeriods.map((item) => <option value={item.key} key={item.key} disabled={item.key !== "game" && !quartersAvailable}>{tr(item.labelFi, item.labelEn)}{item.key !== "game" && !quartersAvailable ? tr(" — ei vielä saatavilla", " — not yet available") : ""}</option>)}
          </select>
        </label>
      </div>

      <p id="scratchpad-period-note" className="scratchpad-note">{periodKey !== "game" && quartersAvailable
        ? tr("Neljännessummat lasketaan play-by-playsta. Mukana ovat vain ottelut, joiden tapahtumasummat täsmäävät box scoreen. Jatkoajat eivät sisälly neljänneksiin.", "Quarter totals come from play-by-play. Only games whose event totals match the box score are included. Quarters exclude overtime.")
        : quarterStatus === "loading" ? tr("Neljännestiedot latautuvat…", "Loading quarter data…")
        : quarterStatus === "error" ? tr("Neljännestietojen lataus epäonnistui. Päivitä sivu yrittääksesi uudelleen.", "Quarter data could not be loaded. Refresh to retry.")
        : !quartersAvailable ? tr("Tälle kaudelle ja mittarille ei ole vielä tarkistettua neljännesdataa.", "Verified quarter data is not available for this season and metric yet.")
        : tr("Voit rajata kysymyksen myös yksittäiseen neljännekseen.", "You can also limit the question to one quarter.")}</p>
      <div className="scratchpad-results" aria-live="polite" aria-atomic="true">
        <table>
          <thead><tr><th scope="col">{tr("Joukkue", "Team")}</th><th scope="col">{periodKey === "game" ? tr("Keskiarvo / ottelu", "Average / game") : tr("Keskiarvo / neljännes", "Average / quarter")}</th><th scope="col">{tr("Yhteensä", "Total")}</th><th scope="col">{tr("Ottelut", "Games")}</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.name}><th scope="row">{row.name}</th><td><strong>{row.average === null ? "—" : format(row.average, 1)}</strong></td><td>{format(row.total)}</td><td>{periodKey === "game" ? format(row.games) : `${row.games} / ${row.expectedGames}`}</td></tr>)}</tbody>
        </table>
        {rows.length === 0 && <p>{tr("Valinnalle ei ole saatavilla tuloksia.", "No results available for this selection.")}</p>}
      </div>
      <p className="scratchpad-note">{periodKey === "game" ? tr("Mukana koko ottelu jatkoaikoineen. ", "Full games include overtime. ") : tr("Ottelut = tämän mittarin tarkistettu otos / joukkueen ottelut. ", "Games = verified sample for this metric / team games. ")}{tr("Joukkueet järjestetään valitun jakson keskiarvon mukaan; suurempi luku ei aina tarkoita parempaa.", "Teams are ordered by the selected period's average; higher does not always mean better.")}</p>
    </section>
  );
}

function OverviewView({ onOpenTeams }: { onOpenTeams: () => void }) {
  const { leagueName, leagueNameEn, data: seasonData, loadMatches: loadSeasonMatches } = useSeason();
  const { tr } = useI18n();
  const league = seasonData.aggregate.league;
  const leaguePace = league.games > 0 ? league.metrics.estimated_possessions / (league.games * 2) : null;
  const [teamSort, setTeamSort] = useState<{ key: TeamSortKey; direction: SortDirection }>({ key: "net_rating", direction: "desc" });
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [seasonPlayers, setSeasonPlayers] = useState<SeasonPlayerRow[]>([]);
  const [seasonLoadStatus, setSeasonLoadStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    loadSeasonMatches().then((records) => {
      if (cancelled) return;
      setStandings(buildStandings(records, seasonData.aggregate.teams));
      setSeasonPlayers(aggregateSeasonPlayers(records));
      setSeasonLoadStatus("ready");
    }).catch(() => {
      if (!cancelled) setSeasonLoadStatus("error");
    });
    return () => {
      cancelled = true;
    };
  }, [loadSeasonMatches]);

  const sortedTeams = useMemo(() => [...seasonData.aggregate.teams].sort((a, b) => {
    const aValue = a.metrics[teamSort.key];
    const bValue = b.metrics[teamSort.key];
    return teamSort.direction === "desc" ? bValue - aValue : aValue - bValue;
  }), [teamSort, seasonData]);

  const toggleTeamSort = (key: TeamSortKey) => {
    setTeamSort((current) => current.key === key
      ? { key, direction: current.direction === "desc" ? "asc" : "desc" }
      : { key, direction: teamDefaultDirections[key] });
  };

  const qualifiedPlayers = useMemo(() => seasonPlayers.filter((player) => player.games >= 8 && player.minutes >= 120), [seasonPlayers]);
  const ppgLeader = [...qualifiedPlayers].sort((a, b) => (playerPerGame(b, "points") ?? -1) - (playerPerGame(a, "points") ?? -1))[0];
  const efficiencyLeader = [...qualifiedPlayers].sort((a, b) => (playerEfficiencyPer40(b) ?? -1) - (playerEfficiencyPer40(a) ?? -1))[0];
  const winner = standings[0];
  const lastPlace = standings[standings.length - 1];
  const missingLeaderName = seasonLoadStatus === "ready" ? tr("Ei vielä riittävää otosta", "Not enough games yet") : tr("Ladataan…", "Loading…");
  const missingPlayerTeam = seasonLoadStatus === "ready" ? tr("Min. 8 ottelua ja 120 minuuttia", "Min. 8 games and 120 minutes") : tr("Pelaajatiedot latautuvat", "Player data is loading");

  return (
    <>
      {seasonLoadStatus === "error" && <p role="alert">{tr("Kauden kärkien lataus epäonnistui. Päivitä sivu yrittääksesi uudelleen.", "Could not load season leaders. Refresh the page to retry.")}</p>}
      <section id="overview-summary" className="overview-metrics-grid overview-section-anchor" aria-label={tr("Liigan keskeiset tunnusluvut", "League key metrics")}>
        <div className="panel overview-metric"><strong>{overviewValue(league.metrics.offensive_rating)} <span className="overview-metric-unit">ORtg</span></strong><small>{tr("Sarjan hyökkäystehokkuus", "League offensive efficiency")}</small></div>
        <div className="panel overview-metric"><strong>{overviewValue(leaguePace)} <span className="overview-metric-unit">{tr("pallonhallintaa / ottelu", "possessions/game")}</span></strong><small>{tr("Pelin tempo", "Game pace")}</small></div>
        <div className="panel overview-metric"><strong>{overviewValue(league.metrics.three_point_attempt_rate, "%")} <span className="overview-metric-unit">{tr("kolmosyritysten osuus", "shots from three")}</span></strong><small>{tr("Heittoprofiili", "Shot profile")}</small></div>
        <div className="panel overview-metric"><strong>{overviewValue(league.metrics.efg_pct, "%")} <span className="overview-metric-unit">eFG</span></strong><small>{tr("Heittotehokkuus", "Shooting efficiency")}</small></div>
      </section>

      <section id="overview-leaders" className="panel overview-leaders-panel overview-section-anchor" aria-labelledby="overview-leaders-heading">
        <div className="panel-heading panel-heading--plain"><div><h3 id="overview-leaders-heading">{tr("Kauden kärjet", "Season leaders")}</h3><p className="panel-subcopy">{tr("Perusluvut saavat tässä rinnalleen kauden kontekstin.", "Core stats, with season context alongside them.")}</p></div><span className="panel-context">{tr("min. 8 ottelua pelaajille", "min. 8 games for players")}</span></div>
        <div className="overview-leader-grid">
          <PaperLeaderCard
            title={tr("Runkosarjan ykkönen", "Regular-season leader")}
            playerName={winner?.name ?? missingLeaderName}
            value={winner ? `${winner.wins} ${tr("voittoa", "wins")}` : "—"}
            team={winner ? `${overviewSignedIntegerValue(winner.pointsFor - winner.pointsAgainst)} ${tr("piste-ero", "point differential")}` : tr("Sijoitus muodostetaan", "Ranking is calculated")}
            shaderColor="#54E08B33"
            valueColor="var(--success-strong)"
            visual={<PaperTeamMarker teamName={winner?.name ?? "?"} status="winner" />}
          />
          <PaperLeaderCard
            title={tr("Runkosarjan viimeinen", "Bottom of the regular season")}
            playerName={lastPlace?.name ?? missingLeaderName}
            value={lastPlace ? `${lastPlace.losses} ${tr("tappiota", "losses")}` : "—"}
            team={lastPlace ? `${overviewSignedIntegerValue(lastPlace.pointsFor - lastPlace.pointsAgainst)} ${tr("piste-ero", "point differential")}` : tr("Sijoitus muodostetaan", "Ranking is calculated")}
            shaderColor="#FF756A33"
            valueColor="var(--danger-strong)"
            visual={<PaperTeamMarker teamName={lastPlace?.name ?? "?"} status="last" />}
          />
          <PaperLeaderCard
            title={tr("Eniten pisteitä / ottelu", "Most points / game")}
            playerName={ppgLeader?.name ?? missingLeaderName}
            value={ppgLeader ? `${overviewValue(playerPerGame(ppgLeader, "points"))} PPG` : "—"}
            team={ppgLeader?.team ?? missingPlayerTeam}
            shaderColor="#6B49DE33"
            valueColor="var(--success-strong)"
          />
          <PaperLeaderCard
            title={tr("Tehokkain peliaikaan nähden", "Most efficient per minute")}
            playerName={efficiencyLeader?.name ?? missingLeaderName}
            value={efficiencyLeader ? `${overviewValue(playerEfficiencyPer40(efficiencyLeader))} Eff/40` : "—"}
            team={efficiencyLeader?.team ?? missingPlayerTeam}
            shaderColor="#54E08B33"
            valueColor="var(--success-strong)"
          />
        </div>
      </section>

      <AnalysisQuestion />
      <section id="overview-teams" className="overview-section-anchor">
        <div className="panel overview-table-panel">
          <div className="panel-heading panel-heading--plain"><div><h3>{tr("Joukkueiden tehokkuus", "Team efficiency")}</h3><p className="panel-subcopy">{tr("Net Rating yhdistää hyökkäyksen ja puolustuksen samaan vertailuun.", "Net Rating combines offense and defense in one comparison.")}</p></div><button className="outline-button small" onClick={onOpenTeams}>{tr("Joukkueprofiilit", "Team profiles")} <ArrowUpRight /></button></div>
          <div className="overview-table-wrap">
            <table className="overview-table">
              <caption className="sr-only">{tr(`${leagueName}: joukkueiden tehokkuusvertailu`, `${leagueNameEn} team efficiency comparison`)}</caption>
              <thead><tr><th scope="col">#</th><th scope="col">{tr("Joukkue", "Team")}</th>{(Object.keys(teamSortLabels) as TeamSortKey[]).map((key) => <th key={key} scope="col" aria-sort={teamSort.key === key ? teamSort.direction === "asc" ? "ascending" : "descending" : "none"}><button className={`table-sort-button ${teamSort.key === key ? "active" : ""}`} type="button" onClick={() => toggleTeamSort(key)} aria-label={`${tr("Järjestä", "Sort by")} ${teamSortLabel(key, tr)}`}><span>{teamSortLabel(key, tr)}</span><span className="sort-indicator" aria-hidden="true"><Icon name={teamSort.key !== key ? "sort" : teamSort.direction === "asc" ? "sortAsc" : "sortDesc"} size={12} /></span></button></th>)}</tr></thead>
              <tbody>{sortedTeams.map((team, index) => <tr className={index === 0 ? "overview-team-row--leader" : index === sortedTeams.length - 1 ? "overview-team-row--trailing" : ""} key={team.name}><td className="rank">{index + 1}</td><th scope="row">{team.name}</th><td>{overviewValue(team.metrics.offensive_rating)}</td><td>{overviewValue(team.metrics.defensive_rating)}</td><td className={team.metrics.net_rating >= 0 ? "metric-positive" : "metric-negative"}>{overviewSignedValue(team.metrics.net_rating)}</td><td>{overviewValue(team.metrics.three_point_attempt_rate, "%")}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="overview-table-note">{tr("Klikkaa mittarin otsikkoa vaihtaaksesi järjestystä. Sijoitus seuraa valittua mittaria; DRtg:ssä pienempi on parempi, joten oletus alkaa pienimmästä.", "Click a metric heading to change the order. Ranking follows the selected metric; lower DRtg is better, so it starts from the lowest value.")}</p>
        </div>
      </section>
      <div className="overview-coverage"><span><strong>{tr("Aineisto", "Dataset")}</strong><span>{tr("tarkistettu runkosarjan box score -aineisto", "verified regular-season box score data")}</span></span><span><strong>Basket.fi</strong><span>{tr("päivämäärät tuloslistalta · tilastot ottelusivuilta", "dates from results page · stats from game pages")}</span></span></div>
    </>
  );
}

function TeamsView({ selectedTeamId, onOpenMatch }: { selectedTeamId: string; onOpenMatch: (id: string) => void }) {
  const { data: seasonData, loadMatches: loadSeasonMatches } = useSeason();
  const { tr } = useI18n();
  const netRankedTeams = useMemo(() => [...seasonData.aggregate.teams].sort((a, b) => b.metrics.net_rating - a.metrics.net_rating), [seasonData]);
  const largestNetRating = Math.max(1, ...netRankedTeams.map((team) => Math.abs(team.metrics.net_rating)));
  const leadingTeam = netRankedTeams[0];
  const trailingTeam = netRankedTeams[netRankedTeams.length - 1];
  const [seasonMatches, setSeasonMatches] = useState<SeasonMatchRecord[]>([]);
  const [seasonLoadStatus, setSeasonLoadStatus] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    let cancelled = false;
    loadSeasonMatches().then((records) => {
      if (cancelled) return;
      setSeasonMatches(records);
      setSeasonLoadStatus("ready");
    }).catch(() => {
      if (!cancelled) setSeasonLoadStatus("error");
    });
    return () => { cancelled = true; };
  }, [loadSeasonMatches]);

  return <>
      <TeamProfiles selectedTeamId={selectedTeamId} onOpenMatch={onOpenMatch} matches={seasonMatches} matchStatus={seasonLoadStatus} />
      <section className="teams-league-comparisons" aria-labelledby="league-comparisons-heading">
      <header id="league-comparisons" className="teams-scope-heading overview-section-anchor">
        <h2 id="league-comparisons-heading">{tr("Liigan vertailut", "League comparisons")}</h2>
        <p>{tr("Nämä työkalut eivät seuraa yllä valittua profiilin joukkuetta. Tarkastele koko liigaa tai rajaa vertailua työkalujen omilla valinnoilla.", "These tools do not follow the profile team selected above. Explore the whole league or narrow comparisons using each tool's own controls.")}</p>
      </header>
      <section id="team-control-distribution" className="team-control-distribution overview-section-anchor">
        <div className="panel overview-control-panel">
          <div className="panel-heading panel-heading--plain"><div><h3>{tr("Hallinnan jakauma", "Control distribution")}</h3><p className="panel-subcopy">{tr("Net Rating tekee joukkueiden peliedusta näkyvän suhteessa nollatasoon.", "Net Rating makes each team's edge visible relative to zero.")}</p></div><span className="panel-context panel-context--derived">proxy</span></div>
          <div className="control-plot" role="group" aria-labelledby="control-plot-title">
            <span id="control-plot-title" className="sr-only">{tr("Joukkueiden Net Rating -jakauma: positiivinen arvo on nollatason oikealla puolella ja negatiivinen vasemmalla puolella.", "Team Net Rating distribution: positive values sit right of zero and negative values sit left of zero.")}</span>
            <div className="control-scale"><span>{tr("alle 0", "below 0")}</span><span>0</span><span>{tr("yli 0", "above 0")}</span></div>
            <div className="control-rows">{netRankedTeams.map((team) => {
              const isPositive = team.metrics.net_rating >= 0;
              const barWidth = `${(Math.abs(team.metrics.net_rating) / largestNetRating) * 45}%`;
              return <div className="control-row" key={team.name}><span>{team.name}</span><div className="control-track"><i className={`control-bar ${isPositive ? "positive" : "negative"}`} style={isPositive ? { left: "50%", width: barWidth } : { right: "50%", width: barWidth }} /></div><b className={isPositive ? "metric-positive" : "metric-negative"}>{overviewSignedValue(team.metrics.net_rating)}</b></div>;
            })}</div>
          </div>
          <div className="control-readout"><strong>{leadingTeam.name} {overviewSignedValue(leadingTeam.metrics.net_rating)} · {trailingTeam.name} {overviewSignedValue(trailingTeam.metrics.net_rating)}</strong><p>{tr("Net Rating on tässä hallinnan suuntaa-antava proxy: se tiivistää hyökkäyksen ja puolustuksen piste-eron arvioitua pallonhallintaa kohden. Se on KorisLabin laskennallinen mittari, ei virallinen tilastokenttä.", "Net Rating is a directional proxy here: it summarizes scoring margin per estimated possession. It is a KorisLab calculation, not an official box-score field.")}</p></div>
        </div>
      </section>

      <div id="team-style-map" className="overview-section-anchor"><TeamStyleMap teams={seasonData.aggregate.teams} /></div>
      <div id="team-game-split" className="overview-section-anchor"><TeamGameSplit matches={seasonMatches} /></div>

      {seasonLoadStatus === "loading" && <p role="status">{tr("Ladataan ottelukohtaista vertailua…", "Loading game-level comparison…")}</p>}
      {seasonLoadStatus === "error" && <p role="alert">{tr("Ottelukohtaisen vertailun lataus epäonnistui. Päivitä sivu yrittääksesi uudelleen.", "Could not load game-level comparison. Refresh the page to retry.")}</p>}
      </section>
  </>;
}

function SeasonThreePointStory({ onOpenTeams, onOpenMatch }: { onOpenTeams: (teamId: string) => void; onOpenMatch: (id: string) => void }) {
  const { data: seasonData, loadMatches: loadSeasonMatches } = useSeason();
  const [seasonMatches, setSeasonMatches] = useState<SeasonMatchRecord[]>([]);
  const [seasonLoadStatus, setSeasonLoadStatus] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    let cancelled = false;
    loadSeasonMatches().then((records) => {
      if (cancelled) return;
      setSeasonMatches(records);
      setSeasonLoadStatus("ready");
    }).catch(() => {
      if (!cancelled) setSeasonLoadStatus("error");
    });
    return () => { cancelled = true; };
  }, [loadSeasonMatches]);
  const seasonPlayers = useMemo(() => aggregateSeasonPlayers(seasonMatches), [seasonMatches]);
  const threePointTeams = [...seasonData.aggregate.teams].sort((a, b) => b.per_game.three_pa - a.per_game.three_pa);
  const featuredThreePointTeam = threePointTeams[0];
  const featuredThreePointGames = useMemo<ThreePointGameRow[]>(() => {
    if (!featuredThreePointTeam) return [];
    return seasonMatches.flatMap((record) => {
      const team = record.teams.find((row) => row.source_id === featuredThreePointTeam.source_team_id);
      const opponent = record.teams.find((row) => row.source_id !== featuredThreePointTeam.source_team_id);
      if (!team || !opponent || record.teams.length !== 2 || team.stats.three_pa === null || team.stats.three_pm === null) return [];
      return [{
        id: record.game.source_id,
        date: scheduledAtFor(record),
        opponent: opponent.name,
        home: team.home_away === "home",
        points: team.score,
        opponentPoints: opponent.score,
        threePM: team.stats.three_pm,
        threePA: team.stats.three_pa,
      }];
    }).sort((a, b) => {
      const aDate = a.date && Number.isFinite(Date.parse(a.date)) ? Date.parse(a.date) : Number.POSITIVE_INFINITY;
      const bDate = b.date && Number.isFinite(Date.parse(b.date)) ? Date.parse(b.date) : Number.POSITIVE_INFINITY;
      return aDate - bDate || a.id.localeCompare(b.id);
    });
  }, [seasonMatches, featuredThreePointTeam?.source_team_id]);
  return <>
      {featuredThreePointTeam && <ThreePointStory
        team={featuredThreePointTeam}
        nextTeam={threePointTeams[1]}
        league={seasonData.aggregate.league}
        players={seasonPlayers}
        games={featuredThreePointGames}
        dataStatus={seasonLoadStatus}
        onOpenTeamProfile={onOpenTeams}
        onOpenMatch={onOpenMatch}
      />}

  </>;
}

type PlayerSeasonSortKey = "games" | "minutes" | "pointsPerGame" | "fgPct" | "threePct" | "reboundsPerGame" | "assistsPerGame" | "assistTurnover" | "ftPct" | "efgPct" | "stealsPerGame" | "efficiencyPer40" | "attemptsPer40";

const playerSeasonSortLabels: Record<PlayerSeasonSortKey, string> = {
  games: "GP",
  minutes: "MIN",
  pointsPerGame: "PPG",
  fgPct: "FG%",
  threePct: "3P%",
  reboundsPerGame: "REB/G",
  assistsPerGame: "AST/G",
  assistTurnover: "AST/TO",
  ftPct: "FT%",
  efgPct: "eFG%",
  stealsPerGame: "STL/G",
  efficiencyPer40: "Eff/40",
  attemptsPer40: "FGA/40",
};

function playerSeasonSortValue(player: SeasonPlayerRow, key: PlayerSeasonSortKey) {
  switch (key) {
    case "games": return player.games;
    case "minutes": return player.minutes;
    case "pointsPerGame": return playerPerGame(player, "points");
    case "fgPct": return playerFgPctFromTotals(player);
    case "threePct": return playerThreePctFromTotals(player);
    case "reboundsPerGame": return playerPerGame(player, "rebounds");
    case "assistsPerGame": return playerPerGame(player, "assists");
    case "assistTurnover": return playerAssistTurnoverRatio(player);
    case "ftPct": return playerFtPctFromTotals(player);
    case "efgPct": return playerEfGPctFromTotals(player);
    case "stealsPerGame": return playerPerGame(player, "steals");
    case "efficiencyPer40": return playerEfficiencyPer40(player);
    case "attemptsPer40": return playerAttemptsPer40(player);
  }
}

function PlayersView({ onOpenPlayer }: { onOpenPlayer: (id: string) => void }) {
  const { leagueId, leagueName, leagueNameEn, seasonId, seasonLabel, loadMatches: loadSeasonMatches } = useSeason();
  const { tr, language } = useI18n();
  const [loaded, setLoaded] = useState(false);
  const [seasonPlayers, setSeasonPlayers] = useState<SeasonPlayerRow[]>([]);
  const [query, setQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");
  const [sort, setSort] = useState<{ key: PlayerSeasonSortKey; direction: SortDirection }>({ key: "pointsPerGame", direction: "desc" });
  const [visiblePlayerCount, setVisiblePlayerCount] = useState(10);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setLoadError(false);
    loadSeasonMatches()
      .then((records) => {
        if (!cancelled) { setSeasonPlayers(aggregateSeasonPlayers(records)); setLoaded(true); }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [loadSeasonMatches]);

  useEffect(() => {
    setVisiblePlayerCount(10);
  }, [seasonId]);

  const teams = useMemo(() => Array.from(new Set(seasonPlayers.map((player) => player.team))).sort((a, b) => a.localeCompare(b, "fi")), [seasonPlayers]);
  const filteredPlayers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("fi-FI");
    return seasonPlayers.filter((player) => {
      const matchesTeam = teamFilter === "all" || player.team === teamFilter;
      const matchesQuery = normalizedQuery.length === 0 || `${player.name} ${player.team}`.toLocaleLowerCase("fi-FI").includes(normalizedQuery);
      return matchesTeam && matchesQuery;
    });
  }, [seasonPlayers, query, teamFilter]);
  const sortedPlayers = useMemo(() => [...filteredPlayers].sort((a, b) => {
    const aValue = playerSeasonSortValue(a, sort.key);
    const bValue = playerSeasonSortValue(b, sort.key);
    if (aValue === null && bValue === null) return a.name.localeCompare(b.name, "fi");
    if (aValue === null) return 1;
    if (bValue === null) return -1;
    if (aValue !== bValue) return sort.direction === "desc" ? bValue - aValue : aValue - bValue;
    return a.name.localeCompare(b.name, "fi");
  }), [filteredPlayers, sort]);

  const qualifiedPlayers = useMemo(() => seasonPlayers.filter((player) => player.games >= 8 && player.minutes >= 120), [seasonPlayers]);
  const best = (metric: (row: SeasonPlayerRow) => number | null, rows = qualifiedPlayers) => [...rows].filter((row) => metric(row) != null).sort((a, b) => (metric(b) ?? -1) - (metric(a) ?? -1) || a.name.localeCompare(b.name, "fi"))[0];
  const decimal = (value: number | null) => value == null ? "—" : value.toLocaleString(language === "fi" ? "fi-FI" : "en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const leaders = [
    { label: tr("Eniten pisteitä / ottelu", "Most points / game"), player: best((row) => playerPerGame(row, "points")), value: (row: SeasonPlayerRow) => decimal(playerPerGame(row, "points")), unit: "PPG" },
    { label: tr("Eniten syöttöjä / ottelu", "Most assists / game"), player: best((row) => playerPerGame(row, "assists")), value: (row: SeasonPlayerRow) => decimal(playerPerGame(row, "assists")), unit: "AST/G" },
    { label: tr("Eniten levypalloja / ottelu", "Most rebounds / game"), player: best((row) => playerPerGame(row, "rebounds")), value: (row: SeasonPlayerRow) => decimal(playerPerGame(row, "rebounds")), unit: "REB/G" },
    { label: tr("Eniten riistoja / ottelu", "Most steals / game"), player: best((row) => playerPerGame(row, "steals")), value: (row: SeasonPlayerRow) => decimal(playerPerGame(row, "steals")), unit: "STL/G" },
    { label: tr("Tehokkain peliaikaan nähden", "Most efficient per minute"), player: best(playerEfficiencyPer40), value: (row: SeasonPlayerRow) => decimal(playerEfficiencyPer40(row)), unit: "Eff/40" },
    { label: tr("Eniten peliminuutteja", "Most minutes played"), player: best((row) => row.minutes, seasonPlayers), value: (row: SeasonPlayerRow) => decimal(row.minutes), unit: "MIN" },
  ];

  const togglePlayerSort = (key: PlayerSeasonSortKey) => {
    setVisiblePlayerCount(10);
    setSort((current) => current.key === key
      ? { key, direction: current.direction === "desc" ? "asc" : "desc" }
      : { key, direction: "desc" });
  };

  const sortableHeader = (key: PlayerSeasonSortKey) => {
    const active = sort.key === key;
    return <th key={key} scope="col" aria-sort={active ? sort.direction === "asc" ? "ascending" : "descending" : "none"}><button className={`table-sort-button ${active ? "active" : ""}`} type="button" onClick={() => togglePlayerSort(key)} aria-label={`${tr("Järjestä", "Sort by")} ${playerSeasonSortLabels[key]}`}><span>{playerSeasonSortLabels[key]}</span><span className="sort-indicator" aria-hidden="true"><Icon name={!active ? "sort" : sort.direction === "asc" ? "sortAsc" : "sortDesc"} size={12} /></span></button></th>;
  };

  return (
    <>
      <section className="players-toolbar panel">
        <div><strong>{tr(leagueName, leagueNameEn)} · {seasonLabel}</strong><p>{seasonPlayers.length > 0 ? tr(`${seasonPlayers.length} pelaajaa yhdistetty ottelukohtaisista box scoreista.`, `${seasonPlayers.length} players merged from game-level box scores.`) : loaded ? tr("Ei vielä pelaajatilastoja.", "No player statistics yet.") : tr("Ladataan kauden pelaajia…", "Loading season players…")} {tr("Järjestettävä listaus näyttää koko aineiston, ei vain kärkinimiä.", "The sortable list shows the full dataset, not only the leaders.")}</p></div>
        <div className="players-toolbar-controls">
          <label>{tr("Hae pelaajista", "Search players")}<input aria-label={tr("Hae pelaajista", "Search players")} value={query} onChange={(event) => { setQuery(event.target.value); setVisiblePlayerCount(10); }} placeholder={tr("Pelaaja tai joukkue", "Player or team")} /></label>
          <label>{tr("Joukkue", "Team")}<select aria-label={tr("Rajaa pelaajat joukkueella", "Filter players by team")} value={teamFilter} onChange={(event) => { setTeamFilter(event.target.value); setVisiblePlayerCount(10); }}><option value="all">{tr("Kaikki joukkueet", "All teams")}</option>{teams.map((team) => <option key={team} value={team}>{team}</option>)}</select></label>
        </div>
      </section>

      <section className="players-leaders-section" aria-labelledby="player-leaders-heading">
        <div className="player-leaders-heading"><h2 id="player-leaders-heading">{tr("Kauden kärjet", "Season leaders")}</h2><p>{tr("Keskiarvot ja Eff/40: vähintään 8 ottelua ja 120 minuuttia. Peliminuutit ovat kauden summa.", "Averages and Eff/40: at least 8 games and 120 minutes. Playing time is the season total.")}</p></div>
        <div className="players-leaders-grid">{leaders.map((leader) => {
          const content = <><span className="stat-label">{leader.label}</span><div className="player-leader-identity"><PlayerPortrait className="player-list-portrait" /><strong>{leader.player?.name ?? (loadError ? tr("Data ei saatavilla", "Data unavailable") : loaded ? tr("Ei vielä riittävää otosta", "Not enough games yet") : tr("Ladataan…", "Loading…"))}</strong></div><b>{leader.player ? `${leader.value(leader.player)} ${leader.unit}` : "—"}</b><small>{leader.player ? `${leader.player.team} · ${leader.player.games} ${tr("ottelua", "games")}` : ""}</small></>;
          return leader.player ? <a className="panel player-leader-card" key={leader.label} href={routeHref("player-profile", seasonId, leader.player.id, leagueId)} onClick={(event) => followLink(event, () => onOpenPlayer(leader.player!.id))}>{content}<span className="leader-profile-hint">{tr("Pelaajaprofiili", "Player profile")} <Icon name="arrowOutward" size={13} /></span></a> : <div className="panel player-leader-card" key={leader.label}>{content}</div>;
        })}</div>
      </section>

      <AssistCreation players={filteredPlayers} onOpenPlayer={onOpenPlayer} />

      <section className="panel players-table-panel" aria-labelledby="players-list-heading">
        <div className="panel-heading panel-heading--plain"><div><h2 id="players-list-heading">{tr("Pelaajapooli", "Player pool")}</h2><p className="panel-subcopy">{tr("Kaikki kentällä käyneet pelaajat. Klikkaa mittaria vaihtaaksesi järjestyksen.", "Every player who played. Click a metric to change the order.")}</p></div><span className="panel-context">{seasonPlayers.length > 0 ? `${filteredPlayers.length} / ${seasonPlayers.length}` : "—"}</span></div>
        {loadError ? <div className="match-list-empty"><strong>{tr("Pelaajalistan lataus epäonnistui", "Could not load players")}</strong><p>{tr("Yritä päivittää sivu. Datan lähde on paikallinen kausitiedosto.", "Try refreshing the page. The data source is a local season file.")}</p></div> : seasonPlayers.length === 0 ? <div className="match-list-empty"><strong>{loaded ? tr("Ei vielä pelaajatilastoja", "No player statistics yet") : tr("Ladataan pelaajia…", "Loading players…")}</strong><p>{tr("Pelaajat lisätään varmennettujen ottelutilastojen mukana.", "Players appear with verified game statistics.")}</p></div> : sortedPlayers.length === 0 ? <div className="match-list-empty"><strong>{tr("Ei osumia", "No matches")}</strong><p>{tr("Muuta hakua tai joukkuevalintaa.", "Change the search or team filter.")}</p></div> : <>
          <div className="players-table-wrap">
          <table id="player-pool-table" className="players-table player-pool-table">
            <caption className="sr-only">{leagueName} · {seasonLabel}</caption>
            <thead><tr><th scope="col">#</th><th scope="col">{tr("Pelaaja", "Player")}</th><th scope="col">{tr("Joukkue", "Team")}</th>{(Object.keys(playerSeasonSortLabels) as PlayerSeasonSortKey[]).map(sortableHeader)}</tr></thead>
            <tbody>{sortedPlayers.slice(0, visiblePlayerCount).map((player, index) => <tr key={player.id}><td className="rank">{index + 1}</td><th scope="row" className="players-table-player"><div className="player-list-identity"><PlayerPortrait className="player-list-portrait" /><div><a className="player-name-link" href={routeHref("player-profile", seasonId, player.id, leagueId)} onClick={(event) => followLink(event, () => onOpenPlayer(player.id))}>{player.name}</a><small>{player.starts > 0 ? `${player.starts} ${tr("aloitusta", "starts")}` : tr("Ei avausmerkintää", "No start data")}</small></div></div></th><td className="players-table-team">{player.team}</td><td>{player.games}</td><td>{decimal(player.minutes)}</td><td className="players-table-emphasis">{decimal(playerPerGame(player, "points"))}</td><td>{playerFgPctFromTotals(player) == null ? "—" : `${decimal(playerFgPctFromTotals(player))}%`}</td><td>{playerThreePctFromTotals(player) == null ? "—" : `${decimal(playerThreePctFromTotals(player))}%`}</td><td>{decimal(playerPerGame(player, "rebounds"))}</td><td>{decimal(playerPerGame(player, "assists"))}</td><td>{decimal(playerAssistTurnoverRatio(player))}</td><td>{playerFtPctFromTotals(player) == null ? "—" : `${decimal(playerFtPctFromTotals(player))}%`}</td><td>{playerEfGPctFromTotals(player) == null ? "—" : `${decimal(playerEfGPctFromTotals(player))}%`}</td><td>{decimal(playerPerGame(player, "steals"))}</td><td className="players-table-emphasis">{decimal(playerEfficiencyPer40(player))}</td><td>{decimal(playerAttemptsPer40(player))}</td></tr>)}</tbody>
          </table>
          </div>
          <div className="player-pool-pagination">
            <span aria-live="polite">{tr(`Näytetään ${Math.min(visiblePlayerCount, sortedPlayers.length)} / ${sortedPlayers.length} pelaajaa`, `Showing ${Math.min(visiblePlayerCount, sortedPlayers.length)} / ${sortedPlayers.length} players`)}</span>
            {visiblePlayerCount < sortedPlayers.length && <button className="outline-button" type="button" aria-controls="player-pool-table" onClick={() => setVisiblePlayerCount((count) => Math.min(count + 10, sortedPlayers.length))}>{sortedPlayers.length - visiblePlayerCount > 10 ? tr("Näytä seuraavat 10", "Show next 10") : tr(`Näytä loput ${sortedPlayers.length - visiblePlayerCount}`, `Show remaining ${sortedPlayers.length - visiblePlayerCount}`)}</button>}
          </div>
        </>}
        <p className="players-method-note">{tr("Kosketuksia ei ole mukana saatavilla olevissa ottelutilastoissa. Eff/40 normalisoi tehokkuusluvun peliaikaan; FGA/40 kertoo samalla, kuinka aktiivisesti pelaaja käytti heittoja. Nämä eivät väitä mittaavansa kosketuksia.", "Touches are not included in the available game statistics. Eff/40 normalizes the efficiency figure to playing time; FGA/40 adds a shot-activity context. Neither claims to measure touches.")}</p>
      </section>
    </>
  );
}

function SeasonView({ onOpenTeams, onOpenMatch }: { onOpenTeams: (teamId: string) => void; onOpenMatch: (id: string) => void }) {
  const { leagueId, leagueName, leagueNameEn, historicalSummaries, playoffSummaries, data: seasonData, seasonId, seasonLabel, current } = useSeason();
  const { tr, language } = useI18n();
  const totals = seasonData.aggregate.league.totals;
  const games = seasonData.aggregate.games;
  const totalTwoPM = totals.two_pm;
  const totalTwoPA = totals.two_pa;
  const totalThreePM = totals.three_pm;
  const totalThreePA = totals.three_pa;
  const totalFgm = totalTwoPM + totalThreePM;
  const totalFga = totalTwoPA + totalThreePA;
  const decimal = (value: number | null) => value == null ? "—" : value.toLocaleString(language === "fi" ? "fi-FI" : "en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const percent = (value: number, denominator: number) => denominator === 0 ? "—" : `${decimal(value / denominator * 100)}%`;
  const perTeamGame = (value: number | null) => games > 0 && value != null ? decimal(value / (2 * games)) : "—";
  const averageNote = tr("per joukkue / ottelu · runkosarja", "per team / game · regular season");
  const sampleMetrics = [
    { label: tr("Pisteet", "Points"), value: perTeamGame(totals.points), note: averageNote },
    { label: tr("Levypallot", "Rebounds"), value: perTeamGame(totals.rebounds), note: averageNote },
    { label: tr("Syötöt", "Assists"), value: perTeamGame(totals.assists), note: averageNote },
    { label: tr("Riistot", "Steals"), value: perTeamGame(totals.steals), note: averageNote },
    { label: tr("Menetykset", "Turnovers"), value: perTeamGame(totals.turnovers), note: averageNote },
    { label: tr("Torjunnat", "Blocks"), value: perTeamGame(totals.blocks), note: averageNote },
    { label: "ORtg", value: decimal(seasonData.aggregate.league.metrics.offensive_rating), note: tr("pisteet / 100 arvioitua pallonhallintaa", "points / 100 estimated possessions") },
    { label: "FG%", value: percent(totalFgm, totalFga), note: tr("kenttäheitot · 2P + 3P yhteensä", "field goals · 2P + 3P combined") },
  ];

  return (
    <>
      <section className="season-toolbar panel">
        <div><strong>{tr(leagueName, leagueNameEn)}</strong><small>{tr("Kaikki joukkueet · ottelukohtainen box score", "All teams · game-level box scores")}</small></div>
        <div className="season-toolbar-actions"><span className="season-chip active">{seasonLabel}</span><span className="season-chip">{seasonId !== "2026-27" && games === seasonData.summary.available_played_games ? tr("Koko runkosarja", "Full regular season") : tr("Osittainen aineisto", "Partial dataset")}</span><span className="season-sample">{games} / {seasonData.summary.available_played_games} {tr("ottelua tarkistettu", "games verified")}</span></div>
      </section>

      <section id="season-summary" className="season-metrics-grid overview-section-anchor">
        {sampleMetrics.map((metric) => <div className="panel season-metric" key={metric.label}><span className="stat-label">{metric.label}</span><strong>{metric.value}</strong><small>{metric.note}</small></div>)}
      </section>

      {seasonId !== "2026-27" ? <SeasonPhaseComparison /> : <section className="panel detail-panel"><h2>{tr("Pudotuspelivertailu avautuu keväällä", "Playoff comparison opens in spring")}</h2><p>{tr("Kauden 2026–27 pudotuspelejä ei ole vielä pelattu.", "The 2026–27 playoffs have not been played yet.")}</p></section>}

      <div id="season-three-point-story" className="overview-section-anchor"><SeasonThreePointStory onOpenTeams={onOpenTeams} onOpenMatch={onOpenMatch} /></div>

      <SeasonShotDistance seasonId={seasonId} />

      <section className="season-layout">
        <div id="season-reading" className="panel season-trend-panel overview-section-anchor">
          <div className="panel-heading panel-heading--plain"><div><h3>{tr("Miten lukuja luetaan?", "How to read the numbers")}</h3></div></div>
          <div className="season-read-grid season-read-grid--stacked">
            <div><strong>{tr("Sama mittakaava", "A shared scale")}</strong><p>{tr("Pääkortit näyttävät yhden joukkueen keskimääräisen ottelun runkosarjassa. Näin syöttöjä, levypalloja ja riistoja voi verrata joukkueiden omiin lukuihin.", "The cards describe an average team game in the regular season, so assists, rebounds and steals can be compared with team figures.")}</p></div>
            <div><strong>{tr("Pallollinen peli ja puolustus", "Offense and defense")}</strong><p>{tr("Syötöt kuvaavat korisyöttöjä, riistot pallon voittamista vastustajalta ja torjunnat heiton pysäyttämistä. Levypallot sisältävät hyökkäys- ja puolustuslevypallot.", "Assists count passes leading to baskets, steals count taking the ball from opponents, and blocks count stopped shots. Rebounds include offensive and defensive rebounds.")}</p></div>
            <div><strong>{tr("Vertaa kausia Matchup Labissa", "Compare seasons in Matchup Lab")}</strong><p>{tr("Matchup Labissa voit verrata kausia 2024–25 ja 2025–26. Ensimmäinen sisältää myös jatkosarjat, ja yhdestä ottelusta puuttuu täydellinen box score.", "Compare 2024–25 and 2025–26 in Matchup Lab. The first includes continuation rounds, and one game lacks a complete box score.")}</p></div>
          </div>
        </div>

        <div id="season-coverage" className="panel season-coverage-panel overview-section-anchor">
          <div className="panel-heading panel-heading--plain"><div><h3>{tr("Data kasvaa näin", "How the dataset grows")}</h3></div><span className="signal-count">2 / 3</span></div>
          <div className="season-timeline">
            {(["2024-25", "2025-26"] as const).map(season => <div key={season} className={`season-timeline-row${season === seasonId ? " current" : ""}`}><span>{season.replace("-", "–")}</span><strong>{historicalSummaries[season].aggregate.games} / {historicalSummaries[season].summary.available_played_games} {tr("ottelua", "games")}</strong><small>{season === "2024-25" || leagueId === "korisliiga" ? tr("runko- ja jatkosarjat", "regular and continuation rounds") : tr("runkosarja", "regular season")} · {playoffSummaries[season].aggregate.games} / {playoffSummaries[season].summary.available_played_games} {tr("pudotuspeliottelua", "playoff games")}</small></div>)}
            <div className="season-timeline-row"><span>2026–27</span><strong>{tr("Kerätään", "Collecting")}</strong><small>{tr(`${current?.schedule_summary.games ?? 0} ohjelmassa · ${current?.schedule_summary.played_games ?? 0} pelattua`, `${current?.schedule_summary.games ?? 0} scheduled · ${current?.schedule_summary.played_games ?? 0} played`)}</small></div>
          </div>
          <p className="season-coverage-note">{tr("Kun kausien määrä ja ottelumäärä kasvavat, sama näkymä vaihtuu testinäytteestä oikeaksi trendianalyysiksi.", "As seasons and game counts grow, this view will move from a test sample to a real trend analysis.")}</p>
        </div>
      </section>


    </>
  );
}

type MatchComparison = {
  key: string;
  label: string;
  home: number | null;
  away: number | null;
  higherIsBetter: boolean;
  format?: (value: number | null) => string;
};

type ComparisonResult = "home" | "away" | "tie" | "unknown";

function getComparisonResult(home: number | null, away: number | null, higherIsBetter: boolean): ComparisonResult {
  if (home === null || away === null) return "unknown";
  if (home === away) return "tie";
  const homeIsBetter = higherIsBetter ? home > away : home < away;
  return homeIsBetter ? "home" : "away";
}

function comparisonText(result: ComparisonResult, side: "home" | "away", language: Language) {
  if (result === "unknown") return language === "fi" ? "Vertailu puuttuu" : "Comparison unavailable";
  if (result === "tie") return language === "fi" ? "Tasapeli" : "Tie";
  return result === side ? language === "fi" ? "Parempi" : "Better" : language === "fi" ? "Heikompi" : "Worse";
}

function ComparisonValue({ metric, side, result }: { metric: MatchComparison; side: "home" | "away"; result: ComparisonResult }) {
  const { language } = useI18n();
  const value = side === "home" ? metric.home : metric.away;
  const state = result === "tie" ? "tie" : result === side ? "better" : result === "unknown" ? "unknown" : "worse";
  return <strong className={`comparison-value comparison-value--${state}`} aria-label={`${metric.label}: ${value === null ? language === "fi" ? "ei dataa" : "no data" : metric.format ? metric.format(value) : value}, ${comparisonText(result, side, language).toLowerCase()}`}>
    {value === null ? "—" : metric.format ? metric.format(value) : value}
  </strong>;
}

function ComparisonRow({ metric }: { metric: MatchComparison }) {
  const result = getComparisonResult(metric.home, metric.away, metric.higherIsBetter);
  return <div className="comparison-row">
    <ComparisonValue metric={metric} side="home" result={result} />
    <span>{metric.label}</span>
    <ComparisonValue metric={metric} side="away" result={result} />
  </div>;
}

const mobileNavItems: Array<{ labelFi: string; labelEn: string; mobileLabelFi: string; mobileLabelEn: string; view: ViewKey; icon: IconName }> = [
  { labelFi: "Yleiskatsaus", labelEn: "Overview", mobileLabelFi: "Katsaus", mobileLabelEn: "Overview", view: "overview", icon: "overview" },
  { labelFi: "Ottelut", labelEn: "Games", mobileLabelFi: "Ottelut", mobileLabelEn: "Games", view: "matches", icon: "games" },
  { labelFi: "Joukkueet", labelEn: "Teams", mobileLabelFi: "Joukkueet", mobileLabelEn: "Teams", view: "teams", icon: "teams" },
  { labelFi: "Pelaajat", labelEn: "Players", mobileLabelFi: "Pelaajat", mobileLabelEn: "Players", view: "players", icon: "players" },
];

const mobileMoreItems: Array<{ labelFi: string; labelEn: string; view: ViewKey; icon: IconName }> = [
  { labelFi: "Kausitrendit", labelEn: "Season", view: "season", icon: "season" },
  { labelFi: "Analyysit", labelEn: "Analysis", view: "analyses", icon: "analyses" },
  { labelFi: "Matchup Lab", labelEn: "Matchup Lab", view: "matchup", icon: "matchup" },
  { labelFi: "Custom import", labelEn: "Custom import", view: "custom-import", icon: "import" },
];

type ThemeMode = "dark" | "light";

function AppearanceSettings({ theme, setTheme, view }: { theme: ThemeMode; setTheme: (theme: ThemeMode) => void; view: ViewKey }) {
  const { language, setLanguage, tr } = useI18n();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      const details = detailsRef.current;
      if (details && !details.contains(event.target as Node)) details.open = false;
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);
  useEffect(() => { if (detailsRef.current) detailsRef.current.open = false; }, [view]);
  return <details ref={detailsRef} className="appearance-settings" onKeyDown={(event) => {
    if (event.key === "Escape" && detailsRef.current?.open) {
      detailsRef.current.open = false;
      detailsRef.current.querySelector("summary")?.focus();
      event.stopPropagation();
    }
  }}>
    <summary className="icon-button settings-trigger" aria-label={tr("Asetukset", "Settings")} title={tr("Asetukset", "Settings")}><Icon name="settings" size={19} /></summary>
    <div className="appearance-settings-panel">
      <strong>{tr("Asetukset", "Settings")}</strong>
      <div className="settings-competition"><SeasonSelector showLabels /></div>
      <label><span>{tr("Kieli", "Language")}</span><select value={language} onChange={(event) => setLanguage(event.target.value as Language)}><option value="fi">Suomi</option><option value="en">English</option></select></label>
      <fieldset><legend>{tr("Teema", "Theme")}</legend><div className="settings-theme-options">
        <button type="button" aria-pressed={theme === "light"} onClick={() => setTheme("light")}><Icon name="sun" size={17} />{tr("Vaalea", "Light")}</button>
        <button type="button" aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}><Icon name="moon" size={17} />{tr("Tumma", "Dark")}</button>
      </div></fieldset>
    </div>
  </details>;
}

function getInitialTheme(): ThemeMode {
  try {
    const stored = window.localStorage.getItem("korislab-theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
  return "dark";
}

function HomeView({
  onNavigate,
  onOpenPlayer,
  onOpenMatch,
  searchSlotRef,
  copyRef,
}: {
  onNavigate: (view: ViewKey, season?: SeasonId) => void;
  onOpenPlayer: (playerId: string, season: SeasonId) => void;
  onOpenMatch: (matchId: string, season: SeasonId) => void;
  searchSlotRef: RefObject<HTMLDivElement | null>;
  copyRef: RefObject<HTMLDivElement | null>;
}) {
  const { leagueId, leagueName, leagueNameEn, historicalSummaries, seasonId, seasonLabel, current, data: selectedSeasonData } = useSeason();
  const previewSeason = seasonId === "2024-25" ? "2024-25" : "2025-26";
  const seasonData = historicalSummaries[previewSeason];
  const final = leagues[leagueId].featuredFinal;
  const { language, tr } = useI18n();
  const shootingTeam = [...seasonData.aggregate.teams].sort((a, b) => b.per_game.three_pa - a.per_game.three_pa)[0];
  const league = seasonData.aggregate.league;
  const number = (value: number) => value.toLocaleString(language === "fi" ? "fi-FI" : "en-GB", { maximumFractionDigits: 1 });
  const teamThreePct = shootingTeam.totals.three_pa > 0 ? 100 * shootingTeam.totals.three_pm / shootingTeam.totals.three_pa : null;
  const destinations: Array<{ view: ViewKey; titleFi: string; titleEn: string; detailFi: string; detailEn: string; icon: IconName }> = [
    { view: "teams", titleFi: "Tunnista joukkueen pelitapa", titleEn: "Understand a team's playing style", detailFi: "Vertaa heittovalintoja, tempoa ja tehokkuutta sarjan tasoon.", detailEn: "Compare shot selection, pace and efficiency with the league.", icon: "teams" },
    { view: "players", titleFi: "Löydä pelaajien vahvuudet", titleEn: "Find players' strengths", detailFi: "Tutki pisteitä, heittotarkkuutta ja tehokkuutta suhteessa peliaikaan.", detailEn: "Explore scoring, shooting accuracy and efficiency relative to minutes.", icon: "players" },
    { view: "matches", titleFi: "Katso, miten ottelu ratkesi", titleEn: "See how a game was decided", detailFi: "Avaa ottelun tulos, neljännekset ja joukkueiden tilastovertailu.", detailEn: "Open the result, quarters and team statistics for a game.", icon: "games" },
  ];

  return <div className="home-page">
    <div className="home-competition-controls"><SeasonSelector /></div>
    <section className="home-hero" aria-labelledby="home-title">
      <img className="home-hero-image" src="/korislab-home-illustration.png" alt={tr("Kuvituskuva naisten koripallo-ottelusta", "Illustrative women's basketball scene")} />
      <div className="home-copy" ref={copyRef}>
        <h1 id="home-title" className="home-title"><span>{language === "fi" ? "Suomalainen koripallo," : "Finnish basketball,"}</span><em><DecryptedText key={language} text={language === "fi" ? "datan kautta." : "through data."} /></em></h1>
        <p className="home-description">{tr("KorisLab on suomalaisen koripallon analyysityökalu. Vertaa joukkueiden pelitapoja, tutki pelaajien vahvuuksia ja ymmärrä, mistä otteluiden erot syntyvät.", "KorisLab is an analysis tool for Finnish basketball. Compare team styles, explore players' strengths and understand what separates teams in a game.")}</p>
        <div className="home-search-block">
          <p className="home-search-label">{tr("Hae joukkueita, pelaajia tai kysy kaudesta", "Find teams, players or ask about the season")}</p>
          <div className="home-search-slot" ref={searchSlotRef} aria-hidden="true" />
        </div>
        <p className="home-data-note">{seasonId === "2026-27" ? tr(`2026–27 · ${current?.schedule_summary.games ?? 0} ottelua ohjelmassa`, `2026–27 · ${current?.schedule_summary.games ?? 0} scheduled games`) : tr(`${seasonLabel} ${seasonId === "2024-25" || leagueId === "korisliiga" ? "runko- ja jatkosarjat" : "runkosarja"} · ${selectedSeasonData.aggregate.games}/${selectedSeasonData.summary.available_played_games} tarkistettua ottelua`, `${seasonLabel} ${seasonId === "2024-25" || leagueId === "korisliiga" ? "regular and continuation rounds" : "regular season"} · ${selectedSeasonData.aggregate.games}/${selectedSeasonData.summary.available_played_games} verified games`)}</p>
      </div>
      <article className="home-preview" aria-labelledby="home-preview-title">
        <div className="home-preview-toolbar"><span role="img" aria-label="KorisLab"><Mark /></span><span>{previewSeason.replace("-", "–")}</span></div>
        <div className="home-preview-content">
          <h2 id="home-preview-title">{tr(`${shootingTeam.name} · heittoprofiili`, `${shootingTeam.name} shooting profile`)}</h2>
          <div className="home-preview-main"><strong>{number(shootingTeam.per_game.three_pa)}</strong><span>{tr("kolmosyritystä", "three-point attempts")}<br />{tr("ottelua kohti", "per game")}</span></div>
          <p className="home-preview-chart-title">{tr("Kolmosten osuus kenttäheitoista", "Three-point share of field-goal attempts")}</p>
          <div className="home-preview-bars">
            {[
              { name: shootingTeam.name, share: shootingTeam.metrics.three_point_attempt_rate, team: true },
              { name: tr("Sarja", "League"), share: league.metrics.three_point_attempt_rate, team: false },
            ].map((row) => <div className={`home-preview-bar-row ${row.team ? "home-preview-bar-row--team" : ""}`} key={row.name}><span>{row.name}</span><div className="home-preview-track" aria-hidden="true"><i style={{ width: `${row.share}%` }} /></div><strong>{number(row.share)}%</strong></div>)}
          </div>
          <dl className="home-preview-details">
            <div><dt>{tr("Kolmosten tarkkuus", "Three-point accuracy")}</dt><dd>{teamThreePct === null ? "—" : `${number(teamThreePct)}%`}</dd></div>
            <div><dt>{tr("Otteluita", "Games")}</dt><dd>{shootingTeam.games}</dd></div>
          </dl>
          <p className="home-preview-insight">{tr("Suuri heittomäärä ei yksin kerro tehokkuudesta. Katso, ketkä ottivat heitot ja miten luvut vaihtelivat otteluittain.", "Volume alone does not tell you how efficient a team was. See who took the shots and how the figures varied by game.")}</p>
          <button className="home-preview-link" type="button" onClick={() => onNavigate("season", previewSeason)}>{tr("Tutki kolmosanalyysiä", "Explore the three-point analysis")} <ArrowUpRight /></button>
          <p className="home-preview-source">{tr("Lähde: Basket.fi · runkosarjan ottelutilastot", "Source: Basket.fi · regular-season game statistics")}</p>
        </div>
      </article>
      <p className="home-image-note">{tr("Kuvituskuva", "Illustration")}</p>
    </section>

    <LiveSeason onOpenMatches={() => onNavigate("matches", "2026-27")} onOpenMatch={(id) => onOpenMatch(id, "2026-27")} onOpenPlayer={(id) => onOpenPlayer(id, "2026-27")} />

    <div className="home-hub">
      <section aria-labelledby="home-replay-title">
        <h2 id="home-replay-title">{tr("Kelattava ottelun tarina", "Game replay")}</h2>
        <p className="home-hub-description">{tr(`${leagueName}: kauden 2025–26 viimeinen finaaliottelu.`, `The final game of the 2025–26 ${leagueNameEn} finals.`)}</p>
        <article className="home-featured-replay"><div><h3 className="home-featured-replay-score">{final.home} {final.homeScore}–{final.awayScore} {final.away}</h3><p>{tr("Seuraa finaalin etenemistä ja ratkaisuhetkiä aikajanalta.", "Explore the final and its decisive moments on the timeline.")}</p></div><a className="outline-button" href={`${routeHref("story", "2025-26", final.id, leagueId)}#match-replay`} onClick={event => {
          const targetHref = event.currentTarget.href;
          followLink(event, () => {
            onOpenMatch(final.id, "2025-26");
            window.history.replaceState(window.history.state, "", targetHref);
          });
        }}>{tr("Kelaa finaalia", "Explore the final")}<Icon name="arrowOutward" size={16} /></a></article>
      </section>
      <section aria-labelledby="home-hub-title">
        <h2 id="home-hub-title">{tr("Mitä peli kertoo numeroiden takaa?", "What do the numbers tell you about the game?")}</h2>
        <p className="home-hub-description">{tr("Aloita joukkueesta, pelaajasta tai yksittäisestä ottelusta. Laskennalliset arviot on merkitty analyysin yhteydessä.", "Start with a team, a player or an individual game. Derived estimates are identified alongside the analysis.")}</p>
        <div className="home-destinations">
          {destinations.map((item) => <button className="home-destination" key={item.view} type="button" onClick={() => onNavigate(item.view)}>
            <span className="home-destination-icon"><Icon name={item.icon} size={28} /></span>
            <span className="home-destination-copy"><strong>{tr(item.titleFi, item.titleEn)}</strong><span>{tr(item.detailFi, item.detailEn)}</span></span>
            <ArrowUpRight />
          </button>)}
        </div>
      </section>
    </div>
  </div>;
}

function App() {
  const { leagueId, leagueName, leagueNameEn, historicalSummaries, data: seasonData, seasonId, seasonLabel, setSeasonId, setLeagueId, current, loadMatches: loadSeasonMatches, loadMatchesForSeason } = useSeason();
  const { language, setLanguage, tr } = useI18n();
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const mobileMoreRef = useRef<HTMLDivElement>(null);
  const { route, navigate } = useAppRoute(seasonId, leagueId);
  const view = route.view;
  const selectedMatchId = route.matchId ?? match.sourceMatchId;
  const setView = (next: ViewKey) => navigate(next, next === "analysis-article" ? route.articleSlug : ["story", "data"].includes(next) ? selectedMatchId : undefined);
  useEffect(() => { setMobileMoreOpen(false); }, [view]);
  useEffect(() => {
    if (!mobileMoreOpen) return;
    const dismissOutside = (event: PointerEvent) => {
      if (!mobileMoreRef.current?.contains(event.target as Node)) setMobileMoreOpen(false);
    };
    document.addEventListener("pointerdown", dismissOutside);
    return () => document.removeEventListener("pointerdown", dismissOutside);
  }, [mobileMoreOpen]);
  const openAnalysis = (slug: string, targetSeason: SeasonId, targetLeague: "naisten-korisliiga" | "korisliiga") => {
    setSeasonId(targetSeason);
    setLeagueId(targetLeague);
    navigate("analysis-article", slug, targetSeason, targetLeague);
  };
  const openMatch = (id: string) => navigate("story", id);
  const openPlayer = (id: string) => navigate("player-profile", id);
  const previousSeason = useRef(seasonId);
  const [matchLoadState, setMatchLoadState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [profileTeamId, setProfileTeamId] = useState<string | undefined>();
  const selectedTeamId = profileTeamId ?? seasonData.aggregate.teams[0]?.source_team_id ?? "";
  const [searchQuery, setSearchQuery] = useState("");
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchResult, setSearchResult] = useState<QueryFeedback | null>(null);
  const topbarSearchRef = useRef<HTMLDivElement | null>(null);
  const homeSearchSlotRef = useRef<HTMLDivElement | null>(null);
  const homeCopyRef = useRef<HTMLDivElement | null>(null);
  const searchRequest = useRef(0);
  useEffect(() => () => { searchRequest.current += 1; }, []);
  const preserveSearchTeam = useRef<{ season: SeasonId; id: string } | null>(null);
  const [activeMatch, setActiveMatch] = useState<AppMatch>(match);
  const [activePlayers, setActivePlayers] = useState(players);
  const [activeTeamSummary, setActiveTeamSummary] = useState(teamSummary);
  const [activeInsights, setActiveInsights] = useState(insights);
  const [activeAvailability, setActiveAvailability] = useState(availability);
  const [playerFilter, setPlayerFilter] = useState<"all" | "home" | "away">("all");
  const shotState = useMatchShots(selectedMatchId, ["story", "data"].includes(view) && matchLoadState === "ready");
  const replayState = useMatchReplay(selectedMatchId, seasonId, ["story", "data"].includes(view) && matchLoadState === "ready");
  useLayoutEffect(() => {
    const search = topbarSearchRef.current;
    const slot = homeSearchSlotRef.current;
    if (!search) return;
    if (view !== "home" || !slot) {
      search.style.removeProperty("left");
      search.style.removeProperty("top");
      search.style.removeProperty("width");
      return;
    }

    const updatePosition = () => {
      const slotRect = slot.getBoundingClientRect();
      const parentRect = search.offsetParent?.getBoundingClientRect();
      if (!parentRect) return;
      search.style.left = `${slotRect.left - parentRect.left}px`;
      search.style.top = `${slotRect.top - parentRect.top}px`;
      search.style.width = `${slotRect.width}px`;
    };

    updatePosition();
    const observer = new ResizeObserver(updatePosition);
    observer.observe(slot);
    if (homeCopyRef.current) observer.observe(homeCopyRef.current);
    window.addEventListener("resize", updatePosition);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updatePosition);
    };
  }, [language, view]);
  const openSearchTarget = (target: QueryTarget) => {
    if (target.teamId) {
      setProfileTeamId(target.teamId);
      if (target.season !== seasonId) preserveSearchTeam.current = { season: target.season, id: target.teamId };
    }
    if (target.season !== seasonId) setSeasonId(target.season);
    navigate(target.view, target.id, target.season);
  };
  const handleSearchAction = (target: QueryTarget) => {
    setSearchResult(null);
    openSearchTarget(target);
  };
  const handleSearchChange = (value: string) => {
    searchRequest.current += 1;
    setSearchBusy(false);
    setSearchResult(null);
    setSearchQuery(value);
  };
  const handleSearch = async (rawQuery: string) => {
    const query = rawQuery.trim();
    if (!query) return;
    const request = ++searchRequest.current;
    setSearchResult(null);
    setSearchBusy(false);
    const busyTimer = window.setTimeout(() => {
      if (searchRequest.current === request) setSearchBusy(true);
    }, 180);
    try {
      const resolution = await resolveBasketballQuery(query, {
        language,
        seasonId,
        selectedSeasonTeams: seasonData.aggregate.teams.map(({ source_team_id, name }) => ({ source_team_id, name })),
        leagueId,
        historicalTeams: historicalSummaries["2025-26"].aggregate.teams.map(({ source_team_id, name }) => ({ source_team_id, name })),
        currentTeams: (current?.aggregate.teams ?? []).map(({ source_team_id, name }) => ({ source_team_id, name })),
        currentScheduleTeams: current?.schedule_summary.teams ?? [],
        historicalTeamsBySeason: historicalSummaries,
        loadMatches: loadMatchesForSeason,
        loadPlayoffMatches: (targetSeason = "2025-26") => loadMatchesForSeason(targetSeason, "playoffs"),
      });
      if (searchRequest.current !== request) return;
      setSearchResult(resolution.feedback);
      if (resolution.navigate) openSearchTarget(resolution.navigate);
    } catch {
      if (searchRequest.current === request) setSearchResult({
        tone: "notice",
        title: tr("Hakua ei voitu tehdä", "Search could not be completed"),
        detail: tr("Tarkista yhteys ja yritä uudelleen.", "Check your connection and try again."),
      });
    } finally {
      window.clearTimeout(busyTimer);
      if (searchRequest.current === request) setSearchBusy(false);
    }
  };
  useEffect(() => {
    if (previousSeason.current === seasonId) return;
    previousSeason.current = seasonId;
    setSearchResult(null);
    setSearchBusy(false);
    const preserve = preserveSearchTeam.current?.season === seasonId && preserveSearchTeam.current.id === profileTeamId;
    preserveSearchTeam.current = null;
    if (!preserve) setProfileTeamId(undefined);
    if (["story", "data"].includes(view) && route.season !== seasonId) setView("matches");
  }, [seasonId]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [view, selectedMatchId, route.playerId, seasonId]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem("korislab-theme", theme);
    } catch {
      // Storage can be unavailable in restricted browser contexts.
    }
  }, [theme]);
  useEffect(() => {
    if (view !== "story" && view !== "data") return;
    let cancelled = false;
    setMatchLoadState("loading");
    if (leagueId === "naisten-korisliiga" && selectedMatchId === match.sourceMatchId && seasonId === "2025-26") {
      setMatchLoadState("ready");
      setActiveMatch(match);
      setActivePlayers(players);
      setActiveTeamSummary(teamSummary);
      setActiveInsights(insights);
      setActiveAvailability(availability);
      return () => {
        cancelled = true;
      };
    }
    loadSeasonMatches().then(async (records) => {
      const selectedRecord = records.find((record) => record.game.source_id === selectedMatchId)
        ?? (await loadMatchesForSeason(seasonId, "playoffs")).find(record => record.game.source_id === selectedMatchId);
      if (cancelled) return;
      if (!selectedRecord) { setMatchLoadState("missing"); return; }
      setMatchLoadState("ready");
      const viewModel = buildMatchViewModel(selectedRecord, language, seasonLabel);
      setActiveMatch(viewModel.match);
      setActivePlayers(viewModel.players);
      setActiveTeamSummary(viewModel.teamSummary);
      setActiveInsights(viewModel.insights);
      setActiveAvailability(viewModel.availability);
    }).catch(() => { if (!cancelled) setMatchLoadState("error"); });
    return () => {
      cancelled = true;
    };
  }, [view, leagueId, selectedMatchId, language, loadSeasonMatches, loadMatchesForSeason, seasonId, seasonLabel]);
  useEffect(() => {
    if (view !== "story" || matchLoadState !== "ready" || window.location.hash !== "#match-replay") return;
    document.getElementById("match-replay")?.scrollIntoView({ block: "start" });
  }, [view, matchLoadState, selectedMatchId]);
  const derived = useMemo(() => ({
    home: deriveTeamMetrics(activeTeamSummary.home.stats, activeTeamSummary.away.stats),
    away: deriveTeamMetrics(activeTeamSummary.away.stats, activeTeamSummary.home.stats),
  }), [activeTeamSummary]);
  const boxScoreComparisons: MatchComparison[] = [
    { key: "points", label: tr("Pisteet", "Points"), home: activeTeamSummary.home.stats.points, away: activeTeamSummary.away.stats.points, higherIsBetter: true },
    { key: "fg", label: "FG%", home: derived.home.fgPct, away: derived.away.fgPct, higherIsBetter: true, format: displayPct },
    { key: "rebounds", label: tr("Levypallot", "Rebounds"), home: activeTeamSummary.home.stats.rebounds, away: activeTeamSummary.away.stats.rebounds, higherIsBetter: true },
    { key: "assists", label: tr("Syötöt", "Assists"), home: activeTeamSummary.home.stats.assists, away: activeTeamSummary.away.stats.assists, higherIsBetter: true },
    { key: "turnovers", label: tr("Menetykset", "Turnovers"), home: activeTeamSummary.home.stats.turnovers, away: activeTeamSummary.away.stats.turnovers, higherIsBetter: false },
    { key: "steals", label: tr("Riistot", "Steals"), home: activeTeamSummary.home.stats.steals, away: activeTeamSummary.away.stats.steals, higherIsBetter: true },
    { key: "fouls", label: "PF", home: activeTeamSummary.home.stats.fouls, away: activeTeamSummary.away.stats.fouls, higherIsBetter: false },
  ];
  const derivedComparisons: MatchComparison[] = [
    { key: "efg", label: "eFG%", home: getMetricValue(derived.home, "efgPct"), away: getMetricValue(derived.away, "efgPct"), higherIsBetter: true, format: displayPct },
    { key: "ts", label: "TS%", home: getMetricValue(derived.home, "trueShootingPct"), away: getMetricValue(derived.away, "trueShootingPct"), higherIsBetter: true, format: displayPct },
    { key: "ortg", label: "ORtg", home: getMetricValue(derived.home, "offensiveRating"), away: getMetricValue(derived.away, "offensiveRating"), higherIsBetter: true },
    { key: "drtg", label: "DRtg", home: getMetricValue(derived.home, "defensiveRating"), away: getMetricValue(derived.away, "defensiveRating"), higherIsBetter: false },
    { key: "net", label: "Net Rating", home: getMetricValue(derived.home, "netRating"), away: getMetricValue(derived.away, "netRating"), higherIsBetter: true },
    { key: "ast-to", label: "AST/TO", home: getMetricValue(derived.home, "assistTurnover"), away: getMetricValue(derived.away, "assistTurnover"), higherIsBetter: true },
  ];
  const firstQuarter = activeMatch.periods[0] ?? { home: null, away: null };
  const displayedInsights = useMemo(() => {
    if (language === "fi") return activeInsights;
    const strongestStart = firstQuarter.home !== null && firstQuarter.away !== null && firstQuarter.home > firstQuarter.away ? activeMatch.home.name : activeMatch.away.name;
    const biggestQuarter = activeMatch.periods.reduce((best, period) => Math.abs(period.home - period.away) > Math.abs(best.home - best.away) ? period : best, activeMatch.periods[0] ?? { label: "game", home: 0, away: 0 });
    const winner = activeMatch.home.score >= activeMatch.away.score ? activeMatch.home : activeMatch.away;
    const loser = winner === activeMatch.home ? activeMatch.away : activeMatch.home;
    const margin = Math.abs(activeMatch.home.score - activeMatch.away.score);
    return [
      { eyebrow: "Opening", title: `${strongestStart} started stronger`, body: `The first quarter ended ${firstQuarter.home}–${firstQuarter.away}. ${winner.name} led the game by ${margin} points at the final buzzer.`, accent: "mint" },
      { eyebrow: "Separation", title: `${winner.name} created separation in ${biggestQuarter.label}`, body: `The biggest quarter margin was ${biggestQuarter.home}–${biggestQuarter.away}. That stretch helped ${winner.name} control the game.`, accent: "amber" },
      { eyebrow: "Finish", title: `${winner.name} won by ${margin}`, body: `${winner.name} scored ${winner.score} points and ${loser.name} ${loser.score}. The game box score is available in the source data.`, accent: "coral" },
    ] as typeof insights;
  }, [activeInsights, activeMatch, firstQuarter.away, firstQuarter.home, language]);
  const displayedAvailability = useMemo(() => {
    const items = activeAvailability.map((item) => {
      if (item.label === "Laukaisukoordinaatit") {
        const located = shotState.data?.shots.filter((shot) => shot.x !== null && shot.y !== null).length ?? 0;
        return { ...item, label: tr("Heittopaikat", "Shot locations"),
          value: shotState.status === "loading" ? tr("Ladataan", "Loading")
            : located ? tr("Saatavilla", "Available") : tr("Ei vielä tuotu", "Not yet imported"),
          tone: located && shotState.data?.box_score_matches ? "ready" : "warning",
          detail: located ? tr(`${located} heittopaikkaa · pelaaja · erä · pelikello`, `${located} shot locations · player · period · clock`)
            : tr("Ottelukohtainen heittoloki", "Per-game shot log") };
      }
      if (item.label === "Tapahtumat") return { ...item, label: "Play-by-play", tone: replayState.data ? "ready" : "warning",
        value: replayState.data ? tr("Saatavilla", "Available") : replayState.status === "loading" ? tr("Ladataan", "Loading") : tr("Ei vielä tuotu", "Not yet imported"), detail: replayState.data ? tr(`${replayState.data.event_count} tarkistettua tapahtumaa · kelattava aikajana`, `${replayState.data.event_count} verified events · interactive timeline`) : tr("Tarkistettu tapahtumaloki ei ole saatavilla tässä näkymässä", "A verified event log is unavailable in this view") };
      return item;
    });
    if (language === "fi") return items;
    return items.map((item) => {
      if (item.label === "Shot locations" || item.label === "Play-by-play") return item;
      const label = {
        "Ottelun metadata": "Game metadata",
        "Box score -tilastot": "Box score statistics",
        "Tapahtumat": "Events",
        "Johdetut tehokkuusluvut": "Derived efficiency metrics",
        "Laukaisukoordinaatit": "Shot coordinates",
        "Peliminuutit": "Playing minutes",
      }[item.label] ?? item.label;
      const value = {
        "Saatavilla": "Available",
        "Arvio": "Estimate",
        "Ei tässä lähteessä": "Not in this source",
        "Ei eritelty": "Not itemised",
      }[item.value] ?? item.value;
      const detail = item.label === "Ottelun metadata" ? "teams · time · venue"
        : item.label === "Box score -tilastot" ? `${activePlayers.length} players · MIN · shots · rebounds · other fields`
          : item.label === "Tapahtumat" ? (item.tone === "warning" ? "Event-level detail is not included in the season index" : "Event feed available")
            : item.label === "Johdetut tehokkuusluvut" ? "Possessions are estimated from the box score formula"
              : item.label === "Laukaisukoordinaatit" ? "Requires a new data source"
                : "MIN field from the statistics page";
      return { ...item, label, value, detail };
    });
  }, [activeAvailability, activePlayers.length, language, shotState, replayState.data, replayState.status, tr]);
  const storyStats = [
    { label: tr("Riistot", "Steals"), value: displayPair(activeTeamSummary.home.stats.steals, activeTeamSummary.away.stats.steals), note: displayAdvantage(activeTeamSummary.home.name, activeTeamSummary.away.name, activeTeamSummary.home.stats.steals, activeTeamSummary.away.stats.steals, "", language) },
    { label: tr("1. neljännes", "1st quarter"), value: displayPair(firstQuarter.home, firstQuarter.away), note: displayAdvantage(activeTeamSummary.home.name, activeTeamSummary.away.name, firstQuarter.home, firstQuarter.away, language === "fi" ? " pistettä" : " points", language) },
    { label: "eFG%", value: displayPair(derived.home.efgPct, derived.away.efgPct, displayPct), note: displayAdvantage(activeTeamSummary.home.name, activeTeamSummary.away.name, derived.home.efgPct, derived.away.efgPct, "%", language) },
    { label: tr("Hyökkäyslevyt", "Offensive rebounds"), value: displayPair(activeTeamSummary.home.stats.offensiveRebounds, activeTeamSummary.away.stats.offensiveRebounds), note: displayAdvantage(activeTeamSummary.home.name, activeTeamSummary.away.name, activeTeamSummary.home.stats.offensiveRebounds, activeTeamSummary.away.stats.offensiveRebounds, "", language) },
  ];
  const isMatchDetail = view === "story" || view === "data";
  const sectionsByView: Partial<Record<ViewKey, PageSectionLink[]>> = {
    overview: [
      { href: "#overview-summary", label: tr("Yhteenveto", "Summary") },
      { href: "#overview-leaders", label: tr("Kauden kärjet", "Season leaders") },
      { href: "#overview-scratchpad", label: tr("Rakenna analyysikysymys", "Build an analysis question") },
      { href: "#overview-teams", label: tr("Joukkueet", "Teams") },
    ],
    teams: [
      { href: "#team-profile", label: tr("Yhteenveto", "Summary"), scope: tr("Joukkueprofiili", "Team profile") },
      { href: "#team-season-development", label: tr("Kauden kehitys", "Season development"), scope: tr("Joukkueprofiili", "Team profile") },
      { href: "#team-league-comparison", label: tr("Vertailu sarjan tasoon", "Comparison with league level"), scope: tr("Joukkueprofiili", "Team profile") },
      { href: "#league-comparisons", label: tr("Hallinnan jakauma", "Control distribution"), scope: tr("Liigan vertailut", "League comparisons") },
      { href: "#team-style-map", label: "Team Style Map", scope: tr("Liigan vertailut", "League comparisons") },
      { href: "#team-game-split", label: tr("Pelitavan ja tuloksen yhteys", "Playing style and outcome"), scope: tr("Liigan vertailut", "League comparisons") },
    ],
    season: [
      { href: "#season-summary", label: tr("Kauden pääluvut", "Season metrics") },
      ...(seasonId !== "2026-27" ? [{ href: "#season-phase-comparison", label: tr("Runkosarjasta pudotuspeleihin", "Regular season to playoffs") }] : []),
      { href: "#season-three-point-story", label: tr("Kolmosanalyysi", "Three-point analysis") },
      { href: "#season-reading", label: tr("Miten lukuja luetaan?", "How to read the numbers") },
      { href: "#season-coverage", label: tr("Data kasvaa näin", "How the dataset grows") },
    ],
    story: [
      { href: "#match-result", label: tr("Ottelun tulos", "Game result") },
      { href: "#match-replay", label: tr("Kelaa ottelua", "Game timeline") },
      { href: "#match-key-metrics", label: tr("Ottelun avainluvut", "Game key metrics") },
      { href: "#match-comparison", label: tr("Ottelun luvut", "Game numbers") },
      { href: "#match-court", label: tr("Heittokartta", "Shot chart") },
      { href: "#match-scorers", label: tr("Pisteet tässä ottelussa", "Points in this game") },
      { href: "#match-observations", label: tr("Kolme havaintoa", "Three observations") },
      { href: "#match-availability", label: tr("Mitä tiedämme?", "What do we know?") },
    ],
  };
  const pageNames: Partial<Record<ViewKey, string>> = { home: tr(`${leagueName}: tilastot ja analyysit`, `${leagueNameEn} statistics and analysis`), overview: tr("Yleiskatsaus", "Overview"), matches: tr("Ottelut", "Games"), teams: tr("Joukkueet", "Teams"), players: tr("Pelaajat", "Players"), season: tr("Kausitrendit", "Season trends"), analyses: tr("Analyysit", "Analysis"), "analysis-article": tr("Analyysi", "Analysis"), matchup: "Matchup Lab", "custom-import": "Custom import", "not-found": tr("Sivua ei löytynyt", "Page not found") };
  const pageName = pageNames[view] ?? (matchLoadState === "ready" ? `${activeMatch.home.name} – ${activeMatch.away.name} · ${activeMatch.date}` : tr("Otteluanalyysi", "Game analysis"));
  usePageMetadata(
    view === "home" || view === "custom-import" || view === "analysis-article" ? pageName : `${pageName} · ${seasonLabel}`,
    view === "custom-import" ? tr("Tuo joukkueesi ottelutilastot ja tutki niitä paikallisesti KorisLabissa.", "Import your team's game statistics and analyze them locally in KorisLab.") : tr(`${pageName}: ${leagueName} kauden ${seasonLabel} tilastot, tulokset ja varmennettuun otteludataan perustuva analyysi.`, `${pageName}: ${leagueNameEn} ${seasonLabel} statistics, results and analysis based on verified game data.`),
    { enabled: view !== "player-profile" && view !== "analysis-article", noindex: view === "not-found" || view === "custom-import" || (isMatchDetail && ["missing", "error"].includes(matchLoadState)) },
  );
  const seasonPending = seasonId === "2026-27" && (!current || current.summary.valid_games === 0);
  const sectionLinks = seasonPending && ["overview", "teams", "season"].includes(view) ? [] : sectionsByView[view] ?? [];
  const hasContents = sectionLinks.length > 3;

  return (
    <div className={`app-shell app-shell--${view}`}>
      <aside className="sidebar">
        <a className="brand-lockup brand-lockup--link" href={routeHref("home", seasonId, undefined, leagueId)} aria-label={tr("KorisLab – etusivu", "KorisLab – home")}>
          <Mark />
          <span>Koris<span>Lab</span></span>
        </a>

        {view !== "custom-import" && <div className="workspace-switcher"><SeasonSelector sidebar /></div>}

        <nav className="main-nav" aria-label={tr("Päänavigaatio", "Main navigation")}>
          <p className="nav-label">{tr("Näkymä", "Views")}</p>
          <a className={`nav-item ${view === "home" ? "active" : ""}`} href={routeHref("home", seasonId, undefined, leagueId)} aria-current={view === "home" ? "page" : undefined} onClick={(event) => followLink(event, () => setView("home"))}><span className="nav-glyph"><Icon name="home" /></span> {tr("Etusivu", "Home")}</a>
          <a className={`nav-item ${view === "overview" ? "active" : ""}`} href={routeHref("overview", seasonId, undefined, leagueId)} aria-current={view === "overview" ? "page" : undefined} onClick={(event) => followLink(event, () => setView("overview"))}><span className="nav-glyph"><Icon name="overview" /></span> {tr("Yleiskatsaus", "Overview")}</a>
          <a className={`nav-item ${view === "matches" ? "active" : ""}`} href={routeHref("matches", seasonId, undefined, leagueId)} aria-current={view === "matches" ? "page" : undefined} onClick={(event) => followLink(event, () => setView("matches"))}><span className="nav-glyph"><Icon name="games" /></span> {tr("Ottelut", "Games")} <span className="nav-count">{seasonId === "2026-27" ? current?.schedule_summary.games ?? 0 : seasonData.aggregate.games}</span></a>
          <a className={`nav-item ${view === "teams" ? "active" : ""}`} href={routeHref("teams", seasonId, undefined, leagueId)} aria-current={view === "teams" ? "page" : undefined} onClick={(event) => followLink(event, () => setView("teams"))}><span className="nav-glyph"><Icon name="teams" /></span> {tr("Joukkueet", "Teams")}</a>
          <a className={`nav-item ${["players", "player-profile"].includes(view) ? "active" : ""}`} href={routeHref("players", seasonId, undefined, leagueId)} aria-current={["players", "player-profile"].includes(view) ? "page" : undefined} onClick={(event) => followLink(event, () => setView("players"))}><span className="nav-glyph"><Icon name="players" /></span> {tr("Pelaajat", "Players")}</a>
          <a className={`nav-item ${view === "season" ? "active" : ""}`} href={routeHref("season", seasonId, undefined, leagueId)} aria-current={view === "season" ? "page" : undefined} onClick={(event) => followLink(event, () => setView("season"))}><span className="nav-glyph"><Icon name="season" /></span> {tr("Kausitrendit", "Season trends")}</a>
          <a className={`nav-item ${["analyses", "analysis-article"].includes(view) ? "active" : ""}`} href={routeHref("analyses", seasonId, undefined, leagueId)} aria-current={["analyses", "analysis-article"].includes(view) ? "page" : undefined} onClick={(event) => followLink(event, () => setView("analyses"))}><span className="nav-glyph"><Icon name="analyses" /></span> {tr("Analyysit", "Analysis")}</a>
          <p className="nav-label nav-label-lower">{tr("Työkalut", "Tools")}</p>
          <a className={`nav-item ${view === "matchup" ? "active" : ""}`} href={routeHref("matchup", seasonId, undefined, leagueId)} aria-current={view === "matchup" ? "page" : undefined} onClick={(event) => followLink(event, () => setView("matchup"))}><span className="nav-glyph"><Icon name="matchup" /></span> Matchup Lab</a>
          <a className={`nav-item ${view === "custom-import" ? "active" : ""}`} href={routeHref("custom-import", seasonId, undefined, leagueId)} aria-current={view === "custom-import" ? "page" : undefined} onClick={(event) => followLink(event, () => setView("custom-import"))}><span className="nav-glyph"><Icon name="import" /></span> Custom import</a>
          <button className="nav-item"><span className="nav-glyph"><Icon name="health" /></span> {tr("Datan tila", "Data status")}</button>
        </nav>

        <div className="sidebar-footer">
          <span className="sidebar-version">v0.1</span>
        </div>
      </aside>

      <nav className="mobile-nav" aria-label={tr("Mobiilinavigaatio", "Mobile navigation")}>
        {mobileNavItems.map((item) => <a key={item.view} href={routeHref(item.view, seasonId, undefined, leagueId)} className={view === item.view || (item.view === "players" && view === "player-profile") || (item.view === "analyses" && view === "analysis-article") ? "active" : ""} aria-label={tr(item.labelFi, item.labelEn)} aria-current={view === item.view || (item.view === "players" && view === "player-profile") || (item.view === "analyses" && view === "analysis-article") ? "page" : undefined} onClick={(event) => followLink(event, () => setView(item.view))}>
          <span className="mobile-nav-icon"><Icon name={item.icon} size={18} /></span>
          <span>{tr(item.mobileLabelFi, item.mobileLabelEn)}</span>
        </a>)}
      </nav>

      <main className={`main-content main-content--${view}`}>
        <header className="topbar">
          <a className="mobile-brand mobile-brand--link" href={routeHref("home", seasonId, undefined, leagueId)} aria-label={tr("KorisLab – etusivu", "KorisLab – home")}><Mark /><span>Koris<span>Lab</span></span></a>
          <div className="breadcrumbs">
            <button className={`crumb-link ${view === "home" ? "crumb-current" : ""}`} aria-current={view === "home" ? "page" : undefined} onClick={() => setView("home")}>{tr("Etusivu", "Home")}</button>
            {view === "player-profile" ? <><b>/</b><a className="crumb-link" href={routeHref("players", seasonId, undefined, leagueId)} onClick={(event) => followLink(event, () => setView("players"))}>{tr("Pelaajat", "Players")}</a><b>/</b><span className="crumb-current">{tr("Profiili", "Profile")}</span></> : isMatchDetail ? <><b>/</b><button className="crumb-link" onClick={() => setView("matches")}>{tr("Ottelut", "Games")}</button><b>/</b><span className="crumb-current">{view === "data" ? tr("Data & saatavuus", "Data & availability") : tr("Ottelun tarina", "Game story")}</span></> : view === "analysis-article" ? <><b>/</b><a className="crumb-link" href={routeHref("analyses", seasonId, undefined, leagueId)} onClick={(event) => followLink(event, () => setView("analyses"))}>{tr("Analyysit", "Analysis")}</a><b>/</b><span className="crumb-current">{tr("Juttu", "Story")}</span></> : view !== "overview" && view !== "home" ? <><b>/</b><span className="crumb-current">{view === "teams" ? tr("Joukkueprofiilit", "Team profiles") : view === "season" ? tr("Sarjan trendit", "League trends") : view === "players" ? tr("Pelaajat", "Players") : view === "analyses" ? tr("Analyysit", "Analysis") : view === "matchup" ? "Matchup Lab" : view === "custom-import" ? "Custom import" : view === "not-found" ? tr("Sivua ei löytynyt", "Page not found") : tr("Ottelut", "Games")}</span></> : null}
            {view === "overview" ? <><b>/</b><span className="crumb-current">{tr("Yleiskatsaus", "Overview")}</span></> : null}
          </div>
          {view === "custom-import" ? <div className="topbar-query-search topbar-query-search--empty" aria-hidden="true" /> : <div ref={topbarSearchRef} className={`topbar-query-search${view === "home" ? " topbar-query-search--home" : ""}`}><QuerySearch mode={view === "home" ? "hero" : "topbar"} value={searchQuery} busy={searchBusy} theme={theme} result={searchResult} onChange={handleSearchChange} onSubmit={handleSearch} onAction={handleSearchAction} /></div>}
          <div className="topbar-actions">
            <div ref={mobileMoreRef} className="mobile-more-menu" onKeyDown={(event) => {
              if (event.key === "Escape" && mobileMoreOpen) {
                setMobileMoreOpen(false);
                mobileMoreRef.current?.querySelector<HTMLButtonElement>(".mobile-more-trigger")?.focus();
              }
            }}>
              <button className="icon-button mobile-more-trigger" type="button" aria-label={mobileMoreOpen ? tr("Sulje valikko", "Close menu") : tr("Avaa valikko", "Open menu")} aria-expanded={mobileMoreOpen} aria-controls="mobile-more-navigation" title={mobileMoreOpen ? tr("Sulje valikko", "Close menu") : tr("Avaa valikko", "Open menu")} onClick={() => setMobileMoreOpen((open) => !open)}>
                <Icon name="menu" size={20} />
              </button>
              <nav id="mobile-more-navigation" className="mobile-more-panel" aria-label={tr("Muut osiot", "More sections")} hidden={!mobileMoreOpen}>
                <span className="mobile-more-heading">{tr("Muut osiot", "More sections")}</span>
                {mobileMoreItems.map((item) => {
                  const active = view === item.view || (item.view === "analyses" && view === "analysis-article");
                  return <a key={item.view} href={routeHref(item.view, seasonId, undefined, leagueId)} className={active ? "active" : ""} aria-current={active ? "page" : undefined} onClick={(event) => followLink(event, () => { setMobileMoreOpen(false); setView(item.view); })}>
                    <span className="mobile-nav-icon"><Icon name={item.icon} size={18} /></span>
                    <span>{tr(item.labelFi, item.labelEn)}</span>
                  </a>;
                })}
              </nav>
            </div>
            <select className="language-toggle" value={language} onChange={(event) => setLanguage(event.target.value as Language)} aria-label={tr("Kieli", "Language")} title={tr("Kieli", "Language")}><option value="fi">FI</option><option value="en">EN</option></select>
            <button className="icon-button theme-toggle" type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={theme === "dark" ? tr("Tumma tila käytössä. Vaihda vaaleaan tilaan", "Dark mode active. Switch to light mode") : tr("Vaalea tila käytössä. Vaihda tummaan tilaan", "Light mode active. Switch to dark mode")} title={theme === "dark" ? tr("Tumma tila käytössä. Vaihda vaaleaan tilaan", "Dark mode active. Switch to light mode") : tr("Vaalea tila käytössä. Vaihda tummaan tilaan", "Light mode active. Switch to dark mode")}><Icon name={theme === "dark" ? "moon" : "sun"} size={15} /></button>
            <AppearanceSettings theme={theme} setTheme={setTheme} view={view} />
          </div>
        </header>

        <div className={hasContents ? "page-with-outline" : undefined}>
          {hasContents && <PageSectionLinks key={view} links={sectionLinks} tr={tr} />}
          <div className={`page-content ${view === "home" ? "page-content--home" : ""}`}>
          {view === "custom-import" ? <Suspense fallback={<section className="panel custom-loading-state" role="status">{tr("Ladataan tuontityökalua…", "Loading import tool…")}</section>}><CustomImportPage /></Suspense> : view === "home" ? <HomeView onNavigate={(nextView, targetSeason) => { if (targetSeason) setSeasonId(targetSeason); navigate(nextView, undefined, targetSeason ?? seasonId); }} onOpenPlayer={(id, targetSeason) => { setSeasonId(targetSeason); navigate("player-profile", id, targetSeason); }} onOpenMatch={(id, targetSeason) => { setSeasonId(targetSeason); navigate("story", id, targetSeason); }} searchSlotRef={homeSearchSlotRef} copyRef={homeCopyRef} /> : view === "analysis-article" ? <AnalysisArticlePage slug={route.articleSlug ?? ""} onBack={() => setView("analyses")} /> : view === "player-profile" ? <PlayerProfile key={`${route.playerId}-${seasonId}`} playerId={route.playerId!} onOpenMatch={openMatch} onBack={() => setView("players")} /> : view === "not-found" ? <section className="panel match-list-empty"><h1>{tr("Sivua ei löytynyt", "Page not found")}</h1><p>{tr("Tarkista osoite tai avaa sivu navigaatiosta.", "Check the address or open a page from the navigation.")}</p></section> : <>
          <section className={`intro-row intro-row--${view} ${view === "overview" ? "intro-row--overview" : ""}`}>
            <div>
            <h1>{view === "overview" ? tr("Ymmärrä kausi numeroiden takaa.", "Understand the season behind the numbers.") : view === "teams" ? tr("Joukkueet", "Teams") : view === "season" ? tr("Kausitrendit", "Season trends") : view === "analyses" ? tr("Analyysit", "Analysis") : view === "matches" ? tr("Ottelut", "Games") : view === "players" ? tr("Pelaajat", "Players") : view === "matchup" ? "Matchup Lab" : tr("Ottelun tarina", "Game story")}</h1>
              <p className="intro-copy">{view === "overview" ? tr("Valitun sarjan kauden pääluvut ja kärjet. Syvenny joukkueisiin, pelaajiin ja kausianalyyseihin omilla välilehdillään.", "Key metrics and leaders for the selected league. Explore teams, players and season analysis in their own views.") : view === "teams" ? tr("Tutki joukkueen heittovalintoja ja tehokkuutta suhteessa sarjan tasoon.", "Explore a team's shot selection and efficiency relative to the league.") : view === "season" ? tr("Tutki kauden pääluvut ja vertaa joukkueen runkosarjaa pudotuspeleihin.", "Explore season averages and compare a team’s regular season with its playoffs.") : view === "analyses" ? tr("Ottelun tuloksen taakse katsovia juttuja, joissa data ja sen rajat näkyvät samassa paikassa.", "Stories that look behind the score and show both the data and its limits.") : view === "matches" ? tr("Selaa kauden otteluohjelmaa ja tuloksia. Avaa analyysi, kun ottelutilastot on tarkistettu.", "Browse the schedule and results. Open analysis once game statistics have been verified.") : view === "players" ? tr("Vertaa pelaajien pisteitä, syöttöjä, levypalloja ja tehokkuutta. Avaa profiili pelaajan nimestä.", "Compare scoring, passing, rebounding and efficiency. Open a player profile from a name.") : view === "matchup" ? tr("Vertaa joukkueita, pelaajia ja kausia. Tutki heittoprofiileja ja erilaisia ottelurajauksia.", "Compare teams, players and seasons. Explore shot profiles and different game samples.") : tr("Näe mitä tapahtui, milloin peli kääntyi ja mitä datasta voidaan oikeasti päätellä.", "See what happened, when the game shifted, and what the data can actually tell us.")}</p>
            </div>
            {view === "overview" ? <OverviewContext onOpenMatches={() => setView("matches")} /> : view === "teams" ? <div className="teams-intro-controls">
              <label className="team-page-select" htmlFor="team-page-select"><span>{tr("Valitse joukkue", "Select team")}</span><select id="team-page-select" value={selectedTeamId} onChange={(event) => setProfileTeamId(event.target.value)} aria-label={tr("Valitse joukkueprofiili", "Select team profile")}>{seasonData.aggregate.teams.map((team) => <option key={team.source_team_id} value={team.source_team_id}>{team.name}</option>)}</select></label>
              <SeasonSelector />
            </div> : !isMatchDetail ? <SeasonSelector /> : isMatchDetail ? <button className="outline-button" onClick={() => setView("matches")}>{tr("Palaa otteluihin", "Back to games")} <Icon name="chevron" size={13} /></button> : null}
          </section>

          <div key={seasonId}>
          {view === "analyses" ? <AnalysesIndex onOpenArticle={openAnalysis} /> : view === "matches" && seasonId === "2026-27" ? <CurrentSeasonMatches onOpenMatch={openMatch} /> : seasonId === "2026-27" && ["overview", "teams", "players", "season"].includes(view) && (!current || current.summary.valid_games === 0) ? <CurrentSeasonPending onOpenMatches={() => setView("matches")} /> : view === "overview" ? <OverviewView onOpenTeams={() => { setProfileTeamId(undefined); setView("teams"); }} /> : view === "matchup" ? <MatchupLab /> : view === "players" ? <PlayersView onOpenPlayer={openPlayer} /> : view === "teams" ? <TeamsView selectedTeamId={selectedTeamId} onOpenMatch={openMatch} /> : view === "season" ? <SeasonView onOpenTeams={(teamId) => { setProfileTeamId(teamId); setView("teams"); }} onOpenMatch={openMatch} /> : view === "matches" ? <MatchesView onOpenMatch={openMatch} /> : matchLoadState !== "ready" ? <div className="panel match-list-empty" role="status"><strong>{matchLoadState === "loading" ? tr("Ladataan ottelua…", "Loading game…") : matchLoadState === "missing" ? tr("Ottelua ei löydy tämän kauden aineistosta", "Game not found in this season’s dataset") : tr("Ottelun lataus epäonnistui", "Could not load game")}</strong><p>{tr("Valitse kausi ja ottelu Ottelut-sivulta.", "Select a season and game on the Games page.")}</p></div> : <>
          <section id="match-result" className="match-hero panel overview-section-anchor">
            <div className="match-hero-top">
              <div className="match-meta"><span>{tr(leagueName, leagueNameEn)}</span><span className="meta-separator">·</span><span>{activeMatch.season}</span></div>
            </div>
            <div className="scoreboard">
              <div className="team-block team-home">
                <div className="team-crest crest-coral">{teamMark(activeMatch.home.name)}</div>
                <div><span className="team-role">{tr("Koti", "Home")}</span><h2>{activeMatch.home.name}</h2></div>
              </div>
              <div className="score-center">
                <span className="final-label">{tr(activeMatch.status, "Final")}</span>
                <div className="score-line"><strong>{activeMatch.home.score}</strong><span>–</span><strong>{activeMatch.away.score}</strong></div>
                <div className="score-quarters" aria-label={tr("Neljänneksien pistetilanteet", "Quarter scores")}>{activeMatch.periods.map((period) => <span key={period.label}><b>{period.label}</b> {period.home}–{period.away}</span>)}</div>
              </div>
              <div className="team-block team-away">
                <div><span className="team-role">{tr("Vieras", "Away")}</span><h2>{activeMatch.away.name}</h2></div>
                <div className="team-crest crest-mint">{teamMark(activeMatch.away.name)}</div>
              </div>
            </div>
            <div className="match-context"><span>{activeMatch.date}{activeMatch.time === "—" ? "" : ` · ${activeMatch.time}`}</span><span>{activeMatch.venue}</span><span>{tr("Ottelu", "Game")} #{activeMatch.sourceMatchId}</span></div>
          </section>

          <nav className="view-tabs" aria-label={tr("Ottelun näkymät", "Game views")}>
            <button className={view === "story" ? "tab-active" : ""} onClick={() => setView("story")}>{tr("Ottelun tarina", "Game story")}</button>
            <button className={view === "data" ? "tab-active" : ""} onClick={() => setView("data")}>Data & {tr("saatavuus", "availability")}</button>
          </nav>

          {view === "story" && (
            <>
              <MatchReplay key={`${seasonId}-${selectedMatchId}`} matchId={selectedMatchId} state={replayState} />
              <section id="match-key-metrics" className="stat-strip overview-section-anchor" aria-label={tr("Ottelun avainluvut", "Game key metrics")}>
                {storyStats.map((stat) => <div className="stat-item" key={stat.label}><span className="stat-label">{stat.label}</span><strong className={`stat-value${stat.label === "eFG%" ? " stat-value--percent-pair" : ""}`}>{stat.value}</strong><span className="stat-note">{stat.note}</span></div>)}
              </section>

              <section className="analysis-board">
                <div id="match-comparison" className="panel comparison-panel overview-section-anchor">
                  <div className="panel-heading panel-heading--plain"><div><h3>{tr("Ottelun luvut", "Game numbers")}</h3></div></div>
                  <div className="comparison-teams"><span><i className="legend-dot coral-dot" /> {activeTeamSummary.home.name}</span><span>{activeTeamSummary.away.name} <i className="legend-dot mint-dot" /></span></div>
                  <div className="comparison-rows" role="group" aria-label={tr("Koti- ja vierasjoukkueen tilastovertailu", "Home and away team stat comparison")}>
                    {boxScoreComparisons.map(metric => <ComparisonRow key={metric.key} metric={metric} />)}
                  </div>
                  <div className="comparison-subheading"><span>{tr("Johdetut mittarit", "Derived metrics")}</span><small>{tr("box score -arvio", "box score estimate")}</small></div>
                  <div className="comparison-rows derived-rows">
                    {derivedComparisons.map(metric => <ComparisonRow key={metric.key} metric={metric} />)}
                  </div>
                  <div className="comparison-note">{tr("Vihreä tarkoittaa mittarin kannalta parempaa arvoa ja punainen heikompaa. Menetyksissä, PF:ssä ja DRtg:ssä pienempi on parempi. FG% lasketaan 2P- ja 3P-yrityksistä. ORtg, DRtg ja Net Rating käyttävät arvioituja pallonhallintoja.", "Green marks the better value for the metric and red the weaker one. Lower is better for turnovers, PF, and DRtg. FG% is calculated from 2P and 3P attempts. ORtg, DRtg, and Net Rating use estimated possessions.")}</div>
                </div>

                <ShotChart key={selectedMatchId} state={shotState} matchId={selectedMatchId} />
              </section>

              <section id="match-scorers" className="panel roster-panel overview-section-anchor">
                <div className="panel-heading panel-heading--plain"><div><h3>{tr("Pisteet tässä ottelussa", "Points in this game")}</h3></div><span className="signal-count">{activePlayers.length} {tr("pelaajaa", "players")}</span></div>
                <div className="roster-toolbar"><span>{tr("Rooli = lähteen karkea normalisointi · (A) = avausviisikko", "Role = rough normalization from the source · (S) = starter")}</span><div className="roster-filters"><button className={playerFilter === "all" ? "active" : ""} onClick={() => setPlayerFilter("all")}>{tr("Kaikki", "All")}</button><button className={playerFilter === "home" ? "active" : ""} onClick={() => setPlayerFilter("home")}>{activeMatch.home.name}</button><button className={playerFilter === "away" ? "active" : ""} onClick={() => setPlayerFilter("away")}>{activeMatch.away.name}</button></div></div>
                <div className="roster-columns">
                  {[{ key: "home" as const, name: activeMatch.home.name, color: "coral" }, { key: "away" as const, name: activeMatch.away.name, color: "mint" }].map((team) => {
                    const teamPlayers = activePlayers.filter((player) => player.team === team.name).sort((a, b) => playerPoints(b) - playerPoints(a));
                    if (playerFilter !== "all" && playerFilter !== team.key) return null;
                    return <div className="roster-team" key={team.name}>
                      <div className="roster-team-heading"><span><i className={`legend-dot ${team.color === "coral" ? "coral-dot" : "mint-dot"}`} /> {team.name}</span><strong>{teamPlayers.reduce((total, player) => total + (player.stats.points ?? 0), 0)} {tr("pistettä", "points")}</strong></div>
                      <div className="roster-header"><span>{tr("Pelaaja", "Player")}</span><span>MIN</span><span>PTS</span><span>FG%</span><span>REB</span><span>AST</span><span>TO</span><span>PF</span></div>
                      {teamPlayers.map((player) => <div className="roster-row" key={player.name}><span className="roster-player"><span><strong>{player.name}{player.starter ? <em className="starter-marker"> {tr("(A)", "(S)")}</em> : null}</strong><small>{player.role ?? "—"}</small></span></span><span className="roster-minutes">{displayMinutes(player.stats.minutes)}</span><strong className="roster-points">{displayStat(player.stats.points)}</strong><span className="roster-stat">{displayPct(playerFgPct(player.stats))}</span><span className="roster-stat">{displayStat(player.stats.rebounds)}</span><span className="roster-stat">{displayStat(player.stats.assists)}</span><span className="roster-stat">{displayStat(player.stats.turnovers)}</span><span className="roster-fouls">{displayStat(player.stats.fouls)}</span></div>)}
                    </div>;
                  })}
                </div>
              </section>

              <section className="bottom-grid">
                <div id="match-observations" className="panel narrative-panel overview-section-anchor">
                  <div className="panel-heading panel-heading--plain"><div><h3>{tr("Kolme havaintoa", "Three observations")}</h3></div><ArrowUpRight /></div>
                  <div className="insight-list">
                    {displayedInsights.map((insight, index) => <article className="insight" key={insight.title}><div className={`insight-index ${insight.accent}`}>0{index + 1}</div><div><span className="insight-eyebrow">{insight.eyebrow}</span><h4>{insight.title}</h4><p>{insight.body}</p></div></article>)}
                  </div>
                </div>
                <div id="match-availability" className="panel signal-panel overview-section-anchor">
                  <div className="panel-heading panel-heading--plain"><div><h3>{tr("Mitä tiedämme?", "What do we know?")}</h3></div><span className="signal-count">{displayedAvailability.filter((item) => item.tone === "ready").length}/{displayedAvailability.length}</span></div>
                  <div className="signal-progress"><span style={{ width: `${100 * displayedAvailability.filter((item) => item.tone === "ready").length / displayedAvailability.length}%` }} /></div>
                  <p className="signal-copy">{tr("Tämä näkymä erottaa julkaistun faktan, puuttuvan kentän ja vielä validoimattoman tiedon.", "This view separates published facts, missing fields, and data that still needs validation.")}</p>
                  <div className="signal-links"><span><i className="signal-dot ready" /> {tr("Saatavilla", "Available")}</span><span><i className="signal-dot warning" /> {tr("Tarkistettava", "Needs review")}</span></div>
                  <button className="outline-button small" onClick={() => setView("data")}>{tr("Näytä kaikki kentät", "Show all fields")} <ArrowUpRight /></button>
                </div>
              </section>
            </>
          )}

          {view === "data" && <section className="panel detail-panel"><div className="panel-heading"><div><span className="section-kicker">{tr("Datan tiedot", "Data details")}</span><h3>{tr("Ottelun datan saatavuus", "Game data availability")}</h3></div><span className="source-id">{tr("Ottelu-ID", "Game ID")} {activeMatch.sourceMatchId}</span></div><p className="detail-intro">{tr("KorisLab ei täytä puuttuvia arvoja nollilla. Jokainen analyysi rakentuu saatavilla olevien tilastokenttien varaan.", "KorisLab does not fill missing values with zeros. Each analysis is built on the statistics fields available.")}</p><div className="availability-list">{displayedAvailability.map((item) => <div className="availability-row" key={item.label}><span className={`availability-icon ${item.tone}`}><Icon name={item.tone === "ready" ? "check" : item.tone === "warning" ? "warning" : "minus"} size={15} /></span><div><strong>{item.label}</strong><span>{item.detail}</span></div><em className={item.tone}>{item.value}</em></div>)}</div><div className="data-footnote"><span className="status-dot" /> {tr("Ottelutilastot tarkistettu tuonnissa", "Game statistics validated during import")}</div></section>}
          </>}
          </div>
          </>}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
