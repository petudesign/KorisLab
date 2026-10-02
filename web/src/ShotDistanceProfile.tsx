import { useEffect, useMemo, useState } from "react";
import { useI18n } from "./i18n";
import { parsePlayerShotIndex, type PlayerShotIndex } from "./ShotChart";
import { playerDisplayName } from "./playerName";
import { summarizeShotDistances } from "./shotStats";

type ShotDistanceState = {
  seasonId: string;
  status: "loading" | "ready" | "missing" | "error";
  data: PlayerShotIndex | null;
};

export function SeasonShotDistance({ seasonId }: { seasonId: string }) {
  const { tr, language } = useI18n();
  const [state, setState] = useState<ShotDistanceState>({ seasonId: "", status: "loading", data: null });
  const [selectedPlayer, setSelectedPlayer] = useState("all");
  const [shotType, setShotType] = useState<"all" | "2" | "3">("all");

  useEffect(() => {
    const controller = new AbortController();
    setState({ seasonId, status: "loading", data: null });
    setSelectedPlayer("all");
    setShotType("all");
    void fetch(`/player-shots-${encodeURIComponent(seasonId)}.json`, { signal: controller.signal, cache: "no-cache" })
      .then(async (response) => {
        if (response.status === 404) {
          if (!controller.signal.aborted) setState({ seasonId, status: "missing", data: null });
          return;
        }
        if (!response.ok) throw new Error("Shot distance data unavailable");
        const data = parsePlayerShotIndex(await response.json(), seasonId);
        if (!controller.signal.aborted) setState({ seasonId, status: "ready", data });
      }).catch(() => {
        if (!controller.signal.aborted) setState({ seasonId, status: "error", data: null });
      });
    return () => controller.abort();
  }, [seasonId]);

  const data = state.seasonId === seasonId ? state.data : null;
  const players = useMemo(() => (data?.players ?? []).map((player) => ({
    id: player.id,
    name: playerDisplayName(player.name ?? player.id),
  })).sort((a, b) => a.name.localeCompare(b.name, language)), [data, language]);
  const validPlayer = players.some((player) => player.id === selectedPlayer) ? selectedPlayer : "all";
  const shots = useMemo(() => (data?.players ?? [])
    .filter((player) => validPlayer === "all" || player.id === validPlayer)
    .flatMap((player) => player.shots)
    .filter((shot) => shotType === "all" || String(shot.points) === shotType), [data, validPlayer, shotType]);
  const summary = useMemo(() => summarizeShotDistances(shots), [shots]);
  const maxAttempts = Math.max(1, ...summary.bins.map((bin) => bin.attempts));
  const percent = (value: number | null) => value === null ? "—" : `${value.toLocaleString(language === "fi" ? "fi-FI" : "en-GB", { maximumFractionDigits: 1 })}%`;

  return <section className="panel season-shot-distance" aria-labelledby="season-shot-distance-title">
    <div className="panel-heading panel-heading--plain">
      <div>
        <h3 id="season-shot-distance-title">{tr("Heitot etäisyyden mukaan", "Shots by distance")}</h3>
        <p className="shot-intro">{tr("Mistä joukkueet heittävät ja miten tarkkuus muuttuu etäisyyden kasvaessa?", "Where do teams shoot from, and how does accuracy change with distance?")}</p>
      </div>
      {state.status === "ready" && <div className="shot-distance-filters">
        <label className="player-shot-filter">
          <span>{tr("Pelaaja", "Player")}</span>
          <select value={validPlayer} onChange={(event) => setSelectedPlayer(event.target.value)}>
            <option value="all">{tr("Kaikki pelaajat", "All players")}</option>
            {players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
          </select>
        </label>
        <label className="player-shot-filter">
          <span>{tr("Heitot", "Shots")}</span>
          <select value={shotType} onChange={(event) => setShotType(event.target.value as "all" | "2" | "3")}>
            <option value="all">{tr("Kaikki", "All")}</option>
            <option value="2">{tr("Kakkoset", "Two-pointers")}</option>
            <option value="3">{tr("Kolmoset", "Three-pointers")}</option>
          </select>
        </label>
      </div>}
    </div>

    {state.seasonId !== seasonId || state.status === "loading" ? <p className="shot-state profile-shot-state" role="status">{tr("Ladataan heittomatkaa…", "Loading shot distances…")}</p>
      : state.status === "error" ? <p className="shot-state profile-shot-state" role="alert">{tr("Heittomatkan aineiston lataus epäonnistui.", "Could not load shot distance data.")}</p>
        : state.status === "missing" ? <p className="shot-state profile-shot-state" role="status">{tr("Tälle kaudelle ei ole vielä julkaistu heittopaikkoja. Etäisyysvertailu on saatavilla kaudelta 2025–26.", "Shot locations have not been published for this season yet. Distance analysis is available for 2025–26.")}</p>
          : <>
            <div className="shot-distance-legend" aria-label={tr("Kaavion selite", "Chart legend")}>
              <span><i className="shot-distance-swatch shot-distance-swatch--made" aria-hidden="true" />{tr("Osumat", "Made")}</span>
              <span><i className="shot-distance-swatch shot-distance-swatch--missed" aria-hidden="true" />{tr("Ohi", "Missed")}</span>
              <span>{tr("Palkin kokonaispituus = yritykset", "Total bar length = attempts")}</span>
            </div>
            {summary.located === 0 ? <p className="shot-state profile-shot-state" role="status">{tr("Näillä valinnoilla ei ole paikannettuja heittoja.", "No located shots match these filters.")}</p>
              : <ul className="shot-distance-chart" aria-label={tr("Heittotarkkuus etäisyysalueittain", "Shot accuracy by distance band")}>
                {summary.bins.map((bin) => {
                  const attemptsWidth = bin.attempts / maxAttempts * 100;
                  const madeWidth = bin.attempts ? bin.made / bin.attempts * 100 : 0;
                  return <li className="shot-distance-row" key={bin.key}>
                    <span className="shot-distance-label">{bin.label}</span>
                    <span className="shot-distance-track" aria-hidden="true">
                      <span className="shot-distance-bar" style={{ width: `${attemptsWidth}%` }}>
                        <span className="shot-distance-bar-made" style={{ width: `${madeWidth}%` }} />
                      </span>
                    </span>
                    <span className="shot-distance-count"><strong>{bin.made}</strong><span> / {bin.attempts}</span></span>
                    <span className="shot-distance-pct">{percent(bin.pct)}</span>
                  </li>;
                })}
              </ul>}
            <p className="shot-distance-coverage">
              {tr(`${data!.games_with_data}/${data!.expected_games} ottelun heittodata`, `Shot data from ${data!.games_with_data}/${data!.expected_games} games`)}
              {summary.unlocated > 0 && ` · ${tr(`${summary.unlocated} heitosta puuttuu sijainti`, `${summary.unlocated} shots have no location`)}`}
              {!data!.box_score_matches && ` · ${tr("Heittoloki ei täsmää kaikkien otteluiden box scoreen", "Shot logs do not match every box score")}`}
            </p>
            <p className="shot-method-note">{tr("Etäisyys on arvio lähimmästä korista: kenttäkoordinaatit muunnetaan noin 28 × 15 metrin kentälle. Vyöhykkeet ovat suuntaa antavia, eivät tarkkoja mittauksia. Vapaaheitot ja puolustajan läheisyyden arviointi eivät sisälly.", "Distance is estimated to the nearer basket by mapping court coordinates to an approximately 28 × 15 m court. Bands are indicative, not precise measurements. Free throws and defender proximity are not included.")}</p>
          </>}
  </section>;
}
