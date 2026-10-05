import type { SeasonMatchRecord } from "./SeasonContext";
import { playerDisplayName } from "./playerName.ts";
type RawSeasonPlayer = SeasonMatchRecord["teams"][number]["players"][number];

export function playerGameOutcome(teamScore: number | null | undefined, opponentScore: number | null | undefined): "win" | "loss" | "draw" | "unknown" {
  if (teamScore == null || opponentScore == null || !Number.isFinite(teamScore) || !Number.isFinite(opponentScore)) return "unknown";
  return teamScore > opponentScore ? "win" : teamScore < opponentScore ? "loss" : "draw";
}

export type SeasonPlayerRow = {
  id: string;
  name: string;
  team: string;
  games: number;
  starts: number;
  minutes: number;
  points: number;
  twoPM: number;
  twoPA: number;
  threePM: number;
  threePA: number;
  ftm: number;
  fta: number;
  rebounds: number;
  assists: number;
  turnovers: number;
  steals: number | null;
  blocks: number | null;
  efficiency: number;
};

export function aggregateSeasonPlayers(records: SeasonMatchRecord[]) {
  const rows = new Map<string, SeasonPlayerRow>();
  for (const record of records) {
    for (const team of record.teams) {
      for (const player of team.players as RawSeasonPlayer[]) {
        const minutes = player.minutes ?? 0;
        if (minutes <= 0) continue;
        const id = player.source_player_id;
        const row = rows.get(id) ?? {
          id,
          name: playerDisplayName(player.display_name),
          team: team.name,
          games: 0,
          starts: 0,
          minutes: 0,
          points: 0,
          twoPM: 0,
          twoPA: 0,
          threePM: 0,
          threePA: 0,
          ftm: 0,
          fta: 0,
          rebounds: 0,
          assists: 0,
          turnovers: 0,
          steals: 0,
          blocks: 0,
          efficiency: 0,
        };
        const stats = player.stats;
        if (minutes > 0) row.games += 1;
        if (minutes > 0 && player.starter) row.starts += 1;
        row.minutes += minutes;
        row.points += stats.points ?? 0;
        row.twoPM += stats.two_pm ?? 0;
        row.twoPA += stats.two_pa ?? 0;
        row.threePM += stats.three_pm ?? 0;
        row.threePA += stats.three_pa ?? 0;
        row.ftm += stats.ftm ?? 0;
        row.fta += stats.fta ?? 0;
        row.rebounds += stats.rebounds ?? 0;
        row.assists += stats.assists ?? 0;
        row.turnovers += stats.turnovers ?? 0;
        row.steals = row.steals == null || stats.steals == null ? null : row.steals + stats.steals;
        row.blocks = row.blocks == null || stats.blocks == null ? null : row.blocks + stats.blocks;
        row.efficiency += stats.efficiency ?? 0;
        rows.set(id, row);
      }
    }
  }
  return Array.from(rows.values()).filter((player) => player.games > 0);
}

export function playerPerGame(player: SeasonPlayerRow, stat: keyof Pick<SeasonPlayerRow, "points" | "rebounds" | "assists" | "steals" | "blocks">) {
  return player.games === 0 || player[stat] == null ? null : player[stat] / player.games;
}

export function playerFgPctFromTotals(player: SeasonPlayerRow) {
  const attempts = player.twoPA + player.threePA;
  return attempts === 0 ? null : ((player.twoPM + player.threePM) / attempts) * 100;
}

export function playerFtPctFromTotals(player: SeasonPlayerRow) {
  return player.fta === 0 ? null : (player.ftm / player.fta) * 100;
}

export function playerEfGPctFromTotals(player: SeasonPlayerRow) {
  const attempts = player.twoPA + player.threePA;
  return attempts === 0 ? null : ((player.twoPM + player.threePM * 1.5) / attempts) * 100;
}

export function trueShootingPct(points: number | null | undefined, fieldGoalAttempts: number | null | undefined, freeThrowAttempts: number | null | undefined) {
  if (points == null || fieldGoalAttempts == null || freeThrowAttempts == null) return null;
  const attempts = fieldGoalAttempts + 0.44 * freeThrowAttempts;
  return attempts <= 0 ? null : (points / (2 * attempts)) * 100;
}

export function playerTrueShootingPctFromTotals(player: SeasonPlayerRow) {
  return trueShootingPct(player.points, player.twoPA + player.threePA, player.fta);
}

export type PlayerShotVolume = { fieldGoalAttempts: number; teamFieldGoalAttempts: number; complete: boolean };

export function aggregatePlayerShotVolumes(records: SeasonMatchRecord[]) {
  const volumes = new Map<string, PlayerShotVolume>();
  for (const record of records) {
    for (const team of record.teams) {
      const teamAttempts = team.stats.two_pa == null || team.stats.three_pa == null
        ? null
        : team.stats.two_pa + team.stats.three_pa;
      for (const player of team.players) {
        if ((player.minutes ?? 0) <= 0) continue;
        const current = volumes.get(player.source_player_id) ?? { fieldGoalAttempts: 0, teamFieldGoalAttempts: 0, complete: true };
        const playerAttempts = player.stats.two_pa == null || player.stats.three_pa == null
          ? null
          : player.stats.two_pa + player.stats.three_pa;
        if (teamAttempts == null || playerAttempts == null) {
          current.complete = false;
        } else {
          current.fieldGoalAttempts += playerAttempts;
          current.teamFieldGoalAttempts += teamAttempts;
        }
        volumes.set(player.source_player_id, current);
      }
    }
  }
  return volumes;
}

export function playerAssistTurnoverRatio(player: SeasonPlayerRow) {
  return player.turnovers === 0 ? null : player.assists / player.turnovers;
}

export function playerThreePctFromTotals(player: SeasonPlayerRow) {
  return player.threePA === 0 ? null : (player.threePM / player.threePA) * 100;
}

export function playerEfficiencyPer40(player: SeasonPlayerRow) {
  return player.minutes === 0 ? null : (player.efficiency / player.minutes) * 40;
}

export function playerAttemptsPer40(player: SeasonPlayerRow) {
  const attempts = player.twoPA + player.threePA;
  return player.minutes === 0 ? null : (attempts / player.minutes) * 40;
}
