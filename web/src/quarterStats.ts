export type ScratchMetricKey = "steals" | "fta" | "three_pa" | "turnovers" | "points";
export type ScratchPeriodKey = "game" | "q1" | "q2" | "q3" | "q4";
type QuarterValue = { games: number; total: number };
export type QuarterStats = {
  schema_version: "0.1";
  season_id: string;
  expected_games: number;
  verified_games: number;
  teams: Array<{ id: string; name: string; periods: Record<string, Record<ScratchMetricKey, QuarterValue>> }>;
};

const metrics: ScratchMetricKey[] = ["steals", "fta", "three_pa", "turnovers", "points"];
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

export function parseQuarterStats(value: unknown, seasonId: string): QuarterStats {
  const data = value as QuarterStats;
  if (!data || data.schema_version !== "0.1" || data.season_id !== seasonId || !count(data.expected_games) || !count(data.verified_games) || data.verified_games > data.expected_games || !Array.isArray(data.teams)) throw new Error("Invalid quarter summary");
  const ids = new Set<string>();
  for (const team of data.teams) {
    if (!team || typeof team.id !== "string" || !team.id || ids.has(team.id) || typeof team.name !== "string" || !team.periods) throw new Error("Invalid quarter team");
    ids.add(team.id);
    for (const q of ["1", "2", "3", "4"]) {
      for (const metric of metrics) {
        const row = team.periods[q]?.[metric];
        if (!row || !count(row.games) || row.games > data.verified_games || !count(row.total) || (row.games === 0 && row.total !== 0)) throw new Error("Invalid quarter totals");
        if (q !== "1" && row.games !== team.periods["1"][metric].games) throw new Error("Inconsistent quarter coverage");
      }
    }
  }
  return data;
}

export function quarterValue(data: QuarterStats | null, teamId: string, period: ScratchPeriodKey, metric: ScratchMetricKey) {
  const row = data?.teams.find(team => team.id === teamId)?.periods[period.slice(1)]?.[metric];
  return row && row.games > 0 ? { games: row.games, total: row.total, average: row.total / row.games } : { games: 0, total: null, average: null };
}
