export type PlayerShot = { x: number | null; y: number | null; points: 2 | 3; made: boolean };
export type PlayerShotIndex = {
  schema_version: "0.1";
  season_id: string;
  expected_games: number;
  games_with_data: number;
  games_with_data_ids: string[];
  box_score_mismatch_ids: string[];
  box_score_matches: boolean;
  players: { id: string; name: string | null; shots: PlayerShot[] }[];
};
type PlayerShotState = { seasonId: string; status: "loading" | "ready" | "missing" | "error"; data: PlayerShotIndex | null };

export function parsePlayerShotIndex(value: unknown, seasonId: string): PlayerShotIndex {
  const data = value as PlayerShotIndex | null;
  if (!data || data.schema_version !== "0.1" || data.season_id !== seasonId || !Array.isArray(data.players) ||
      !Number.isInteger(data.expected_games) || !Number.isInteger(data.games_with_data) ||
      !Array.isArray(data.games_with_data_ids) || data.games_with_data_ids.some((id) => typeof id !== "string") ||
      !Array.isArray(data.box_score_mismatch_ids) || data.box_score_mismatch_ids.some((id) => typeof id !== "string") ||
      typeof data.box_score_matches !== "boolean") {
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

