export type AssistRow = { id: string; games: number; assists: number; two: number; three: number; free_throw: number; unlinked: number };
export type AssistStats = { schema_version: "0.1"; season_id: string; expected_games: number; verified_games: number; match_ids: string[]; players: AssistRow[] };
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

export function parseAssistStats(value: unknown, seasonId: string): AssistStats {
  const data = value as AssistStats;
  if (!data || data.schema_version !== "0.1" || data.season_id !== seasonId || !count(data.expected_games) || !count(data.verified_games) || data.verified_games > data.expected_games || !Array.isArray(data.players) || !Array.isArray(data.match_ids) || data.match_ids.length !== data.verified_games || new Set(data.match_ids).size !== data.match_ids.length || data.match_ids.some(id => typeof id !== "string" || !/^\d+$/.test(id))) throw new Error("Invalid assist summary");
  const ids = new Set<string>();
  for (const row of data.players) {
    if (!row || typeof row.id !== "string" || !row.id || ids.has(row.id) || ![row.games, row.assists, row.two, row.three, row.free_throw, row.unlinked].every(count) || row.games < 1 || row.games > data.verified_games || row.assists !== row.two + row.three + row.free_throw + row.unlinked) throw new Error("Invalid player assist totals");
    ids.add(row.id);
  }
  return data;
}

export function assistValues(row: AssistRow) {
  const baskets = row.two + row.three;
  const points = row.two * 2 + row.three * 3;
  return { baskets, points, pointsPerAssist: baskets ? points / baskets : null, threeShare: baskets ? row.three / baskets * 100 : null };
}
