import { useEffect, useMemo, useState } from "react";
import { useSeason, type SeasonId, type SeasonMatchRecord } from "./SeasonContext";
import { useI18n } from "./i18n";
import { playerDisplayName } from "./playerName";
import { Icon } from "./Icon";
import { ShotCount } from "./ShotCount";
import { appearanceSplit, buildComparisonEntries, comparisonValues, entityGames, parseOnOff, recentSplit, type ComparisonEntry, type ComparisonKind, type OnOffData } from "./matchupStats";

type Mode = "entities" | "seasons" | "recent" | "phase" | "appearance" | "onoff";
type Metric = { key: string; label: string; unit?: string; lower?: boolean; neutral?: boolean; decimals?: number };
type Side = { entry?: ComparisonEntry; name: string; detail: string; emptyMessage?: string };
const seasons: SeasonId[] = ["2024-25", "2025-26", "2026-27"];

function Select({ label, value, options, onChange, exclude }: { label: string; value: string; options: { id: string; name: string }[]; onChange: (value: string) => void; exclude?: string }) {
  const { tr } = useI18n();
  return <label className="matchup-control"><span>{label}</span><select aria-label={label} value={value} disabled={!options.length} onChange={(event) => onChange(event.target.value)}>{!options.length && <option value="">{tr("Ei vaihtoehtoja", "No options")}</option>}{options.map((entry) => <option key={entry.id} value={entry.id} disabled={entry.id === exclude}>{entry.name}</option>)}</select></label>;
}

function Comparison({ sides, metrics, shooting }: { sides: [Side, Side]; metrics: Metric[]; shooting: boolean }) {
  const { tr, language } = useI18n();
  const format = (value: number | null, decimals = 1) => value == null ? "—" : value.toLocaleString(language === "fi" ? "fi-FI" : "en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return <>
      <div className="matchup-selections">{sides.map((side, index) => <div className="panel matchup-selection" key={index}><span className="eyebrow">{index ? "B" : "A"}</span><h2>{side.name}</h2><p>{side.detail}</p>{!side.entry && <p role="status">{side.emptyMessage ?? tr("Ei tilastoituja suorituksia tässä rajauksessa.", "No recorded performances in this selection.")}</p>}</div>)}</div>
    <section className="panel matchup-comparison" aria-labelledby="matchup-comparison-title">
      <div className="panel-heading panel-heading--plain"><div><h2 id="matchup-comparison-title">{tr("Luvut rinnakkain", "Side-by-side statistics")}</h2><p className="panel-subcopy">{tr("Ero = A − B. Vihreä ja lihavointi merkitsevät parempaa arvoa. Otoskoot, peliaika ja heittovalinnat ovat neutraaleja.", "Difference = A − B. Green and bold indicate a better value. Sample sizes, minutes and shot choices are neutral.")}</p></div></div>
      <p className="matchup-scroll-hint">{tr("Vieritä taulukkoa sivusuunnassa nähdäksesi kaikki luvut.", "Scroll the table sideways to see all statistics.")}</p>
      <div className="matchup-table-wrap" role="region" aria-label={tr("Vertailutaulukko", "Comparison table")} tabIndex={0}><table className="matchup-table"><caption className="sr-only">{sides[0].name} / {sides[1].name}</caption>
        <thead><tr><th scope="col">{tr("Mittari", "Metric")}</th>{sides.map((side, index) => <th scope="col" key={index}><span>{index ? "B" : "A"}</span>{side.name}</th>)}<th scope="col">{tr("Ero", "Difference")}</th></tr></thead>
        <tbody>{shooting && [["two_pm", "two_pa", "2PM / 2PA"], ["three_pm", "three_pa", "3PM / 3PA"], ["ftm", "fta", "FTM / FTA"]].map(([made, attempted, label]) => <tr key={label}><th scope="row">{label}<small>{tr("osumat / yritykset yhteensä", "total makes / attempts")}</small></th>{sides.map((side, index) => <td key={index}>{side.entry?.shots[made] != null && side.entry.shots[attempted] != null ? <ShotCount made={side.entry.shots[made]!} attempted={side.entry.shots[attempted]!} /> : "—"}</td>)}<td>—</td></tr>)}{metrics.map((metric) => {
          const a = sides[0].entry?.values[metric.key] ?? null, b = sides[1].entry?.values[metric.key] ?? null;
          const decimals = metric.decimals ?? 1;
          const difference = a == null || b == null ? null : Number((a - b).toFixed(decimals));
          const firstBetter = difference == null || difference === 0 || metric.neutral ? null : metric.lower ? difference < 0 : difference > 0;
          return <tr key={metric.key}><th scope="row">{metric.label}{metric.unit && metric.unit !== "%" && <small>{metric.unit}</small>}{metric.lower && <small>{tr("pienempi on parempi", "lower is better")}</small>}</th>{[a, b].map((value, index) => {
            const better = firstBetter == null ? null : index === 0 ? firstBetter : !firstBetter;
            const display = `${format(value, decimals)}${value != null && metric.unit === "%" ? "%" : ""}`;
            return <td key={index} className={better == null ? "" : better ? "matchup-better" : "matchup-weaker"}>{better ? <strong>{display}</strong> : display}{better && <span className="sr-only"> · {tr("parempi arvo", "better value")}</span>}</td>;
          })}<td className="matchup-difference">{difference == null ? "—" : `${difference > 0 ? "+" : ""}${format(difference, decimals)}${metric.unit === "%" ? ` ${tr("%-yks.", "pp")}` : ""}`}</td></tr>;
        })}</tbody></table></div>
    </section>
  </>;
}

export function MatchupLab({ initialPlayerA, initialPlayerB }: { initialPlayerA?: string; initialPlayerB?: string } = {}) {
  const { leagueId, assetPath, historicalSummaries, seasonId, current, loading: currentLoading, loadMatchesForSeason, refreshCurrent } = useSeason();
  const supportsOnOff = seasonId === "2025-26" || leagueId === "korisliiga" && seasonId === "2024-25";
  const { tr, language } = useI18n();
  const [kind, setKind] = useState<ComparisonKind>(initialPlayerA || initialPlayerB ? "players" : "teams");
  const [mode, setMode] = useState<Mode>("entities");
  const [basis, setBasis] = useState<"game" | "40">("game");
  const [shooting, setShooting] = useState(false);
  const [firstId, setFirstId] = useState(initialPlayerA ?? "");
  const [secondId, setSecondId] = useState(initialPlayerB ?? "");
  const [playerId, setPlayerId] = useState("");
  const [firstSeason, setFirstSeason] = useState<SeasonId | "earlier">(seasonId === "2026-27" ? "2025-26" : "2024-25");
  const [secondSeason, setSecondSeason] = useState<SeasonId>(seasonId === "2026-27" ? "2026-27" : "2025-26");
  const [records, setRecords] = useState<Partial<Record<SeasonId, SeasonMatchRecord[]>> | null>(null);
  const [playoffs, setPlayoffs] = useState<SeasonMatchRecord[] | null>(null);
  const [playoffStatus, setPlayoffStatus] = useState<"loading" | "ready" | "error">("loading");
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [onoff, setOnoff] = useState<OnOffData | null>(null);
  const [onoffStatus, setOnoffStatus] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    let cancelled = false;
    setFailed(false); setRecords(null);
    void Promise.all([loadMatchesForSeason("2024-25"), loadMatchesForSeason("2025-26")]).then(([older, regular]) => { if (!cancelled) setRecords({ "2024-25": older, "2025-26": regular }); }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [loadMatchesForSeason, retry]);
  useEffect(() => {
    if (mode !== "phase" || seasonId === "2026-27") return;
    let cancelled = false;
    setPlayoffStatus("loading"); setPlayoffs(null);
    void loadMatchesForSeason(seasonId, "playoffs").then((rows) => { if (!cancelled) { setPlayoffs(rows); setPlayoffStatus("ready"); } }).catch(() => { if (!cancelled) setPlayoffStatus("error"); });
    return () => { cancelled = true; };
  }, [mode, seasonId, loadMatchesForSeason, retry]);
  useEffect(() => {
    if (mode !== "onoff" || !supportsOnOff) return;
    const controller = new AbortController();
    setOnoffStatus("loading"); setOnoff(null);
    void fetch(assetPath(`onoff-${seasonId}.json`), { signal: controller.signal }).then(async (response) => { if (!response.ok) throw new Error("On/off unavailable"); return parseOnOff(await response.json(), seasonId); }).then((data) => { if (!controller.signal.aborted) { setOnoff(data); setOnoffStatus("ready"); } }).catch(() => { if (!controller.signal.aborted) setOnoffStatus("error"); });
    return () => controller.abort();
  }, [mode, seasonId, supportsOnOff, retry, assetPath]);

  const historical = Object.values(records ?? {}).flat();
  const matches = seasonId !== "2026-27" ? records?.[seasonId] ?? [] : current?.matches ?? [];
  const forSeason = (season: SeasonId) => season !== "2026-27" ? records?.[season] ?? [] : current?.matches ?? [];
  const firstRecords = mode === "seasons" ? firstSeason === "earlier" ? seasons.filter((season) => season < secondSeason).flatMap(forSeason) : forSeason(firstSeason) : matches;
  const secondRecords = mode === "seasons" ? forSeason(secondSeason) : matches;
  const catalog = useMemo(() => buildComparisonEntries([...Object.values(records ?? {}).flat(), ...(current?.matches ?? [])], kind, basis), [records, current, kind, basis]);
  const aEntries = buildComparisonEntries(firstRecords, kind, basis), bEntries = buildComparisonEntries(secondRecords, kind, basis);
  const optionsA = aEntries.length ? aEntries : catalog, optionsB = bEntries.length ? bEntries : catalog;
  const first = optionsA.find((entry) => entry.id === firstId) ?? optionsA[0];
  const second = optionsB.find((entry) => entry.id === secondId && (mode !== "entities" || entry.id !== first?.id)) ?? optionsB.find((entry) => mode !== "entities" || entry.id !== first?.id);
  useEffect(() => {
    if (initialPlayerA || initialPlayerB) {
      setKind("players");
      setMode("entities");
      setFirstId(initialPlayerA ?? "");
      setSecondId(initialPlayerB ?? "");
    }
  }, [initialPlayerA, initialPlayerB]);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (kind === "players" && mode === "entities" && first?.id && second?.id) {
      url.searchParams.set("playerA", first.id);
      url.searchParams.set("playerB", second.id);
    } else if (kind === "teams") {
      url.searchParams.delete("playerA");
      url.searchParams.delete("playerB");
    }
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== nextUrl) {
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  }, [first?.id, kind, mode, second?.id]);
  const teamPlayers = new Map<string, string>();
  for (const record of firstRecords.length ? firstRecords : historical) for (const team of record.teams) if (team.source_id === first?.id) for (const player of team.players) if (player.minutes != null && player.minutes > 0) teamPlayers.set(player.source_player_id, playerDisplayName(player.display_name));
  const playerOptions = [...teamPlayers].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "fi"));
  const player = playerOptions.find((entry) => entry.id === playerId) ?? playerOptions[0];
  const selectedTeamGames = first ? entityGames(matches, "teams", first.id).length : 0;
  const onoffRow = first && player ? onoff?.players.find((entry) => entry.id === player.id && entry.team_id === first.id) : undefined;
  const verifiedMatchIds = new Set(onoff?.match_ids ?? []);
  const verifiedTeamGames = first ? matches.filter((record) => verifiedMatchIds.has(record.game.source_id) && record.teams.some((team) => team.source_id === first.id)).length : 0;
  const excludedTeamGames = Math.max(0, selectedTeamGames - verifiedTeamGames);
  const entryFor = (selected: SeasonMatchRecord[], id: string) => buildComparisonEntries(selected, kind, basis).find((entry) => entry.id === id);
  const detail = (entry?: ComparisonEntry) => entry ? `${entry.games} ${tr("ottelua", "games")}${kind === "players" ? ` · ${entry.team} · ${Math.round(entry.minutes)} min` : ` · ${entry.values.wins ?? "—"} W / ${entry.values.losses ?? "—"} L`}` : tr("0 tilastoitua ottelua", "0 recorded games");
  const side = (entry: ComparisonEntry | undefined, name: string): Side => ({ entry, name, detail: detail(entry) });
  let sides: [Side, Side] = [side(aEntries.find((entry) => entry.id === first?.id), first?.name ?? "A"), side(bEntries.find((entry) => entry.id === second?.id), second?.name ?? "B")];
  let note = tr("Valitun kauden runkosarja. Luvut kuvaavat suorituksia, eivät ennusta keskinäisen ottelun voittajaa.", "Selected regular season. Statistics describe performance; they do not predict a head-to-head winner.");
  let unavailable = "";
  if (mode === "seasons") {
    const aLabel = firstSeason === "earlier" ? tr("Aiempien kausien yhteistulos", "Combined earlier seasons") : firstSeason.replace("-", "–");
    sides = [side(sides[0].entry, `${first?.name ?? "A"} · ${aLabel}`), side(sides[1].entry, `${second?.name ?? "B"} · ${secondSeason.replace("-", "–")}`)];
    const included = firstSeason === "earlier" ? seasons.filter((season) => season < secondSeason && forSeason(season).length).map((season) => season.replace("-", "–")).join(", ") : "";
    note = tr("Verrataan runkosarja-aineistoja, mukana myös kauden jatkosarjat. Tarkistettuja otteluita", "Comparing regular-season datasets, including continuation rounds. Verified games") + `: ${(["2024-25", "2025-26"] as const).map(season => `${season.replace("-", "–")}: ${historicalSummaries[season].aggregate.games}/${historicalSummaries[season].summary.available_played_games}`).join(" · ")}. ` + tr("Kauden 2026–27 luvut kertyvät tilastoitujen otteluiden myötä.", "The 2026–27 statistics accumulate as games are recorded.") + (firstSeason === "earlier" ? ` ${tr("Aiempaan otokseen sisältyy", "Earlier sample includes")}: ${included || tr("ei tilastoituja kausia", "no recorded seasons")}.` : "");
    if (firstSeason === secondSeason && first?.id === second?.id) note += ` ${tr("Valitsit molemmille puolille saman kauden ja kohteen.", "Both sides use the same season and entity.")}`;
  }
  if (first && mode === "recent") {
    const split = recentSplit(matches, kind, first.id);
    sides = [side(entryFor(split.recent, first.id), `${first.name} · ${tr("Viimeiset 5", "Last 5")}`), side(entryFor(split.earlier, first.id), `${first.name} · ${tr("Aiemmat ottelut", "Earlier games")}`)];
    note = tr("Viisi viimeisintä tilastoitua ottelua verrattuna saman runkosarjan aiempiin otteluihin.", "Five most recent recorded games versus earlier games in the same regular season.") + (kind === "players" ? ` ${tr("Mukana vain ottelut, joissa pelaaja kävi kentällä.", "Only games in which the player took the court are included.")}` : "") + (split.undated ? ` ${split.undated} ${tr("ottelua ilman päivämäärää jätetty pois.", "undated games excluded.")}` : "");
  }
  if (first && mode === "phase") {
    const phaseRecords = seasonId !== "2026-27" ? playoffs ?? [] : [];
    sides = [side(entryFor(matches, first.id), `${first.name} · ${tr("Runkosarja", "Regular season")}`), side(entryFor(phaseRecords, first.id), `${first.name} · ${tr("Pudotuspelit", "Playoffs")}`)];
    note = tr("Pelaajan runkosarja ja pudotuspelit erikseen. Eri vastustajat ja pieni pudotuspeliotos vaikuttavat vertailuun.", "Player's regular season and playoffs separately. Different opponents and a small playoff sample affect the comparison.");
  }
  const appearance = first && player && mode === "appearance" ? appearanceSplit(matches, first.id, player.id) : null;
  if (first && player && appearance) {
    const knownGames = appearance.played.length + appearance.absent.length;
    const teamLabel = (played: boolean) => `${first.name} · ${player.name} ${played ? tr("pelasi ottelussa", "played") : tr("ei pelannut ottelussa", "did not play")}`;
    sides = [
      { entry: entryFor(appearance.played, first.id), name: teamLabel(true), detail: `${appearance.played.length}/${selectedTeamGames} ${tr("joukkueen ottelua", "team games")}` },
      { entry: entryFor(appearance.absent, first.id), name: teamLabel(false), detail: `${appearance.absent.length}/${selectedTeamGames} ${tr("joukkueen ottelua", "team games")}`,
        emptyMessage: appearance.absent.length === 0
          ? tr(`${player.name} pelasi kaikissa ${appearance.played.length} tilastoidussa ottelussa. Tässä vertailussa lasketaan kokonaisia otteluita, joten poissaolo-otosta ei ole.`, `${player.name} appeared in all ${appearance.played.length} recorded games. This comparison counts whole games, so there is no absence sample.`)
          : tr("Tälle puolelle ei ole tilastoituja otteluita.", "No games are recorded for this side.") },
    ];
    const playedRecord = entryFor(appearance.played, first.id);
    const absentRecord = entryFor(appearance.absent, first.id);
    for (const [index, record] of [playedRecord, absentRecord].entries()) {
      if (record) sides[index].detail += ` · ${record.values.wins ?? "—"} W / ${record.values.losses ?? "—"} L`;
    }
    note = `${player.name}: ${tr("vertaillaan kokonaisia joukkueen otteluita, joissa pelaaja pelasi vähintään yhden minuutin, niihin otteluihin joissa hän ei pelannut lainkaan. Tämä ei ole kentällä–penkillä-vertailu eikä osoita pelaajan vaikutusta: vastustajat ja kokoonpanot vaihtelevat.", "compares full team games in which the player logged playing time with games in which they did not play at all. This is not an on/off comparison and does not establish player impact: opponents and lineups vary.")} ${tr("Pelasi", "Played")}: ${appearance.played.length}/${selectedTeamGames}, ${tr("ei pelannut", "did not play")}: ${appearance.absent.length}/${selectedTeamGames}.` + (appearance.unknown ? ` ${appearance.unknown} ${tr("ottelua jätetty pois epäselvän osallistumisen vuoksi.", "games excluded due to unknown participation.")}` : "");
    if (appearance.absent.length === 0) note += ` ${tr("Penkkiminuutteja voi tarkastella valitsemalla kentällä / penkillä -vertailun.", "Use the on/off comparison to inspect minutes spent on the bench.")}`;
  }
  if (mode === "onoff") {
    if (!supportsOnOff) unavailable = tr("Tälle kaudelle ei ole vielä tarkistettua kentällä–penkillä-dataa.", "Verified on/off data is not yet available for this season.");
    sides = ["on", "off"].map((key) => {
      const state = onoffRow?.[key as "on" | "off"];
      const entry = state && state.seconds > 0 ? { id: first?.id ?? "", name: first?.name ?? "", team: first?.name ?? "", games: onoffRow!.games, minutes: state.seconds / 60, shots: state.own, values: comparisonValues(state.own, state.seconds / 2400, state.opponent) } : undefined;
      const totalMinutes = state && onoffRow ? state.seconds / 60 : null;
      const perGame = totalMinutes != null && onoffRow!.games > 0 ? totalMinutes / onoffRow!.games : null;
      const number = (value: number) => value.toLocaleString(language === "fi" ? "fi-FI" : "en-GB", { maximumFractionDigits: 1 });
      const score = state ? `${state.own.points}–${state.opponent.points} ${tr("pistettä", "points")}` : "";
      return { entry, name: `${first?.name ?? ""} · ${player?.name ?? ""} ${key === "on" ? tr("kentällä", "on court") : tr("penkillä", "on bench")}`,
        detail: entry ? `${number(totalMinutes!)} ${tr("min yhteensä", "min total")} · ${number(perGame!)} ${tr("min / ottelu", "min / game")} · ${onoffRow!.games}/${selectedTeamGames} · ${score}` : `0/${selectedTeamGames} ${tr("joukkueen ottelua tarkistettu", "team games verified")}`,
        emptyMessage: tr("Näistä otteluista ei ole riittävästi tarkistettua pelitapahtuma- ja kokoonpanodataa.", "There is not enough verified play-by-play and lineup data for this selection.") };
    }) as [Side, Side];
    const coverage = supportsOnOff
      ? `${tr("Käytettävissä oleva on/off-data kattaa", "Available on/off data covers")} ${verifiedTeamGames}/${selectedTeamGames} ${tr("joukkueen ottelua", "team games")} (${onoff ? `${onoff.verified_games}/${onoff.expected_games} ${tr("koko sarjassa", "league-wide")}` : ""}). ${excludedTeamGames} ${tr("muuta ottelua jäi pois, koska pelitapahtuma- tai kokoonpanotiedot eivät läpäisseet tarkistusta.", "other games were excluded because play-by-play or lineup data did not pass validation.")} ${tr("Tämä on datan kattavuus, ei otteluiden määrä, joissa pelaaja istui koko pelin penkillä.", "This is data coverage, not a count of games the player spent entirely on the bench.")}`
      : tr("Tälle kaudelle ei ole vielä tarkistettua on/off-dataa.", "Verified on/off data is not yet available for this season.");
    const method = onoff?.methodology;
    const methodNote = method
      ? `${tr("Kenttäjaksot lasketaan vaihtotapahtumista. Sallittu ero box scoren peliaikaan on", "Stints are reconstructed from substitutions. Allowed difference from box-score playing time is")} ${method.playing_time_tolerance_seconds} s ${tr("pelaajaa ja ottelua kohti. Samalla pelikellon ajalla kirjattu tapahtuma kohdistetaan aiempaan kentälliseen vain, jos se on yksiselitteinen. Epäselvät lisätilastot näkyvät puuttuvina (—). Pisteet ja plus/miinukset tarkistetaan edelleen.", "per player per game. Same-clock events are assigned to an earlier lineup only when unambiguous. Unresolved auxiliary statistics are shown as missing (—). Scores and plus/minus are still checked.")}`
      : "";
    note = `${player?.name ?? ""}: ${tr("joukkueen luvut pelaajan ollessa kentällä tai penkillä. Määrät normalisoidaan 40 minuuttiin kyseistä jaksoa, tehokkuus 100 arvioituun pallonhallintaan. Luvut ovat kuvailevia, eivät osoitus pelaajan vaikutuksesta.", "team statistics while the player is on court or on the bench. Counts are normalized per 40 minutes in that state, ratings per 100 estimated possessions. These are descriptive, not proof of player impact.")} ${coverage} ${methodNote}`;
  }
  const unit = mode === "onoff" || kind === "players" && basis === "40" ? tr("per 40 min", "per 40 min") : tr("per ottelu", "per game");
  const sampleMetrics: Metric[] = mode === "onoff" ? [] : [{ key: "games", label: tr("Ottelut", "Games"), decimals: 0, neutral: true }, { key: "wins", label: "W", decimals: 0, neutral: true }, { key: "losses", label: "L", decimals: 0, neutral: true }];
  const metrics: Metric[] = shooting ? [
    { key: "twoPct", label: "2P%", unit: "%" }, { key: "threePct", label: "3P%", unit: "%" }, { key: "fg", label: "FG%", unit: "%" }, { key: "efg", label: "eFG%", unit: "%" }, { key: "ft", label: "FT%", unit: "%" },
    { key: "threeShare", label: tr("Kolmosten osuus", "Three-point attempt share"), unit: "%", neutral: true }, { key: "ftRate", label: "FTA / FGA", decimals: 2, neutral: true },
  ] : [...sampleMetrics,
    ...[["points", tr("Pisteet", "Points")], ["rebounds", tr("Levypallot", "Rebounds")], ["assists", tr("Syötöt", "Assists")], ["steals", tr("Riistot", "Steals")], ["blocks", tr("Torjunnat", "Blocks")]].map(([key, label]) => ({ key, label, unit })),
    { key: "turnovers", label: tr("Menetykset", "Turnovers"), unit, lower: true }, { key: "astTo", label: "AST/TO", decimals: 2 }, { key: "fg", label: "FG%", unit: "%" }, { key: "efg", label: "eFG%", unit: "%" }, { key: "ft", label: "FT%", unit: "%" },
    ...(kind === "teams" ? [{ key: "ortg", label: "ORtg" }, { key: "drtg", label: "DRtg", lower: true }, { key: "net", label: "Net Rating" }] : [{ key: "minutes", label: tr("Peliaika", "Playing time"), unit: tr("min / ottelu", "min / game"), neutral: true }]),
  ];
  const changeKind = (next: ComparisonKind) => { setKind(next); setFirstId(""); setSecondId(""); setPlayerId(""); if (next === "teams" && mode === "phase" || next === "players" && (mode === "onoff" || mode === "appearance")) setMode("entities"); };
  const modeOptions = [{ id: "entities", name: kind === "teams" ? tr("Joukkue vs joukkue", "Team vs team") : tr("Pelaaja vs pelaaja", "Player vs player") }, { id: "seasons", name: tr("Kausien vertailu", "Across seasons") }, { id: "recent", name: tr("Viimeiset 5 vs aiemmat", "Last 5 vs earlier") }, ...(kind === "players" ? [{ id: "phase", name: tr("Runkosarja vs pudotuspelit", "Regular season vs playoffs") }] : [{ id: "appearance", name: tr("Kokonaiset ottelut: pelasi / poissa", "Whole games: played / absent") }, { id: "onoff", name: tr("Pelaaja kentällä / penkillä", "Player on / off court") }])];
  const seasonOptions = seasons.map((season) => ({ id: season, name: season.replace("-", "–") }));
  const needCurrent = mode === "seasons" ? firstSeason === "2026-27" || secondSeason === "2026-27" : seasonId === "2026-27";
  const loading = !records && !failed || needCurrent && !current && currentLoading || mode === "onoff" && supportsOnOff && onoffStatus === "loading" || mode === "phase" && seasonId !== "2026-27" && playoffStatus === "loading";
  const error = failed || needCurrent && !current && !currentLoading || mode === "onoff" && supportsOnOff && onoffStatus === "error" || mode === "phase" && seasonId !== "2026-27" && playoffStatus === "error";
  return <div className="matchup-lab">
    <div className="matchup-toolbar"><div className="profile-phase-toggle" role="group" aria-label={tr("Vertailun tyyppi", "Comparison type")}><button type="button" aria-pressed={kind === "teams"} onClick={() => changeKind("teams")}><Icon name="teams" size={17} />{tr("Joukkueet", "Teams")}</button><button type="button" aria-pressed={kind === "players"} onClick={() => changeKind("players")}><Icon name="players" size={17} />{tr("Pelaajat", "Players")}</button></div><Select label={tr("Vertailutapa", "Compare")} value={mode} options={modeOptions} onChange={(value) => setMode(value as Mode)} /></div>
    <div className="matchup-controls">
      {mode === "seasons" && <><Select label={tr("Kausi A", "Season A")} value={firstSeason} options={[{ id: "earlier", name: tr("Kaikki saatavilla olevat aiemmat kaudet", "All available earlier seasons") }, ...seasonOptions]} onChange={(value) => setFirstSeason(value as SeasonId | "earlier")} /><Select label={tr("Kausi B", "Season B")} value={secondSeason} options={seasonOptions} onChange={(value) => setSecondSeason(value as SeasonId)} /></>}
      <Select label={`${kind === "teams" ? tr("Joukkue", "Team") : tr("Pelaaja", "Player")}${mode === "entities" || mode === "seasons" ? " A" : ""}`} value={first?.id ?? ""} options={optionsA} onChange={setFirstId} exclude={mode === "entities" ? second?.id : undefined} />
      {(mode === "entities" || mode === "seasons") && <Select label={`${kind === "teams" ? tr("Joukkue", "Team") : tr("Pelaaja", "Player")} B`} value={second?.id ?? ""} options={optionsB} onChange={setSecondId} exclude={mode === "entities" ? first?.id : undefined} />}
      {(mode === "onoff" || mode === "appearance") && <Select label={tr("Pelaaja", "Player")} value={player?.id ?? ""} options={playerOptions} onChange={setPlayerId} />}
    </div>
    <div className="matchup-toolbar"><div className="profile-phase-toggle" role="group" aria-label={tr("Mittarit", "Metrics")}><button type="button" aria-pressed={!shooting} onClick={() => setShooting(false)}>{tr("Perusluvut", "Overview")}</button><button type="button" aria-pressed={shooting} onClick={() => setShooting(true)}>{tr("Heittoprofiili", "Shot profile")}</button></div>{kind === "players" && <Select label={tr("Näytä luvut", "Show statistics")} value={basis} options={[{ id: "game", name: tr("Per ottelu", "Per game") }, { id: "40", name: tr("Per 40 minuuttia", "Per 40 minutes") }]} onChange={(value) => setBasis(value as "game" | "40")} />}</div>
    <p className="players-method-note">{note}</p>
    {appearance && appearance.absent.length === 0 && <button className="outline-button matchup-mode-suggestion" type="button" onClick={() => setMode("onoff")}>{tr("Katso penkkiminuutit ja joukkueen luvut niiden aikana", "See bench minutes and team performance during them")} <Icon name="arrowOutward" size={14} /></button>}
    {loading || error || unavailable ? <div className="panel match-list-empty" role={error ? "alert" : "status"}>{error ? <><p>{tr("Vertailun lataus epäonnistui.", "Could not load comparison.")}</p><button className="outline-button" onClick={() => { setRetry((value) => value + 1); if (needCurrent && !current) void refreshCurrent(); }}>{tr("Yritä uudelleen", "Try again")}</button></> : unavailable || tr("Ladataan vertailua…", "Loading comparison…")}</div> : <Comparison sides={sides} metrics={metrics} shooting={shooting} />}
    <p className="players-method-note">{tr("Heittoprosentit lasketaan yhteenlasketuista osumista ja yrityksistä. ORtg, DRtg ja Net Rating perustuvat arvioituihin pallonhallintoihin. Viiva tarkoittaa puuttuvaa tai määrittelemätöntä arvoa. Pieni otos voi nostaa lukuja paljon.", "Shooting percentages use total makes and attempts. ORtg, DRtg and Net Rating use estimated possessions. A dash means missing or undefined data. Small samples can produce high values.")}</p>
  </div>;
}
