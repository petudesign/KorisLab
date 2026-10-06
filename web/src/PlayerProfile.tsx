import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ShotCount } from "./ShotCount";
import { SeasonSelector, useSeason, type SeasonMatchRecord } from "./SeasonContext";
import { aggregateSeasonPlayers, aggregatePlayerShotVolumes, playerPerGame, playerFgPctFromTotals, playerFtPctFromTotals, playerEfGPctFromTotals, playerTrueShootingPctFromTotals, trueShootingPct, playerAttemptsPer40, playerAssistTurnoverRatio, playerEfficiencyPer40, playerGameOutcome, progressivePlayerQualification, type SeasonPlayerRow } from "./playerStats";
import { useI18n } from "./i18n";
import { scheduleByMatchId } from "./schedule";
import { followLink, routeHref } from "./routing";
import { usePageMetadata } from "./seo";
import { PlayerPortrait } from "./PlayerPortrait";
import { MetricSparkline } from "./MetricSparkline";
import { AssistCreation } from "./AssistCreation";
import { PlayerShotChart } from "./ShotChart";
import { Icon } from "./Icon";
import { getPlayerAwards } from "./playerAwards";
import { PlayerSeasonComparison } from "./PlayerSeasonComparison";
import { leagueAssetPath } from "./leagues";
import { PlayerStrengths } from "./PlayerStrengths";

type ProfileMetric = { label: string; value: string; note: ReactNode; series?: Array<number | null> };
type PlayerBio = { positions_fi?: string[]; positions_en?: string[]; height_cm?: number | null; nationality?: string | null };
type PlayerBioSnapshot = { schema_version: string; league_id: string; season_id: string; players: Record<string, PlayerBio> };

function nationalityLabel(code: string, language: string) {
  try {
    return new Intl.DisplayNames([language === "fi" ? "fi-FI" : "en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function PlayerProfile({ playerId, onOpenMatch, onBack }: { playerId: string; onOpenMatch: (id: string) => void; onBack: () => void }) {
  const { leagueId, leagueName, leagueNameEn, seasonId, seasonLabel, current, loadMatches, loadMatchesForSeason, setSeasonId } = useSeason();
  const { language, tr } = useI18n();
  const [phase, setPhase] = useState<"regular" | "playoffs">("regular");
  const [profileView, setProfileView] = useState<"season" | "comparison">("season");
  const activePhase = seasonId !== "2026-27" ? phase : "regular";
  const [records, setRecords] = useState<SeasonMatchRecord[]>([]);
  const [knownPlayer, setKnownPlayer] = useState<SeasonPlayerRow>();
  const [playerBios, setPlayerBios] = useState<Record<string, PlayerBio>>({});
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setPlayerBios({});
    void fetch(leagueAssetPath(leagueId, `player-profiles-${seasonId}.json`), { cache: "no-cache" })
      .then(response => response.ok ? response.json() as Promise<PlayerBioSnapshot> : null)
      .then(snapshot => {
        if (!cancelled && snapshot?.schema_version === "0.1" && snapshot.league_id === leagueId && snapshot.season_id === seasonId) {
          setPlayerBios(snapshot.players ?? {});
        }
      })
      .catch(() => { /* Bio fields are optional when the source has no roster data. */ });
    return () => { cancelled = true; };
  }, [leagueId, seasonId]);
  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setError(false);
    setRecords([]);
    setKnownPlayer(undefined);
    void loadMatches().then(async (regularMatches) => {
      let matches = regularMatches;
      if (seasonId !== "2026-27" && activePhase === "playoffs") {
        matches = await loadMatchesForSeason(seasonId, "playoffs");
      }
      let identity = aggregateSeasonPlayers(regularMatches).find((player) => player.id === playerId)
        ?? aggregateSeasonPlayers(matches).find((player) => player.id === playerId);
      if (!identity && seasonId === "2026-27") {
        const previous = await loadMatchesForSeason("2025-26");
        identity = aggregateSeasonPlayers(previous).find((player) => player.id === playerId);
      }
      if (!cancelled) { setRecords(matches); setKnownPlayer(identity); setLoaded(true); }
    }).catch(() => { if (!cancelled) { setError(true); setLoaded(true); } });
    return () => { cancelled = true; };
  }, [loadMatches, loadMatchesForSeason, playerId, seasonId, activePhase]);
  const leaguePlayers = useMemo(() => aggregateSeasonPlayers(records), [records]);
  const player = leaguePlayers.find((row) => row.id === playerId);
  const strengthsQualification = useMemo(() => progressivePlayerQualification(records), [records]);
  const playerShotVolume = useMemo(() => aggregatePlayerShotVolumes(records).get(playerId), [records, playerId]);
  const playerTeamShotShare = playerShotVolume?.complete && playerShotVolume.teamFieldGoalAttempts > 0
    ? (playerShotVolume.fieldGoalAttempts / playerShotVolume.teamFieldGoalAttempts) * 100
    : null;
  const maxTeamGames = useMemo(() => {
    const counts = new Map<string, number>();
    const countGame = (teamName: string) => counts.set(teamName, (counts.get(teamName) ?? 0) + 1);
    if (seasonId === "2026-27" && activePhase === "regular" && current?.schedule.length) {
      current.schedule.forEach((game) => { countGame(game.home.name); countGame(game.away.name); });
    } else {
      records.forEach((record) => record.teams.forEach((team) => countGame(team.source_id)));
    }
    return Math.max(0, ...counts.values());
  }, [activePhase, current?.schedule, records, seasonId]);
  const minimumLeagueGames = Math.max(2, Math.ceil(maxTeamGames / 2));
  const qualifiedLeaguePlayers = useMemo(() => leaguePlayers.filter((row) => row.games >= minimumLeagueGames), [leaguePlayers, minimumLeagueGames]);
  const games = useMemo(() => records.flatMap((record) => record.teams.flatMap((team) => {
    const appearance = team.players.find((row) => row.source_player_id === playerId && (row.minutes ?? 0) > 0);
    if (!appearance) return [];
    const opponent = record.teams.find((other) => other !== team);
    const date = scheduleByMatchId[record.game.source_id] ?? record.game.scheduled_at;
    return [{ id: record.game.source_id, date, team, opponent, appearance, outcome: playerGameOutcome(team.score, opponent?.score) }];
  })).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")), [records, playerId]);
  const decimal = (value: number | null | undefined) => value == null ? "—" : value.toLocaleString(language === "fi" ? "fi-FI" : "en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const signedDecimal = (value: number | null | undefined) => value == null ? "—" : `${value > 0 ? "+" : value < 0 ? "−" : ""}${decimal(Math.abs(value))}`;
  const leagueAverages = useMemo(() => {
    const mean = (values: Array<number | null | undefined>) => {
      const available = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
      return available.length > 0 ? available.reduce((sum, value) => sum + value, 0) / available.length : null;
    };
    const totals = qualifiedLeaguePlayers.reduce((sum, row) => ({
      points: sum.points + row.points,
      twoPM: sum.twoPM + row.twoPM,
      twoPA: sum.twoPA + row.twoPA,
      threePM: sum.threePM + row.threePM,
      threePA: sum.threePA + row.threePA,
      ftm: sum.ftm + row.ftm,
      fta: sum.fta + row.fta,
    }), { points: 0, twoPM: 0, twoPA: 0, threePM: 0, threePA: 0, ftm: 0, fta: 0 });
    const fieldGoalAttempts = totals.twoPA + totals.threePA;
    return {
      points: mean(qualifiedLeaguePlayers.map((row) => playerPerGame(row, "points"))),
      assists: mean(qualifiedLeaguePlayers.map((row) => playerPerGame(row, "assists"))),
      rebounds: mean(qualifiedLeaguePlayers.map((row) => playerPerGame(row, "rebounds"))),
      steals: mean(qualifiedLeaguePlayers.map((row) => playerPerGame(row, "steals"))),
      blocks: mean(qualifiedLeaguePlayers.map((row) => playerPerGame(row, "blocks"))),
      blocksReceived: mean(qualifiedLeaguePlayers.map((row) => playerPerGame(row, "blocksReceived"))),
      plusMinus: mean(qualifiedLeaguePlayers.map((row) => playerPerGame(row, "plusMinus"))),
      minutes: mean(qualifiedLeaguePlayers.map((row) => row.games > 0 ? row.minutes / row.games : null)),
      attemptsPer40: mean(qualifiedLeaguePlayers.map(playerAttemptsPer40)),
      assistTurnover: mean(qualifiedLeaguePlayers.map(playerAssistTurnoverRatio)),
      freeThrows: totals.fta > 0 ? (totals.ftm / totals.fta) * 100 : null,
      efficiencyPer40: mean(qualifiedLeaguePlayers.map(playerEfficiencyPer40)),
      fieldGoals: fieldGoalAttempts > 0 ? ((totals.twoPM + totals.threePM) / fieldGoalAttempts) * 100 : null,
      effectiveFieldGoals: fieldGoalAttempts > 0 ? ((totals.twoPM + totals.threePM * 1.5) / fieldGoalAttempts) * 100 : null,
      trueShooting: trueShootingPct(totals.points, fieldGoalAttempts, totals.fta),
    };
  }, [qualifiedLeaguePlayers]);
  const averageText = (value: number | null, unit = "") => value == null ? undefined : decimal(value) + unit;
  const name = knownPlayer?.name ?? tr("Pelaajaprofiili", "Player profile");
  const phaseDescription = activePhase === "playoffs" ? tr("pudotuspeleissä", "in the playoffs") : tr("runkosarjassa", "in the regular season");
  const playerBio = playerBios[playerId];
  const profilePositions = language === "fi" ? playerBio?.positions_fi : playerBio?.positions_en;
  const nationality = playerBio?.nationality ? nationalityLabel(playerBio.nationality, language) : null;
  const discoverySummary = player
    ? tr(
      `${name} pelasi ${leagueName}n ${seasonLabel} kauden ${phaseDescription} ${player.games} ottelua. Hän teki keskimäärin ${decimal(playerPerGame(player, "points"))} pistettä, ${decimal(playerPerGame(player, "rebounds"))} levypalloa ja ${decimal(playerPerGame(player, "assists"))} syöttöä ottelua kohti. Keskiarvot perustuvat pelattuihin otteluihin eivätkä yksin kuvaa pelaajan roolia tai kokonaisvaikutusta.`,
      `${name} appeared in ${player.games} ${leagueNameEn} games ${phaseDescription} in ${seasonLabel}, averaging ${decimal(playerPerGame(player, "points"))} points, ${decimal(playerPerGame(player, "rebounds"))} rebounds and ${decimal(playerPerGame(player, "assists"))} assists per game. These box-score averages do not describe the player's role or overall impact on their own.`,
    )
    : tr(`${name}: ${leagueName} kauden ${seasonLabel} varmennettuja pelaajatilastoja ei ole saatavilla.`, `${name}: verified ${leagueNameEn} player statistics for ${seasonLabel} are unavailable.`);
  const profileUrl = new URL(routeHref("player-profile", seasonId, playerId, leagueId), window.location.origin).href;
  const profileStructuredData = player ? {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    name: `${name} · ${leagueName} ${seasonLabel}`,
    description: discoverySummary,
    url: profileUrl,
    mainEntity: {
      "@type": "Person",
      "@id": `${profileUrl}#player`,
      name,
      description: discoverySummary,
      memberOf: { "@type": "SportsTeam", name: player.team },
    },
  } : null;
  usePageMetadata(`${name} · ${seasonLabel}`, discoverySummary, { noindex: loaded && !knownPlayer, structuredData: profileStructuredData });
  const wins = games.filter((game) => game.outcome === "win").length;
  const losses = games.filter((game) => game.outcome === "loss").length;
  const awards = getPlayerAwards(playerId);
  const leagueAverageByLabel: Record<string, string | undefined> = player ? {
    [tr("Pisteet", "Points")]: averageText(leagueAverages.points),
    [tr("Syötöt", "Assists")]: averageText(leagueAverages.assists),
    [tr("Levypallot", "Rebounds")]: averageText(leagueAverages.rebounds),
    [tr("Riistot", "Steals")]: averageText(leagueAverages.steals),
    [tr("Torjunnat", "Blocks")]: averageText(leagueAverages.blocks),
    [tr("Blokatut heitot", "Blocked shots received")]: averageText(leagueAverages.blocksReceived),
    ["+/−"]: leagueAverages.plusMinus == null ? undefined : signedDecimal(leagueAverages.plusMinus),
    [tr("Peliaika", "Playing time")]: averageText(leagueAverages.minutes, " min"),
    ["AST/TO"]: averageText(leagueAverages.assistTurnover),
    "FT%": averageText(leagueAverages.freeThrows, "%"),
    "Eff/40": averageText(leagueAverages.efficiencyPer40),
    "FG%": averageText(leagueAverages.fieldGoals, "%"),
    "eFG%": averageText(leagueAverages.effectiveFieldGoals, "%"),
    "TS%": averageText(leagueAverages.trueShooting, "%"),
    "FGA/40": averageText(leagueAverages.attemptsPer40),
  } : {};
  const gameStatColumns = [
    { key: "points", label: "PTS" },
    { key: "rebounds", label: "REB" },
    { key: "assists", label: "AST" },
    { key: "steals", label: "STL" },
    { key: "blocks", label: "BLK" },
    { key: "blocks_received", label: "BR" },
  ] as const;
  const outcomeLabels = { win: tr("Voitto", "Win"), loss: tr("Tappio", "Loss"), draw: tr("Tasapeli", "Draw"), unknown: tr("Tulos puuttuu", "Result unavailable") };
  const outcomeMarks = { win: tr("V", "W"), loss: tr("H", "L"), draw: tr("T", "D"), unknown: "—" };
  const recentGamesOldestFirst = games.slice(0, 10).reverse();
  const seriesFor = (read: (game: (typeof games)[number]) => number | null) => recentGamesOldestFirst.map(read);
  const metrics: ProfileMetric[] = player ? [
    { label: tr("Pisteet", "Points"), value: decimal(playerPerGame(player, "points")), note: tr("per ottelu", "per game"), series: seriesFor((game) => game.appearance.stats.points ?? 0) },
    { label: tr("Syötöt", "Assists"), value: decimal(playerPerGame(player, "assists")), note: tr("per ottelu", "per game"), series: seriesFor((game) => game.appearance.stats.assists ?? 0) },
    { label: tr("Levypallot", "Rebounds"), value: decimal(playerPerGame(player, "rebounds")), note: tr("per ottelu", "per game"), series: seriesFor((game) => game.appearance.stats.rebounds ?? 0) },
    { label: tr("Riistot", "Steals"), value: decimal(playerPerGame(player, "steals")), note: tr("per ottelu", "per game"), series: seriesFor((game) => game.appearance.stats.steals ?? null) },
    { label: tr("Torjunnat", "Blocks"), value: decimal(playerPerGame(player, "blocks")), note: tr("per ottelu", "per game"), series: seriesFor((game) => game.appearance.stats.blocks ?? null) },
    { label: tr("Blokatut heitot", "Blocked shots received"), value: decimal(playerPerGame(player, "blocksReceived")), note: tr("vastustajan torjumat / ottelu", "blocked by opponents per game"), series: seriesFor((game) => game.appearance.stats.blocks_received ?? null) },
    { label: "+/−", value: signedDecimal(playerPerGame(player, "plusMinus")), note: tr("joukkueen piste-ero kentällä / ottelu", "team margin while on court per game"), series: seriesFor((game) => game.appearance.stats.plus_minus ?? null) },
    { label: tr("Peliaika", "Playing time"), value: `${decimal(player.minutes / player.games)} min`, note: tr("per ottelu", "per game"), series: seriesFor((game) => game.appearance.minutes ?? 0) },
    { label: tr("Ottelut", "Games"), value: String(player.games), note: `${wins} ${tr("V", "W")} · ${losses} ${tr("H", "L")}` },
    { label: "AST/TO", value: decimal(playerAssistTurnoverRatio(player)), note: tr("syötöt / menetykset", "assists / turnovers"), series: seriesFor((game) => game.appearance.stats.turnovers ? (game.appearance.stats.assists ?? 0) / game.appearance.stats.turnovers : null) },
    { label: "FT%", value: playerFtPctFromTotals(player) == null ? "—" : `${decimal(playerFtPctFromTotals(player))}%`, note: <><ShotCount made={player.ftm} attempted={player.fta} /> {tr("vapaaheittoa", "free throws")}</>, series: seriesFor((game) => game.appearance.stats.fta ? ((game.appearance.stats.ftm ?? 0) / game.appearance.stats.fta) * 100 : null) },
    { label: "Eff/40", value: decimal(playerEfficiencyPer40(player)), note: tr("tehokkuus / 40 min", "efficiency / 40 min"), series: seriesFor((game) => game.appearance.minutes && game.appearance.stats.efficiency != null ? (game.appearance.stats.efficiency / game.appearance.minutes) * 40 : null) },
    { label: "FG%", value: playerFgPctFromTotals(player) == null ? "—" : `${decimal(playerFgPctFromTotals(player))}%`, note: <><ShotCount made={player.twoPM + player.threePM} attempted={player.twoPA + player.threePA} /> {tr("heittoa", "shots")}</>, series: seriesFor((game) => {
      const attempts = (game.appearance.stats.two_pa ?? 0) + (game.appearance.stats.three_pa ?? 0);
      return attempts > 0 ? (((game.appearance.stats.two_pm ?? 0) + (game.appearance.stats.three_pm ?? 0)) / attempts) * 100 : null;
    }) },
    { label: "eFG%", value: playerEfGPctFromTotals(player) == null ? "—" : `${decimal(playerEfGPctFromTotals(player))}%`, note: tr("kolmosen lisäarvon huomioiva FG%", "FG% adjusted for the value of threes"), series: seriesFor((game) => {
      const attempts = (game.appearance.stats.two_pa ?? 0) + (game.appearance.stats.three_pa ?? 0);
      return attempts > 0 ? (((game.appearance.stats.two_pm ?? 0) + (game.appearance.stats.three_pm ?? 0) * 1.5) / attempts) * 100 : null;
    }) },
    { label: "TS%", value: playerTrueShootingPctFromTotals(player) == null ? "—" : `${decimal(playerTrueShootingPctFromTotals(player))}%`, note: tr("2P-, 3P- ja vapaaheitot huomioiva", "Includes 2P, 3P, and free throws"), series: seriesFor((game) => {
      const stats = game.appearance.stats;
      const attempts = stats.two_pa == null || stats.three_pa == null ? null : stats.two_pa + stats.three_pa;
      return trueShootingPct(stats.points, attempts, stats.fta);
    }) },
    { label: "FGA/40", value: decimal(playerAttemptsPer40(player)), note: <>{tr("kenttäheittoyritystä / 40 min", "field-goal attempts / 40 min")}{playerTeamShotShare == null ? "" : <><br />{decimal(playerTeamShotShare)}% {tr("joukkueen kenttäheittoyrityksistä", "of team field-goal attempts")}</>}</>, series: seriesFor((game) => {
      const stats = game.appearance.stats;
      const attempts = stats.two_pa == null || stats.three_pa == null ? null : stats.two_pa + stats.three_pa;
      return game.appearance.minutes && attempts != null ? (attempts / game.appearance.minutes) * 40 : null;
    }) },
  ] : [];
  return (
    <div className="player-profile">
      <a className="profile-back" href={routeHref("players", seasonId, undefined, leagueId)} onClick={(event) => followLink(event, onBack)}>
        <Icon name="arrowBack" size={15} /> {tr("Kaikki pelaajat", "All players")}
      </a>
      <section className="intro-row">
        <div className="player-profile-identity">
          <PlayerPortrait className="player-profile-portrait" />
          <div><h1>{name}</h1>
          <p className="intro-copy">{player
            ? `${player.team} · ${seasonLabel} · ${profileView === "comparison" ? tr("kausivertailu", "season comparison") : activePhase === "playoffs" ? tr("pudotuspelit", "playoffs") : tr("runkosarja", "regular season")}`
            : profileView === "comparison"
              ? `${tr(leagueName, leagueNameEn)} · ${seasonLabel} · ${tr("kausivertailu", "season comparison")}`
              : `${tr(leagueName, leagueNameEn)} · ${seasonLabel}`}</p>
          {(profilePositions?.length || playerBio?.height_cm || nationality) ? <dl className="player-profile-bio">
            {profilePositions?.length ? <div><dt>{tr("Pelipaikka", "Position")}</dt><dd>{profilePositions.join(" / ")}</dd></div> : null}
            {playerBio?.height_cm ? <div><dt>{tr("Pituus", "Height")}</dt><dd>{playerBio.height_cm} cm</dd></div> : null}
            {nationality ? <div><dt>{tr("Kansalaisuus", "Nationality")}</dt><dd>{nationality}</dd></div> : null}
          </dl> : null}</div>
        </div>
        <SeasonSelector />
      </section>
      {player && <p className="profile-discovery-summary panel">{discoverySummary}</p>}
      <div className="profile-phase-toggle" role="group" aria-label={tr("Profiilinäkymä", "Profile view")}>
        <button type="button" aria-pressed={profileView === "season" && activePhase === "regular"} onClick={() => { setPhase("regular"); setProfileView("season"); }}>{tr("Runkosarja", "Regular season")}</button>
        {seasonId !== "2026-27" && <button type="button" aria-pressed={profileView === "season" && activePhase === "playoffs"} onClick={() => { setPhase("playoffs"); setProfileView("season"); }}>{tr("Pudotuspelit", "Playoffs")}</button>}
        <button type="button" aria-pressed={profileView === "comparison"} onClick={() => setProfileView("comparison")}>{tr("Kausivertailu", "Season comparison")}</button>
      </div>
      {awards.length > 0 && <section className="profile-awards" aria-label={tr("Pelaajan palkinnot", "Player awards")}>
        <h2>{tr("Palkinnot", "Awards")}</h2>
        <ul className="profile-awards-list">
          {awards.map((award) => <li key={`${award.season}-${award.labelFi}`}>
            <a className="profile-award-link" href={award.sourceUrl} target="_blank" rel="noreferrer">
              <span className="profile-award-season">{award.season.replace("-", "–")}</span>
              <strong>{language === "fi" ? award.labelFi : award.labelEn}</strong>
              <Icon name="arrowOutward" size={12} />
              <span className="sr-only"> · {tr("Basket.fi:n palkintolistaus", "Basket.fi awards list")}</span>
            </a>
          </li>)}
        </ul>
      </section>}
      {!loaded ? (
        <div className="panel match-list-empty" role="status">{tr("Ladataan pelaajaprofiilia…", "Loading player profile…")}</div>
      ) : error ? (
        <div className="panel match-list-empty" role="alert">
          <strong>{tr("Profiilin lataus epäonnistui", "Could not load profile")}</strong>
          <p>{tr("Yritä päivittää sivu.", "Try refreshing the page.")}</p>
        </div>
      ) : profileView === "comparison" && knownPlayer ? (
        <PlayerSeasonComparison playerId={playerId} playerName={name} seasonLimit={seasonId} phase={activePhase} />
      ) : !player ? (
        <div className="panel match-list-empty">
          <h2>{activePhase === "playoffs" ? tr("Ei pudotuspeliotteluita", "No playoff appearances") : tr("Ei ottelutilastoja tältä kaudelta", "No game statistics for this season")}</h2>
          <p>{activePhase === "playoffs" ? tr(`Pelaajalle ei löydy pelattuja otteluita kauden ${seasonLabel} pudotuspeliaineistosta.`, `No playoff appearances for this player in the ${seasonLabel} dataset.`) : tr("Pelaajalle ei löydy pelattuja otteluita valitun kauden aineistosta.", "No played games for this player in the selected season's dataset.")}</p>
          {knownPlayer && seasonId === "2026-27" && (
            <button className="outline-button" onClick={() => setSeasonId("2025-26")}>
              {tr("Näytä kausi 2025–26", "View season 2025–26")}
            </button>
          )}
        </div>
      ) : (
        <>
          <section className="profile-metrics" aria-label={tr("Pelaajan kauden luvut", "Player season metrics")}>
            <small className="profile-metrics-context">{tr("Liigan keskiarvo", "League average")}: {qualifiedLeaguePlayers.length} {tr("pelaajaa, vähintään", "players with at least")} {minimumLeagueGames} {tr("ottelua", "games")} · {tr("Käyrät: 10 uusinta ottelua, uusin oikealla", "Charts: 10 latest games, newest on the right")}</small>
            {metrics.map(({ label, value, note, series }) => (
              <div className={`panel profile-metric${leagueAverageByLabel[label] ? "" : " profile-metric--no-average"}`} key={label}>
                <div className="profile-metric-main">
                  <span className="stat-label">{label}</span>
                  <strong>{value}</strong>
                  <small>{note}</small>
                </div>
                {leagueAverageByLabel[label] && <div className="profile-metric-aside">
                  <div className="profile-metric-benchmark"><small>{tr("Liigan ka.", "League avg.")}</small><strong>{leagueAverageByLabel[label]}</strong></div>
                  {series && <MetricSparkline values={series} label={label} language={language} />}
                </div>}
              </div>
            ))}
          </section>
          <PlayerStrengths player={player} players={leaguePlayers} minimumGames={strengthsQualification.minimumGames} minimumMinutes={strengthsQualification.minimumMinutes} teamShotShare={playerTeamShotShare} />
          {activePhase === "regular" || leagueId === "korisliiga" ? <>
            <AssistCreation players={[player]} profile phase={activePhase} />
            <PlayerShotChart playerId={playerId} playerName={name} seasonId={activePhase === "playoffs" ? `${seasonId}-playoffs` : seasonId} playerGameIds={games.map((game) => game.id)} />
          </> : <>
            <p className="players-method-note">{tr("Pudotuspelien pelitilannekohtainen syöttöanalyysi ei ole vielä varmennettu. Box score -tilastot ja otteluloki ovat pudotuspelien omasta aineistosta.", "Play-by-play assist analysis is not yet verified for the playoffs. Box-score stats and game log use the playoff dataset.")}</p>
            <p className="players-method-note">{tr("Pudotuspelien pelaajakohtaisia heittokarttoja ei ole vielä tuotu aineistoon.", "Player shot charts have not yet been imported for the playoffs.")}</p>
          </>}
          <section className="panel players-table-panel">
            <div className="panel-heading panel-heading--plain">
              <div>
                <h2>{tr("Otteluloki", "Game log")}</h2>
                <p className="panel-subcopy">{tr("Uusin ottelu ensin. V = voitto, H = tappio. Avaa ottelu päivämäärästä.", "Latest game first. W = win, L = loss. Open a game from its date.")}</p>
              </div>
              <span className="panel-context">{wins}–{losses} {tr("V–H", "W–L")} · {games.length} {tr("ottelua", "games")}</span>
            </div>
            <div className="players-table-wrap">
              <table className="players-table">
                <caption className="sr-only">{name} · {tr("ottelukohtaiset tilastot", "game statistics")}</caption>
                <thead>
                  <tr>{[tr("Ottelu", "Game"), tr("Vastustaja", "Opponent"), "MIN", ...gameStatColumns.map((column) => column.label), "+/−"].map((label) => <th scope="col" key={label}>{label === "BR" ? <abbr title={tr("Vastustajan torjumat heitot", "Blocked shots received")}>{label}</abbr> : label}</th>)}</tr>
                </thead>
                <tbody>
                  {games.map((game) => {
                    const plusMinus = game.appearance.stats.plus_minus;
                    const plusMinusClass = plusMinus == null ? "" : plusMinus > 0 ? "profile-plus-minus--positive" : plusMinus < 0 ? "profile-plus-minus--negative" : "profile-plus-minus--even";
                    return <tr key={game.id}>
                      <th scope="row">
                        <a className="player-name-link" href={routeHref("story", seasonId, game.id, leagueId)} onClick={(event) => followLink(event, () => onOpenMatch(game.id))}>
                          {game.date ? new Date(game.date).toLocaleDateString(language === "fi" ? "fi-FI" : "en-GB") : `#${game.id}`}
                        </a>
                      </th>
                      <td className="profile-opponent">
                        <span className={`profile-opponent-name profile-opponent-name--${game.outcome}`}>
                          <span className="profile-outcome-mark" title={outcomeLabels[game.outcome]}><span aria-hidden="true">{outcomeMarks[game.outcome]}</span><span className="sr-only">{outcomeLabels[game.outcome]}: </span></span>
                          <span>{game.opponent?.name ?? "—"}</span>
                        </span>
                        <small>{game.team.name} · {game.team.stats.points ?? "—"}–{game.opponent?.stats.points ?? "—"}</small>
                      </td>
                      <td>{decimal(game.appearance.minutes)}</td>
                      {gameStatColumns.map(({ key }) => <td key={key}>{game.appearance.stats[key] ?? "—"}</td>)}
                      <td className={`profile-plus-minus ${plusMinusClass}`}>
                        {plusMinus == null ? "—" : `${plusMinus > 0 ? "+" : plusMinus < 0 ? "−" : ""}${Math.abs(plusMinus)}`}
                      </td>
                    </tr>
                  })}
                </tbody>
              </table>
            </div>
            <p className="players-method-note">{tr(
              "Keskiarvot lasketaan otteluista, joissa pelaaja pelasi. FG%, FT% ja eFG% lasketaan kauden osumista ja yrityksistä yhteensä. BR = vastustajan torjumat heitot. AST/TO = syötöt / menetykset. +/− kuvaa joukkueen piste-eroa pelaajan kentälläoloaikana. Eff/40 normalisoi tehokkuusluvun 40 minuuttiin.",
              "Averages include games in which the player played. FG%, FT% and eFG% use season makes and attempts. BR = blocked shots received. AST/TO = assists / turnovers. +/- is the team's score margin while the player was on court. Eff/40 normalizes the efficiency figure to 40 minutes.",
            )}</p>
          </section>
        </>
      )}
    </div>
  );
}
