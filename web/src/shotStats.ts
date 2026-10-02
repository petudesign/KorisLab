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
