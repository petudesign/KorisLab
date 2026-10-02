import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import historical from "../../data/normalized/season_verified.summary.json";
import { useI18n } from "./i18n";

export type SeasonId = "2025-26" | "2026-27";
export type SeasonMatchRecord = typeof import("../../data/normalized/season_verified.json")["matches"][number];
export type ScheduleMatch = {
  source_match_id: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  status: string;
  venue: string | null;
  home: { name: string; score: number | null };
  away: { name: string; score: number | null };
};
type CurrentSeason = typeof historical & {
  schema_version: string;
  season_id: string;
  updated_at: string;
  schedule: ScheduleMatch[];
  schedule_summary: { games: number; played_games: number; teams: string[]; team_count: number };
  matches: SeasonMatchRecord[];
};

let historicalMatches: Promise<SeasonMatchRecord[]> | undefined;
const SeasonContext = createContext<{
  seasonId: SeasonId;
  seasonLabel: string;
  setSeasonId: (season: SeasonId) => void;
  data: typeof historical;
  current: CurrentSeason | null;
  loading: boolean;
  error: string | null;
  refreshCurrent: () => Promise<void>;
  loadMatches: () => Promise<SeasonMatchRecord[]>;
} | null>(null);

export function SeasonProvider({ children }: { children: ReactNode }) {
  const [seasonId, setSeasonId] = useState<SeasonId>(() => {
    const query = new URLSearchParams(window.location.search).get("season");
    if (query === "2025-26" || query === "2026-27") return query;
    try { return localStorage.getItem("korislab-season") === "2025-26" ? "2025-26" : "2026-27"; }
    catch { return "2026-27"; }
  });
  const [current, setCurrent] = useState<CurrentSeason | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const refreshCurrent = useCallback(async () => {
    const request = ++requestId.current;
    setLoading(true);
    try {
      const response = await fetch("/season-2026-27.json", { cache: "no-store" });
      if (!response.ok) throw new Error("Season snapshot unavailable");
      const snapshot = await response.json() as CurrentSeason;
      if (snapshot.schema_version !== "0.1" || snapshot.season_id !== "huki2627" || !Array.isArray(snapshot.schedule) || !Array.isArray(snapshot.matches) || !snapshot.aggregate || !snapshot.schedule_summary || snapshot.summary?.valid_games !== snapshot.matches.length || snapshot.aggregate.games !== snapshot.matches.length || snapshot.schedule_summary.games !== snapshot.schedule.length) throw new Error("Invalid season snapshot");
      if (request !== requestId.current) return;
      setCurrent(snapshot);
      setError(null);
    } catch {
      if (request === requestId.current) setError("Could not refresh the current season");
    } finally { if (request === requestId.current) setLoading(false); }
  }, []);
  useEffect(() => {
    void refreshCurrent();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refreshCurrent(); }, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [refreshCurrent]);
  useEffect(() => {
    try { localStorage.setItem("korislab-season", seasonId); } catch { /* Selection still works without storage. */ }
    const url = new URL(window.location.href);
    url.searchParams.set("season", seasonId);
    window.history.replaceState(null, "", url);
  }, [seasonId]);
  useEffect(() => {
    const back = () => {
      const query = new URLSearchParams(window.location.search).get("season");
      if (query === "2025-26" || query === "2026-27") setSeasonId(query);
    };
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, []);
  const loadMatches = useCallback(() => {
    if (seasonId === "2026-27") return Promise.resolve(current?.matches ?? []);
    historicalMatches ??= import("../../data/normalized/season_verified.json").then((module) => module.default.matches);
    return historicalMatches;
  }, [seasonId, current]);
  return <SeasonContext.Provider value={{ seasonId, seasonLabel: seasonId.replace("-", "–"), setSeasonId, data: seasonId === "2026-27" && current ? current : historical, current, loading, error, refreshCurrent, loadMatches }}>{children}</SeasonContext.Provider>;
}

export function useSeason() {
  const context = useContext(SeasonContext);
  if (!context) throw new Error("SeasonProvider missing");
  return context;
}

export function SeasonSelector({ sidebar = false }: { sidebar?: boolean }) {
  const { seasonId, setSeasonId } = useSeason();
  const { tr } = useI18n();
  return <label className={`season-selector ${sidebar ? "season-selector--sidebar" : ""}`}><span>{tr("Naisten Korisliiga", "Women's Korisliiga")}</span><select aria-label={tr("Valitse kausi", "Select season")} value={seasonId} onChange={(event) => setSeasonId(event.target.value as SeasonId)}><option value="2025-26">2025–26</option><option value="2026-27">2026–27</option></select></label>;
}
