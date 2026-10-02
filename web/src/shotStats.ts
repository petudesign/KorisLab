export type Shot = {
  id: string;
  team_id: string;
  player_id: string | null;
  player_name: string | null;
  period: number;
  clock: string | null;
  points: 2 | 3;
  made: boolean;
  type: string | null;
  x: number | null;
  y: number | null;
};

export type ShotChartData = {
  schema_version: "0.1";
  match_id: string;
  coordinate_system: "full_court_percent";
  source_url: string;
  updated_at: string;
  box_score_matches: boolean;
  teams: { id: string; name: string; home: boolean }[];
  shots: Shot[];
};

export function parseShotChart(value: unknown, matchId: string): ShotChartData {
  const data = value as ShotChartData | null;
  if (!data || data.schema_version !== "0.1" || data.match_id !== matchId ||
      data.coordinate_system !== "full_court_percent" || !Array.isArray(data.teams) ||
      data.teams.length !== 2 || !Array.isArray(data.shots) || typeof data.box_score_matches !== "boolean") {
    throw new Error("Invalid shot chart");
  }
  const teams = new Set(data.teams.map((team) => team.id));
  const ids = new Set<string>();
  for (const shot of data.shots) {
    if (!shot || typeof shot.id !== "string" || ids.has(shot.id) || !teams.has(shot.team_id) ||
        (shot.points !== 2 && shot.points !== 3) || typeof shot.made !== "boolean" ||
        !Number.isInteger(shot.period) || shot.period < 1 ||
        [shot.x, shot.y].some((coordinate) => coordinate !== null &&
          (typeof coordinate !== "number" || !Number.isFinite(coordinate) || coordinate < 0 || coordinate > 100))) {
      throw new Error("Invalid shot record");
    }
    ids.add(shot.id);
  }
  return data;
}

export type ShotFilters = { team: string; player: string; period: string; type: string };

export const SHOT_DISTANCE_BINS = [
  { key: "0-2", label: "0–2 m", min: 0, max: 2 },
  { key: "2-4", label: "2–4 m", min: 2, max: 4 },
  { key: "4-6", label: "4–6 m", min: 4, max: 6 },
  { key: "6-8", label: "6–8 m", min: 6, max: 8 },
  { key: "8+", label: "8+ m", min: 8, max: Number.POSITIVE_INFINITY },
] as const;

/** Approximate distance to the nearer basket from full-court percentage coordinates. */
export function estimateShotDistanceMeters(shot: Pick<Shot, "x" | "y">): number | null {
  if (shot.x === null || shot.y === null) return null;
  const courtX = shot.x / 100 * 28;
  const courtY = shot.y / 100 * 15;
  const basketY = 7.5;
  const leftBasketX = 1.575;
  const rightBasketX = 28 - leftBasketX;
  const leftDistance = Math.hypot(courtX - leftBasketX, courtY - basketY);
  const rightDistance = Math.hypot(courtX - rightBasketX, courtY - basketY);
  return Math.min(leftDistance, rightDistance);
}

export function summarizeShotDistances(shots: Array<Pick<Shot, "x" | "y" | "made">>) {
  const bins = SHOT_DISTANCE_BINS.map((bin) => ({ ...bin, attempts: 0, made: 0, missed: 0, pct: null as number | null }));
  let located = 0;
  for (const shot of shots) {
    const distance = estimateShotDistanceMeters(shot);
    if (distance === null) continue;
    located += 1;
    const binIndex = SHOT_DISTANCE_BINS.findIndex((bin) => distance >= bin.min && distance < bin.max);
    const bin = bins[binIndex];
    if (!bin) continue;
    bin.attempts += 1;
    if (shot.made) bin.made += 1;
    else bin.missed += 1;
  }
  for (const bin of bins) bin.pct = bin.attempts ? 100 * bin.made / bin.attempts : null;
  return { bins, located, unlocated: shots.length - located };
}

export function filterShots(shots: Shot[], filters: ShotFilters): Shot[] {
  return shots.filter((shot) => (filters.team === "all" || shot.team_id === filters.team) &&
    (filters.player === "all" || shot.player_id === filters.player) &&
    (filters.period === "all" || String(shot.period) === filters.period) &&
    (filters.type === "all" || String(shot.points) === filters.type));
}

export function summarizeShots(shots: Shot[]) {
  const made = shots.filter((shot) => shot.made).length;
  return { attempts: shots.length, made, pct: shots.length ? 100 * made / shots.length : null,
    located: shots.filter((shot) => shot.x !== null && shot.y !== null).length };
}

export function shotClock(value: string | null) {
  const match = /^PT(?:(\d+)M)?(?:(\d+)S)?$/.exec(value ?? "");
  return match ? `${match[1] ?? "0"}:${(match[2] ?? "0").padStart(2, "0")}` : "—";
}
