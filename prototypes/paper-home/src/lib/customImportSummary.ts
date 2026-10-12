import {
  playerAssistTurnoverRatio, playerFgPctFromTotals, playerPerGame, playerThreePctFromTotals,
  type SeasonPlayerRow,
} from "./playerStats.ts";
import {statFields,type ImportedPlayerGame,type ImportField,type StatField} from "./customImportData.ts";
export type GameSummary = {
  id: string;
  date: string;
  opponent: string;
  homeAway: "home" | "away" | null;
  points: number;
  opponentPoints: number | null;
  stats: Record<StatField, number | null>;
  rows: ImportedPlayerGame[];
};

export type PlayerSummary = {
  id: string;
  name: string;
  team: string;
  games: number;
  minutesPerGame: number | null;
  pointsPerGame: number | null;
  reboundsPerGame: number | null;
  assistsPerGame: number | null;
  turnoversPerGame: number | null;
  fgPct: number | null;
  threePct: number | null;
  assistTurnover: number | null;
};

export function groupGames(rows: ImportedPlayerGame[]): GameSummary[] {
  const groups = new Map<string, ImportedPlayerGame[]>();
  for (const row of rows) {
    const key = row.matchId + "|" + row.team.toLocaleLowerCase();
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return [...groups.entries()].map(([id, gameRows]) => {
    const stats = Object.fromEntries(statFields.map((field) => {
      const values = gameRows.map((row) => row.stats[field]);
      if (values.some((value) => value === null)) return [field, null];
      return [field, values.reduce<number>((sum, value) => sum + value!, 0)];
    })) as Record<StatField, number | null>;
    const opponentScores = new Set(gameRows.flatMap((row) => row.opponentPoints === null ? [] : [row.opponentPoints]));
    return {
      id,
      date: gameRows[0].date,
      opponent: gameRows[0].opponent,
      homeAway: gameRows.find((row) => row.homeAway !== null)?.homeAway ?? null,
      points: stats.points ?? 0,
      opponentPoints: opponentScores.size === 1 ? [...opponentScores][0] : null,
      stats,
      rows: gameRows,
    };
  }).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

export function aggregatePlayers(rows: ImportedPlayerGame[], availableFields: ImportField[]): PlayerSummary[] {
  const groups = new Map<string, ImportedPlayerGame[]>();
  for (const row of rows) {
    const group = groups.get(row.playerId) ?? [];
    group.push(row);
    groups.set(row.playerId, group);
  }
  return [...groups.entries()].map(([id, playerRows]) => {
    const first = playerRows[0];
    const totals = Object.fromEntries(statFields.map((field) => {
      const values = playerRows.map((row) => row.stats[field]);
      if (values.some((value) => value === null)) return [field, null];
      return [field, values.reduce<number>((sum, value) => sum + value!, 0)];
    })) as Record<StatField, number | null>;
    const row = {
      id, name: first.player, team: first.team, games: playerRows.length, starts: 0,
      minutes: totals.minutes ?? 0, points: totals.points ?? 0, twoPM: totals.twoPM ?? 0, twoPA: totals.twoPA ?? 0,
      threePM: totals.threePM ?? 0, threePA: totals.threePA ?? 0, ftm: totals.ftm ?? 0, fta: totals.fta ?? 0,
      rebounds: totals.rebounds ?? 0, assists: totals.assists ?? 0, turnovers: totals.turnovers ?? 0,
      steals: totals.steals, blocks: totals.blocks, efficiency: 0,
    } as SeasonPlayerRow;
    const has = (field: ImportField) => availableFields.includes(field);
    const sumAvailable = (field: StatField) => totals[field] !== null && has(field as ImportField);
    return {
      id, name: first.player, team: first.team, games: playerRows.length,
      minutesPerGame: sumAvailable("minutes") ? playerRows.reduce((sum, item) => sum + item.stats.minutes!, 0) / playerRows.length : null,
      pointsPerGame: playerPerGame(row, "points"),
      reboundsPerGame: sumAvailable("rebounds") ? playerPerGame(row, "rebounds") : null,
      assistsPerGame: sumAvailable("assists") ? playerPerGame(row, "assists") : null,
      turnoversPerGame: sumAvailable("turnovers") ? row.turnovers / row.games : null,
      fgPct: ["twoPM", "twoPA", "threePM", "threePA"].every((field) => has(field as ImportField) && totals[field as StatField] !== null) ? playerFgPctFromTotals(row) : null,
      threePct: has("threePM") && has("threePA") && totals.threePM !== null && totals.threePA !== null ? playerThreePctFromTotals(row) : null,
      assistTurnover: sumAvailable("assists") && sumAvailable("turnovers") ? playerAssistTurnoverRatio(row) : null,
    };
  }).sort((a, b) => (b.pointsPerGame ?? -Infinity) - (a.pointsPerGame ?? -Infinity) || a.name.localeCompare(b.name));
}
