import { createContext, Fragment, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import historical from "../../data/normalized/season_verified.summary.json";
import historical2024 from "../../data/normalized/season_2024_2025.summary.json";
import womenPlayoffs2024 from "../../data/normalized/season_playoffs_2024_2025.summary.json";
import womenPlayoffs2025 from "../../data/normalized/season_playoffs_2025_2026.summary.json";
import men2024 from "../../data/normalized/season_korisliiga_2024_2025.summary.json";
import men2025 from "../../data/normalized/season_korisliiga_2025_2026.summary.json";
import menPlayoffs2024 from "../../data/normalized/season_korisliiga_playoffs_2024_2025.summary.json";
import menPlayoffs2025 from "../../data/normalized/season_korisliiga_playoffs_2025_2026.summary.json";
import { leagueIds, leagues, leagueAssetPath, type LeagueId } from "./leagues";
import { useI18n } from "./i18n";

export type SeasonId = "2024-25" | "2025-26" | "2026-27";
export const seasonIds: SeasonId[] = ["2024-25", "2025-26", "2026-27"];
type Summary = typeof historical;
const womenSummaries = { "2024-25": historical2024 as unknown as Summary, "2025-26": historical };
const summariesByLeague = {
  "naisten-korisliiga": womenSummaries,
  korisliiga: { "2024-25": men2024 as unknown as Summary, "2025-26": men2025 as unknown as Summary },
};
const playoffsByLeague = {
  "naisten-korisliiga": { "2024-25": womenPlayoffs2024, "2025-26": womenPlayoffs2025 },
  korisliiga: { "2024-25": menPlayoffs2024, "2025-26": menPlayoffs2025 },
};
const seasonRequests = new Map<string, Promise<SeasonMatchRecord[]>>();
const historicalLoaders = {
  "naisten-korisliiga": {
    "2024-25": {
      regular: () => import("../../data/normalized/season_2024_2025.json"),
      playoffs: () => import("../../data/normalized/season_playoffs_2024_2025.json"),
    },
    "2025-26": {
      regular: () => import("../../data/normalized/season_verified.json"),
      playoffs: () => import("../../data/normalized/season_playoffs_2025_2026.json"),
    },
  },
  korisliiga: {
    "2024-25": {
      regular: () => import("../../data/normalized/season_korisliiga_2024_2025.json"),
      playoffs: () => import("../../data/normalized/season_korisliiga_playoffs_2024_2025.json"),
    },
    "2025-26": {
      regular: () => import("../../data/normalized/season_korisliiga_2025_2026.json"),
      playoffs: () => import("../../data/normalized/season_korisliiga_playoffs_2025_2026.json"),
    },
  },
};
function loadHistorical(league: LeagueId, season: "2024-25" | "2025-26", phase: "regular" | "playoffs") {
  const key = `${league}-${season}-${phase}`;
  if (!seasonRequests.has(key)) {
    const request = historicalLoaders[league][season][phase]();
    seasonRequests.set(key, request.then(module => module.default.matches as unknown as SeasonMatchRecord[]).catch(error => {
      seasonRequests.delete(key);
      throw error;
    }));
  }
  return seasonRequests.get(key)!;
}
export type SeasonMatchRecord = typeof import("../../data/normalized/season_verified.json")["matches"][number];
export type ScheduleMatch = {
  source_match_id: string;
  category_id: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  status: string;
  venue: string | null;
  home: { name: string; score: number | null };
  away: { name: string; score: number | null };
};
type CurrentSeason = Summary & {
  schema_version: string; season_id: string; updated_at: string; schedule: ScheduleMatch[];
  schedule_summary: { games: number; played_games: number; teams: string[]; team_count: number };
  matches: SeasonMatchRecord[];
};
const SeasonContext = createContext<{
  leagueId: LeagueId; leagueName: string; leagueNameEn: string; setLeagueId: (league: LeagueId) => void;
  assetPath: (filename: string) => string;
  historicalSummaries: typeof womenSummaries; playoffSummaries: Record<"2024-25" | "2025-26", Summary>;
  seasonId: SeasonId; seasonLabel: string; setSeasonId: (season: SeasonId) => void;
  data: Summary; current: CurrentSeason | null; loading: boolean; error: string | null;
  refreshCurrent: () => Promise<void>; loadMatches: () => Promise<SeasonMatchRecord[]>;
  loadMatchesForSeason: (season: SeasonId, phase?: "regular" | "playoffs") => Promise<SeasonMatchRecord[]>;
} | null>(null);

export function SeasonProvider({ children }: { children: ReactNode }) {
  const [leagueId, updateLeague] = useState<LeagueId>(() => {
    const query = new URLSearchParams(window.location.search);
    const value = query.get("league");
    if (leagueIds.includes(value as LeagueId)) return value as LeagueId;
    return "naisten-korisliiga";
  });
  const [seasonId, setSeasonId] = useState<SeasonId>(() => {
    const query = new URLSearchParams(window.location.search).get("season");
    if (seasonIds.includes(query as SeasonId)) return query as SeasonId;
    return "2026-27";
  });
  const setLeagueId = useCallback((league: LeagueId) => {
    if (league === leagueId) return;
    const url = new URL(window.location.href);
    if (/^\/(players|matches)\/[^/]+/.test(url.pathname)) { url.pathname = `/${url.pathname.split("/")[1]}/`; url.hash = ""; }
    if (league === "korisliiga") url.searchParams.set("league", league); else url.searchParams.delete("league");
    window.history.pushState(null, "", url);
    updateLeague(league);
  }, [leagueId]);
  const [snapshot, setSnapshot] = useState<{ league: LeagueId; data: CurrentSeason } | null>(null);
  const current = snapshot?.league === leagueId ? snapshot.data : null;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const assetPath = useCallback((filename: string) => leagueAssetPath(leagueId, filename), [leagueId]);
  const refreshCurrent = useCallback(async () => {
    const request = ++requestId.current;
    setLoading(true); setError(null);
    try {
      const response = await fetch(leagueAssetPath(leagueId, "season-2026-27.json"), { cache: "no-store" });
      if (!response.ok) throw new Error("Season snapshot unavailable");
      const data = await response.json() as CurrentSeason;
      if (data.schema_version !== "0.1" || data.season_id !== leagues[leagueId].currentCompetition || !Array.isArray(data.schedule) || data.schedule.some(row => row.category_id !== leagues[leagueId].categoryId) || !Array.isArray(data.matches) || !data.aggregate || !data.schedule_summary || data.summary?.valid_games !== data.matches.length || data.aggregate.games !== data.matches.length || data.schedule_summary.games !== data.schedule.length) throw new Error("Invalid season snapshot");
      if (request === requestId.current) setSnapshot({ league: leagueId, data });
    } catch { if (request === requestId.current) setError("Could not refresh the current season"); }
    finally { if (request === requestId.current) setLoading(false); }
  }, [leagueId]);
  useEffect(() => {
    void refreshCurrent();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refreshCurrent(); }, 5 * 60 * 1000);
    return () => { requestId.current++; window.clearInterval(timer); };
  }, [refreshCurrent]);
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("season", seasonId);
    if (leagueId === "korisliiga") url.searchParams.set("league", leagueId); else url.searchParams.delete("league");
    window.history.replaceState(null, "", url);
  }, [seasonId, leagueId]);
  useEffect(() => {
    const back = () => {
      const query = new URLSearchParams(window.location.search);
      const season = query.get("season");
      if (seasonIds.includes(season as SeasonId)) setSeasonId(season as SeasonId);
      updateLeague(query.get("league") === "korisliiga" ? "korisliiga" : "naisten-korisliiga");
    };
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, []);
  const loadMatchesForSeason = useCallback((season: SeasonId, phase: "regular" | "playoffs" = "regular") => {
    if (season === "2026-27") {
      if (phase === "playoffs") return Promise.resolve([]);
      return current ? Promise.resolve(current.matches) : Promise.reject(new Error("Current season unavailable"));
    }
    return loadHistorical(leagueId, season, phase);
  }, [leagueId, current]);
  const loadMatches = useCallback(() => seasonId === "2026-27" ? Promise.resolve(current?.matches ?? []) : loadHistorical(leagueId, seasonId, "regular"), [leagueId, seasonId, current]);
  const summaries = summariesByLeague[leagueId];
  return <SeasonContext.Provider value={{
    leagueId,
    leagueName: leagues[leagueId].name,
    leagueNameEn: leagues[leagueId].nameEn,
    setLeagueId,
    assetPath,
    historicalSummaries: summaries,
    playoffSummaries: playoffsByLeague[leagueId] as unknown as Record<"2024-25" | "2025-26", Summary>,
    seasonId,
    seasonLabel: seasonId.replace("-", "–"),
    setSeasonId,
    data: seasonId === "2026-27" ? current ?? summaries["2025-26"] : summaries[seasonId],
    current, loading, error, refreshCurrent, loadMatches, loadMatchesForSeason,
  }}><Fragment key={leagueId}>{children}</Fragment></SeasonContext.Provider>;
}
export function useSeason() {
  const context = useContext(SeasonContext);
  if (!context) throw new Error("SeasonProvider missing");
  return context;
}
export function SeasonSelector({ sidebar = false, showLabels = false }: { sidebar?: boolean; showLabels?: boolean }) {
  const { seasonId, setSeasonId, leagueId, setLeagueId } = useSeason();
  const { tr } = useI18n();
  return <div className={`season-selector ${sidebar ? "season-selector--sidebar" : ""}`}>
    <label><span className={showLabels ? undefined : "sr-only"}>{showLabels ? tr("Sarja", "League") : tr("Valitse sarja", "Select league")}</span><select aria-label={tr("Valitse sarja", "Select league")} value={leagueId} onChange={event => setLeagueId(event.target.value as LeagueId)}>{leagueIds.map(id => <option key={id} value={id}>{tr(leagues[id].name, leagues[id].nameEn)}</option>)}</select></label>
    <label><span className={showLabels ? undefined : "sr-only"}>{showLabels ? tr("Kausi", "Season") : tr("Valitse kausi", "Select season")}</span><select aria-label={tr("Valitse kausi", "Select season")} value={seasonId} onChange={event => setSeasonId(event.target.value as SeasonId)}>{seasonIds.map(season => <option key={season} value={season}>{season.replace("-", "–")}</option>)}</select></label>
  </div>;
}
