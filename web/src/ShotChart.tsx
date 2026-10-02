import { useSeason } from "./SeasonContext";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "./i18n";
import { Icon } from "./Icon";
import { ShotCount } from "./ShotCount";
import { playerDisplayName } from "./playerName";
import { filterShots, parseShotChart, shotClock, summarizeShots, type ShotChartData, type ShotFilters } from "./shotStats";

type ShotState = { status: "loading" | "ready" | "missing" | "error"; data: ShotChartData | null };

export function useMatchShots(matchId: string, enabled: boolean): ShotState {
  const { assetPath } = useSeason();
  const [result, setResult] = useState<ShotState & { id: string }>({ id: "", status: "loading", data: null });
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setResult({ id: matchId, status: "loading", data: null });
    void fetch(assetPath(`shots/${encodeURIComponent(matchId)}.json`), { signal: controller.signal, cache: "no-cache" })
      .then(async (response) => {
        if (response.status === 404) {
          if (!controller.signal.aborted) setResult({ id: matchId, status: "missing", data: null });
          return;
        }
        if (!response.ok) throw new Error("Shot chart unavailable");
        const data = parseShotChart(await response.json(), matchId);
        if (!controller.signal.aborted) setResult({ id: matchId, status: "ready", data });
      }).catch(() => {
        if (!controller.signal.aborted) setResult({ id: matchId, status: "error", data: null });
      });
    return () => controller.abort();
  }, [matchId, enabled, assetPath]);
  return result.id === matchId ? result : { status: "loading", data: null };
}

function initialFilters(): ShotFilters {
  const query = new URLSearchParams(window.location.search);
  return { team: query.get("shotTeam") ?? "all", player: query.get("shotPlayer") ?? "all",
    period: query.get("shotPeriod") ?? "all", type: query.get("shotType") ?? "all" };
}

function ShotSymbol({ x = 0, y = 0, made }: { x?: number; y?: number; made: boolean }) {
  if (made) return <circle cx={x} cy={y} r="3.5" />;
  return <path d={`M${x - 3},${y - 3}l6,6m-6,0l6,-6`} />;
}

function CourtLines() {
  return <g className="shot-court-lines" fill="none">
    <rect width="560" height="300" /><path d="M280 0v300" /><circle cx="280" cy="150" r="36" />
    <path d="M0 101h116v98H0M560 101H444v98h116" /><circle cx="116" cy="150" r="36" /><circle cx="444" cy="150" r="36" />
    <path d="M0 18h60a135 135 0 0 1 0 264H0M560 18h-60a135 135 0 0 0 0 264h60" />
    <path d="M31.5 124a26 26 0 0 1 0 52M528.5 124a26 26 0 0 0 0 52" />
    <g className="shot-court-hoops"><path d="M24 132v36M536 132v36" /><circle cx="31.5" cy="150" r="4.5" /><circle cx="528.5" cy="150" r="4.5" /></g>
  </g>;
}

export function ShotChart({ state, matchId }: { state: ShotState; matchId: string }) {
  const { tr, language } = useI18n();
  const [selected, setSelected] = useState<ShotFilters>(initialFilters);
  const [tableOpen, setTableOpen] = useState(false);
  const data = state.data;
  const players = useMemo(() => {
    const rows = new Map<string, { id: string; name: string; team: string }>();
    for (const shot of data?.shots ?? []) {
      if (shot.player_id) rows.set(shot.player_id, { id: shot.player_id,
        name: playerDisplayName(shot.player_name ?? shot.player_id), team: shot.team_id });
    }
    return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name, language));
  }, [data, language]);
  const periods = [...new Set(data?.shots.map((shot) => shot.period) ?? [])].sort((a, b) => a - b);
  const team = data?.teams.some((row) => row.id === selected.team) ? selected.team : "all";
  const playerOptions = players.filter((row) => team === "all" || row.team === team);
  const filters: ShotFilters = { team,
    player: playerOptions.some((row) => row.id === selected.player) ? selected.player : "all",
    period: periods.some((period) => String(period) === selected.period) ? selected.period : "all",
    type: ["2", "3"].includes(selected.type) ? selected.type : "all" };
  const shots = filterShots(data?.shots ?? [], filters);
  const summary = summarizeShots(shots);
  const decimal = (value: number | null) => value === null ? "—" : `${value.toLocaleString(language === "fi" ? "fi-FI" : "en-GB", { maximumFractionDigits: 1 })}%`;
  const periodLabel = (period: number) => period <= 4 ? tr(`${period}. erä`, `Q${period}`)
    : tr(`JA ${period >= 11 ? period - 10 : period - 4}`, `OT${period >= 11 ? period - 10 : period - 4}`);
  const change = (key: keyof ShotFilters, value: string) => {
    const next = { ...filters, [key]: value, ...(key === "team" ? { player: "all" } : {}) };
    setSelected(next);
    const url = new URL(window.location.href);
    for (const [name, setting] of Object.entries(next)) {
      const param = `shot${name[0].toUpperCase()}${name.slice(1)}`;
      if (setting === "all") url.searchParams.delete(param);
      else url.searchParams.set(param, setting);
    }
    window.history.replaceState(null, "", url);
  };
  return (
    <div id="match-court" className="panel court-panel overview-section-anchor">
      <div className="panel-heading panel-heading--plain">
        <div><h3>{tr("Heittokartta", "Shot chart")}</h3><p className="shot-intro">{tr("Mistä heitot otettiin ja mitkä osuivat?", "Where were shots taken, and which went in?")}</p></div>
        <a className="shot-source" href={`https://tulospalvelu.basket.fi/match/${matchId}/shot_chart`} target="_blank" rel="noreferrer">{tr("Alkuperäinen heittokartta", "Original shot chart")} <Icon name="arrowOutward" size={14} /></a>
      </div>
      {state.status === "loading" ? <p className="shot-state" role="status">{tr("Ladataan heittokarttaa…", "Loading shot chart…")}</p>
        : state.status !== "ready" ? <div className="shot-state" role={state.status === "error" ? "alert" : "status"}>
          <strong>{state.status === "error" ? tr("Heittokartan lataus epäonnistui", "Could not load shot chart")
            : tr("Heittodataa ei ole vielä tuotu tähän otteluun", "Shot data has not been imported for this game yet")}</strong>
          <p>{tr("Voit avata lähteen yllä olevasta linkistä.", "You can open the source using the link above.")}</p>
        </div> : <>
          <div className="shot-filters">
            <label>{tr("Joukkue", "Team")}<select value={filters.team} onChange={(event) => change("team", event.target.value)}>
              <option value="all">{tr("Molemmat joukkueet", "Both teams")}</option>
              {data!.teams.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select></label>
            <label>{tr("Pelaaja", "Player")}<select value={filters.player} onChange={(event) => change("player", event.target.value)}>
              <option value="all">{tr("Kaikki pelaajat", "All players")}</option>
              {playerOptions.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select></label>
            <label>{tr("Erä", "Period")}<select value={filters.period} onChange={(event) => change("period", event.target.value)}>
              <option value="all">{tr("Koko ottelu", "Full game")}</option>
              {periods.map((period) => <option key={period} value={period}>{periodLabel(period)}</option>)}
            </select></label>
            <label>{tr("Heitot", "Shots")}<select value={filters.type} onChange={(event) => change("type", event.target.value)}>
              <option value="all">{tr("Kaikki pelitilanneheitot", "All field goals")}</option>
              <option value="2">{tr("Kakkoset", "Two-pointers")}</option><option value="3">{tr("Kolmoset", "Three-pointers")}</option>
            </select></label>
          </div>
          <div className="shot-summary" role="status" aria-live="polite">
            <span><strong><ShotCount made={summary.made} attempted={summary.attempts} /></strong>{tr("osumat / yritykset", "made / attempted")}</span>
            <span><strong>{decimal(summary.pct)}</strong>{filters.type === "3" ? "3P%" : filters.type === "2" ? "2P%" : "FG%"}</span>
          </div>
          <div className="shot-legend" aria-label={tr("Joukkueiden ja heittotulosten selite", "Team and shot outcome legend")}>
            {data!.teams.map((row) => <span className={`shot-team-key shot-team--${row.home ? "home" : "away"}`} key={row.id}>
              <svg viewBox="-6 -6 28 12" aria-hidden="true">
                <g className="shot-mark shot-mark--made"><ShotSymbol made /></g>
                <g className="shot-mark shot-mark--missed"><ShotSymbol x={16} made={false} /></g>
              </svg>
              <span>{row.name} <small>({row.home ? tr("koti", "home") : tr("vieras", "away")})</small></span>
            </span>)}
            <span className="shot-outcome-key">{tr("Täytetty merkki = osuma · Risti = ohi", "Filled symbol = made · Cross = missed")}</span>
          </div>
          <div className="shot-court-wrap">
            <svg className="shot-court" viewBox="-8 -8 576 316" role="img" aria-label={tr(`Heittokartta: ${summary.located} heittopaikkaa, ${summary.made} osumaa ${summary.attempts} yrityksestä. Heittotiedot myös alla olevassa taulukossa.`, `Shot chart: ${summary.located} locations, ${summary.made} made of ${summary.attempts} attempts. Shot data is also in the table below.`)}>
              <CourtLines />
              {shots.filter((shot) => shot.x !== null && shot.y !== null).map((shot) => {
                const x = shot.x! * 5.6, y = shot.y! * 3;
                const shotTeam = data!.teams.find((row) => row.id === shot.team_id)!;
                return <g key={shot.id} className={`shot-mark shot-team--${shotTeam.home ? "home" : "away"} shot-mark--${shot.made ? "made" : "missed"}`}>
                  <title>{`${shotTeam.name} · ${shot.player_name ? playerDisplayName(shot.player_name) : tr("Pelaaja puuttuu", "Unknown player")} · ${periodLabel(shot.period)} ${shotClock(shot.clock)} · ${shot.points}P · ${shot.made ? tr("osuma", "made") : tr("ohi", "missed")}`}</title>
                  <ShotSymbol x={x} y={y} made={shot.made} />
                </g>;
              })}
            </svg>
            {summary.attempts === 0 && <p className="shot-no-results">{tr("Ei heittoja näillä suodattimilla.", "No shots match these filters.")}</p>}
          </div>
          <p className="shot-method-note">{tr("Vain pelitilanneheitot; vapaaheitot eivät sisälly karttaan. Heittopaikat näytetään lähteen kenttäsuunnassa. Joukkueet vaihtavat hyökkäyspäätyä tauolla, joten sama joukkue voi näkyä molemmissa päädyissä.", "Field goals only; free throws are excluded. Locations use the source's court orientation. Teams switch ends at halftime, so the same team can appear at both ends.")}
            {summary.located < summary.attempts && ` ${tr(`${summary.attempts - summary.located} heitosta puuttuu sijainti; ne sisältyvät lukuihin.`, `${summary.attempts - summary.located} shots have no location; they remain included in the totals.`)}`}
          </p>
          {!data!.box_score_matches && <p className="shot-coverage-note">{tr("Heittolokin määrät poikkeavat box scoresta. Kartan luvut kuvaavat saatua heittolokia.", "Shot-log totals differ from the box score. Chart statistics describe the available shot log.")}</p>}
          <details className="shot-table-details" onToggle={(event) => setTableOpen(event.currentTarget.open)}>
            <summary>{tr("Näytä heitot taulukkona", "Show shots as a table")} ({summary.attempts})</summary>
            {tableOpen && <div className="box-score-table-wrap"><table className="box-score-table shot-table">
              <caption className="sr-only">{tr("Suodatetut pelitilanneheitot", "Filtered field-goal attempts")}</caption>
              <thead><tr>{[tr("Pelaaja", "Player"), tr("Joukkue", "Team"), tr("Erä", "Period"), tr("Kello", "Clock"), tr("Heitto", "Shot"), tr("Tulos", "Result")].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
              <tbody>{shots.map((shot) => <tr key={shot.id}><th scope="row">{shot.player_name ? playerDisplayName(shot.player_name) : "—"}</th><td>{data!.teams.find((row) => row.id === shot.team_id)?.name}</td><td>{periodLabel(shot.period)}</td><td>{shotClock(shot.clock)}</td><td>{shot.points}P</td><td>{shot.made ? tr("Osuma", "Made") : tr("Ohi", "Missed")}</td></tr>)}</tbody>
            </table></div>}
          </details>
        </>}
    </div>
  );
}

export type PlayerShot = { x: number | null; y: number | null; points: 2 | 3; made: boolean };
export type PlayerShotIndex = {
  schema_version: "0.1";
  season_id: string;
  expected_games: number;
  games_with_data: number;
  box_score_matches: boolean;
  players: { id: string; name: string | null; shots: PlayerShot[] }[];
};
type PlayerShotState = { seasonId: string; status: "loading" | "ready" | "missing" | "error"; data: PlayerShotIndex | null };

export function parsePlayerShotIndex(value: unknown, seasonId: string): PlayerShotIndex {
  const data = value as PlayerShotIndex | null;
  if (!data || data.schema_version !== "0.1" || data.season_id !== seasonId || !Array.isArray(data.players) ||
      !Number.isInteger(data.expected_games) || !Number.isInteger(data.games_with_data) || typeof data.box_score_matches !== "boolean") {
    throw new Error("Invalid player shot index");
  }
  for (const player of data.players) {
    if (!player || typeof player.id !== "string" || !Array.isArray(player.shots)) throw new Error("Invalid player shot row");
    for (const shot of player.shots) {
      if (!shot || (shot.points !== 2 && shot.points !== 3) || typeof shot.made !== "boolean" ||
          [shot.x, shot.y].some((coordinate) => coordinate !== null &&
            (typeof coordinate !== "number" || !Number.isFinite(coordinate) || coordinate < 0 || coordinate > 100))) {
        throw new Error("Invalid player shot record");
      }
    }
  }
  return data;
}

export function PlayerShotChart({ playerId, playerName, seasonId }: { playerId: string; playerName: string; seasonId: string }) {
  const { assetPath } = useSeason();
  const { tr, language } = useI18n();
  const [state, setState] = useState<PlayerShotState>({ seasonId: "", status: "loading", data: null });
  const [shotType, setShotType] = useState<"all" | "2" | "3">("all");

  useEffect(() => {
    const controller = new AbortController();
    setState({ seasonId, status: "loading", data: null });
    void fetch(assetPath(`player-shots-${encodeURIComponent(seasonId)}.json`), { signal: controller.signal, cache: "no-cache" })
      .then(async (response) => {
        if (response.status === 404) {
          if (!controller.signal.aborted) setState({ seasonId, status: "missing", data: null });
          return;
        }
        if (!response.ok) throw new Error("Player shot chart unavailable");
        const data = parsePlayerShotIndex(await response.json(), seasonId);
        if (!controller.signal.aborted) setState({ seasonId, status: "ready", data });
      }).catch(() => {
        if (!controller.signal.aborted) setState({ seasonId, status: "error", data: null });
      });
    return () => controller.abort();
  }, [seasonId, assetPath]);

  const data = state.seasonId === seasonId ? state.data : null;
  const player = data?.players.find((row) => row.id === playerId);
  const shots = (player?.shots ?? []).filter((shot) => shotType === "all" || String(shot.points) === shotType);
  const made = shots.filter((shot) => shot.made).length;
  const located = shots.filter((shot) => shot.x !== null && shot.y !== null).length;
  const pct = shots.length ? 100 * made / shots.length : null;
  const percent = pct === null ? "—" : `${pct.toLocaleString(language === "fi" ? "fi-FI" : "en-GB", { maximumFractionDigits: 1 })}%`;

  return <section className="panel court-panel profile-shot-panel">
    <div className="panel-heading panel-heading--plain">
      <div><h2>{tr("Pelaajan heittokartta", "Player shot chart")}</h2><p className="shot-intro">{tr("Pelitilanneheitot koko kaudelta.", "Field-goal attempts across the season.")}</p></div>
      <label className="player-shot-filter"><span>{tr("Heitot", "Shots")}</span><select value={shotType} onChange={(event) => setShotType(event.target.value as "all" | "2" | "3")}>
        <option value="all">{tr("Kaikki", "All")}</option><option value="2">{tr("Kakkoset", "Two-pointers")}</option><option value="3">{tr("Kolmoset", "Three-pointers")}</option>
      </select></label>
    </div>
    {state.seasonId !== seasonId || state.status === "loading" ? <p className="shot-state profile-shot-state" role="status">{tr("Ladataan pelaajan heittokarttaa…", "Loading player shot chart…")}</p>
      : state.status !== "ready" ? <div className="shot-state profile-shot-state" role={state.status === "error" ? "alert" : "status"}>
        <strong>{state.status === "error" ? tr("Heittokartan lataus epäonnistui", "Could not load the shot chart") : tr("Tälle kaudelle ei ole vielä julkaistua pelaajien heittodataa.", "Player shot data has not been published for this season yet.")}</strong>
      </div>
      : !player || shots.length === 0 ? <p className="shot-state profile-shot-state" role="status">{player ? tr("Ei heittoja valitulla suodatuksella.", "No shots match this filter.") : tr("Pelaajalle ei ole kirjattu pelitilanneheittoja tällä kaudella.", "No field-goal attempts are recorded for this player this season.")}</p>
      : <>
        <div className="shot-summary" role="status" aria-live="polite">
          <span><strong><ShotCount made={made} attempted={shots.length} /></strong>{tr("osumat / yritykset", "made / attempted")}</span>
          <span><strong>{percent}</strong>{shotType === "3" ? "3P%" : shotType === "2" ? "2P%" : "FG%"}</span>
        </div>
        <div className="shot-legend profile-shot-legend">
          <span className="player-shot-key player-shot-key--made"><svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="3.5" /></svg>{tr("Osuma", "Made")}</span>
          <span className="player-shot-key player-shot-key--missed"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="m3 3 6 6m-6 0 6-6" /></svg>{tr("Ohi", "Missed")}</span>
        </div>
        <div className="shot-court-wrap">
          <svg className="shot-court" viewBox="-8 -8 576 316" role="img" aria-label={tr(`${playerName}: ${made} osumaa ${shots.length} heitosta (${percent}).`, `${playerName}: ${made} made of ${shots.length} shots (${percent}).`)}>
            <CourtLines />
            {shots.filter((shot) => shot.x !== null && shot.y !== null).map((shot, index) => {
              const x = shot.x! * 5.6, y = shot.y! * 3;
              return <g key={`${playerId}-${index}`} className={`shot-mark shot-mark--${shot.made ? "made" : "missed"} player-shot-result--${shot.made ? "made" : "missed"}`}>
                <title>{`${shot.points}P · ${shot.made ? tr("osuma", "made") : tr("ohi", "missed")}`}</title>
                <ShotSymbol x={x} y={y} made={shot.made} />
              </g>;
            })}
          </svg>
        </div>
        <p className="shot-method-note">{tr(`${data!.games_with_data}/${data!.expected_games} ottelun heittodata. Vapaaheitot eivät sisälly. Sama pelaaja näkyy molemmissa päädyissä, koska joukkueet vaihtavat hyökkäyssuuntaa tauolla.`, `Shot data from ${data!.games_with_data}/${data!.expected_games} games. Free throws are excluded. The player appears at both ends because teams switch direction at halftime.`)}
          {!data!.box_score_matches && ` ${tr("Heittoloki ei täsmää kaikkien otteluiden box scoreen.", "Shot logs do not match the box scores for every game.")}`}
          {located < shots.length && ` ${tr(`${shots.length - located} heitosta puuttuu sijainti; ne sisältyvät lukuihin.`, `${shots.length - located} shots have no location; they remain included in the totals.`)}`}
        </p>
      </>}
  </section>;
}
