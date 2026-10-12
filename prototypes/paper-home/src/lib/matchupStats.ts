import type { SeasonMatchRecord } from "./SeasonContext.tsx";
import { playerDisplayName } from "./playerName.ts";
import { scheduleByMatchId } from "./schedule.ts";

export type ComparisonKind = "teams" | "players";
export type StatLine = Record<string, number | null | undefined>;
export type ComparisonEntry = { id: string; name: string; team: string; games: number; minutes: number; values: Record<string, number | null>; shots: StatLine };
export const statKeys = ["points", "two_pm", "two_pa", "three_pm", "three_pa", "ftm", "fta", "offensive_rebounds", "defensive_rebounds", "rebounds", "assists", "turnovers", "steals", "blocks"] as const;
const add = (a: number | null | undefined, b: number | null | undefined) => a == null || b == null ? null : a + b;
const divide = (a: number | null | undefined, b: number | null | undefined, scale = 1) => a == null || b == null || b <= 0 ? null : scale * a / b;

export function sumStatLines(lines: StatLine[]): StatLine {
  return Object.fromEntries(statKeys.map((key) => [key, lines.length && lines.every((line) => line[key] != null) ? lines.reduce((total, line) => total + line[key]!, 0) : null]));
}

function possessions(stats: StatLine) {
  const shots = add(stats.two_pa, stats.three_pa);
  return shots == null || stats.fta == null || stats.offensive_rebounds == null || stats.turnovers == null ? null : shots + .44 * stats.fta - stats.offensive_rebounds + stats.turnovers;
}

export function comparisonValues(stats: StatLine, divisor: number, opponent?: StatLine): Record<string, number | null> {
  const made = add(stats.two_pm, stats.three_pm), attempted = add(stats.two_pa, stats.three_pa);
  const sharedPossessions = opponent ? divide(add(possessions(stats), possessions(opponent)), 2) : null;
  return {
    ...Object.fromEntries(statKeys.map((key) => [key, divide(stats[key], divisor)])),
    fg: divide(made, attempted, 100),
    efg: divide(add(stats.two_pm, stats.three_pm == null ? null : 1.5 * stats.three_pm), attempted, 100),
    ft: divide(stats.ftm, stats.fta, 100), twoPct: divide(stats.two_pm, stats.two_pa, 100), threePct: divide(stats.three_pm, stats.three_pa, 100),
    threeShare: divide(stats.three_pa, attempted, 100), ftRate: divide(stats.fta, attempted), astTo: divide(stats.assists, stats.turnovers),
    ortg: divide(stats.points, sharedPossessions, 100), drtg: divide(opponent?.points, sharedPossessions, 100),
    net: divide(stats.points == null || opponent?.points == null ? null : stats.points - opponent.points, sharedPossessions, 100),
  };
}

export function buildComparisonEntries(records: SeasonMatchRecord[], kind: ComparisonKind, basis: "game" | "40" = "game"): ComparisonEntry[] {
  const groups = new Map<string, { name: string; teams: Set<string>; own: StatLine[]; opponent: StatLine[]; minutes: number; wins: number; losses: number; outcomesKnown: boolean }>();
  for (const record of records) for (const team of record.teams) {
    const opponent = record.teams.find((other) => other.source_id !== team.source_id);
    if (!opponent) continue;
    const entities = kind === "teams" ? [{ id: team.source_id, name: team.name, stats: team.stats, minutes: 0 }]
      : team.players.filter((player) => player.minutes != null && player.minutes > 0).map((player) => ({ id: player.source_player_id, name: playerDisplayName(player.display_name), stats: player.stats, minutes: player.minutes! }));
    for (const entity of entities) {
      let group = groups.get(entity.id);
      if (!group) { group = { name: entity.name, teams: new Set(), own: [], opponent: [], minutes: 0, wins: 0, losses: 0, outcomesKnown: true }; groups.set(entity.id, group); }
      group.teams.add(team.name); group.own.push(entity.stats); group.opponent.push(opponent.stats); group.minutes += entity.minutes;
      if (team.score != null && opponent.score != null && team.score !== opponent.score) { if (team.score > opponent.score) group.wins++; else group.losses++; }
      else group.outcomesKnown = false;
    }
  }
  return [...groups.entries()].map(([id, group]) => {
    const shots = sumStatLines(group.own), games = group.own.length;
    return { id, name: group.name, team: [...group.teams].join(" / "), games, minutes: group.minutes, shots,
      values: { ...comparisonValues(shots, kind === "players" && basis === "40" ? group.minutes / 40 : games, kind === "teams" ? sumStatLines(group.opponent) : undefined), games, minutes: divide(group.minutes, games), wins: group.outcomesKnown ? group.wins : null, losses: group.outcomesKnown ? group.losses : null } };
  }).sort((a, b) => a.name.localeCompare(b.name, "fi"));
}

export function entityGames(records: SeasonMatchRecord[], kind: ComparisonKind, id: string) {
  return records.filter((record) => record.teams.some((team) => kind === "teams" ? team.source_id === id : team.players.some((player) => player.source_player_id === id && player.minutes != null && player.minutes > 0)));
}

export function recentSplit(records: SeasonMatchRecord[], kind: ComparisonKind, id: string) {
  const games = entityGames(records, kind, id);
  const dated = games.map((record) => ({ record, time: Date.parse(record.game.scheduled_at ?? scheduleByMatchId[record.game.source_id] ?? "") })).filter((game) => Number.isFinite(game.time)).sort((a, b) => a.time - b.time || a.record.game.source_id.localeCompare(b.record.game.source_id)).map((game) => game.record);
  return { recent: dated.slice(-5), earlier: dated.slice(0, -5), undated: games.length - dated.length };
}

export function appearanceSplit(records: SeasonMatchRecord[], teamId: string, playerId: string) {
  const played: SeasonMatchRecord[] = [], absent: SeasonMatchRecord[] = [];
  let unknown = 0;
  for (const record of entityGames(records, "teams", teamId)) {
    const player = record.teams.find((team) => team.source_id === teamId)!.players.find((row) => row.source_player_id === playerId);
    if (player && player.minutes == null && player.participated !== false) { unknown++; continue; }
    (player && player.minutes != null && player.minutes > 0 ? played : absent).push(record);
  }
  return { played, absent, unknown };
}

export type OnOffState = { seconds: number; own: StatLine; opponent: StatLine };
export type OnOffData = { schema_version: string; season_id: string; expected_games: number; verified_games: number; match_ids: string[]; methodology?: { playing_time_tolerance_seconds: number; same_clock_policy: "unique_prior_lineup"; ambiguous_optional_stats: "unavailable" }; players: { id: string; team_id: string; games: number; on: OnOffState; off: OnOffState }[] };
export function parseOnOff(value: unknown, season: string): OnOffData {
  const data = value as OnOffData;
  const integer = (n: unknown) => typeof n === "number" && Number.isInteger(n) && n >= 0;
  const stateValid = (state: OnOffState) => state && Number.isFinite(state.seconds) && state.seconds >= 0 && [state.own, state.opponent].every((stats) => stats && statKeys.every((key) => stats[key] === null || typeof stats[key] === "number" && Number.isFinite(stats[key]) && stats[key]! >= 0));
  if (!data || data.schema_version !== "0.1" || data.season_id !== season || !integer(data.expected_games) || !integer(data.verified_games) || data.verified_games > data.expected_games || !Array.isArray(data.match_ids) || data.match_ids.length !== data.verified_games || data.match_ids.some((id) => typeof id !== "string") || new Set(data.match_ids).size !== data.match_ids.length || !Array.isArray(data.players) || new Set(data.players.map((player) => `${player?.team_id}/${player?.id}`)).size !== data.players.length || data.players.some((player) => !player || typeof player.id !== "string" || typeof player.team_id !== "string" || !integer(player.games) || player.games <= 0 || player.games > data.verified_games || !stateValid(player.on) || !stateValid(player.off) || player.on.seconds <= 0)) throw new Error("Invalid on/off snapshot");
  if (data.methodology != null && (!Number.isFinite(data.methodology.playing_time_tolerance_seconds) || data.methodology.playing_time_tolerance_seconds < 0 || data.methodology.same_clock_policy !== "unique_prior_lineup" || data.methodology.ambiguous_optional_stats !== "unavailable")) throw new Error("Invalid on/off methodology");
  return data;
}
