import type { SeasonMatchRecord } from "./SeasonContext";
import { playerDisplayName } from "./playerName.ts";
type RawSeasonPlayer = SeasonMatchRecord["teams"][number]["players"][number];

export function progressivePlayerQualification(records: SeasonMatchRecord[]) {
  const teamGames = new Map<string, number>();
  for (const record of records) {
    for (const team of record.teams) {
      teamGames.set(team.source_id, (teamGames.get(team.source_id) ?? 0) + 1);
    }
  }

  const mostPlayedTeamGames = Math.max(0, ...teamGames.values());
  const minimumGames = Math.max(2, Math.ceil(mostPlayedTeamGames / 3));
  return { minimumGames, minimumMinutes: minimumGames * 15, mostPlayedTeamGames };
}

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
  blocksReceived: number | null;
  plusMinus: number | null;
  efficiency: number;
  knownMinutes: number;
  minutesGames: number;
  usageGames: number;
  usagePlays: number;
  usageTeamPlays: number;
  usageMinutes: number;
  usageTeamMinutes: number;
};

// A full game is 200 team minutes. Below this the source has lost minutes, which would inflate usage.
const USAGE_MINIMUM_TEAM_MINUTES = 199;
type UsageStats = { two_pa?: number | null; three_pa?: number | null; fta?: number | null; turnovers?: number | null };
type UsagePlayer = { minutes?: unknown; minutesValue?: unknown; participated?: boolean; stats: UsageStats };

const usagePlayerMinutes = (player: UsagePlayer) => player.minutesValue ?? player.minutes;

function usagePlays(stats: UsageStats | undefined) {
  if (stats?.two_pa == null || stats.three_pa == null || stats.fta == null || stats.turnovers == null) return null;
  return stats.two_pa + stats.three_pa + 0.44 * stats.fta + stats.turnovers;
}

export function playerGameUsage(team: { stats?: UsageStats; players: UsagePlayer[] }, player: UsagePlayer) {
  const minutes = usagePlayerMinutes(player);
  const plays = usagePlays(player.stats), teamPlays = usagePlays(team.stats);
  if (typeof minutes !== "number" || !(minutes > 0) || plays == null || teamPlays == null || teamPlays <= 0) return null;
  let teamMinutes = 0;
  for (const teammate of team.players) {
    const value = usagePlayerMinutes(teammate);
    if (typeof value === "number" && Number.isFinite(value)) teamMinutes += value;
    else if (teammate.participated === true) return null;
  }
  if (teamMinutes < USAGE_MINIMUM_TEAM_MINUTES) return null;
  return { usageGames: 1, usagePlays: plays, usageTeamPlays: teamPlays, usageMinutes: minutes, usageTeamMinutes: teamMinutes };
}

export function aggregateSeasonPlayers(records: SeasonMatchRecord[]) {
  const rows = new Map<string, SeasonPlayerRow>();
  for (const record of records) {
    for (const team of record.teams) {
      for (const player of team.players as RawSeasonPlayer[]) {
        const minutes = player.minutes ?? Number.NaN;
        if (!(minutes > 0 || player.participated === true)) continue;
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
          blocksReceived: 0,
          plusMinus: 0,
          efficiency: 0,
          knownMinutes: 0,
          minutesGames: 0,
          usageGames: 0,
          usagePlays: 0,
          usageTeamPlays: 0,
          usageMinutes: 0,
          usageTeamMinutes: 0,
        };
        const stats = player.stats;
        row.games += 1;
        if (player.starter) row.starts += 1;
        row.minutes += minutes;
        if (typeof minutes === "number" && Number.isFinite(minutes)) {
          row.knownMinutes += minutes;
          row.minutesGames += 1;
        }
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
        row.blocksReceived = row.blocksReceived == null || stats.blocks_received == null ? null : row.blocksReceived + stats.blocks_received;
        row.plusMinus = row.plusMinus == null || stats.plus_minus == null ? null : row.plusMinus + stats.plus_minus;
        row.efficiency += stats.efficiency ?? 0;
        const usage = playerGameUsage(team as Parameters<typeof playerGameUsage>[0], player as UsagePlayer);
        if (usage) {
          row.usageGames += usage.usageGames;
          row.usagePlays += usage.usagePlays;
          row.usageTeamPlays += usage.usageTeamPlays;
          row.usageMinutes += usage.usageMinutes;
          row.usageTeamMinutes += usage.usageTeamMinutes;
        }
        rows.set(id, row);
      }
    }
  }
  return Array.from(rows.values()).filter((player) => player.games > 0);
}

// Season minutes for sample limits only. A game with lost minutes must not drop a player from counting-stat leaders,
// so those games are estimated from the player's known average.
export function playerQualifyingMinutes(player: Pick<SeasonPlayerRow, "minutes" | "games"> & Partial<Pick<SeasonPlayerRow, "knownMinutes" | "minutesGames">>) {
  if (Number.isFinite(player.minutes)) return player.minutes;
  return player.minutesGames ? (player.knownMinutes! / player.minutesGames) * player.games : Number.NaN;
}

// Share of the team's possessions the player used while on the floor. Only games with complete minutes count.
export function playerUsagePct(player: Pick<SeasonPlayerRow, "usagePlays" | "usageTeamPlays" | "usageMinutes" | "usageTeamMinutes">) {
  if (!(player.usageMinutes > 0) || !(player.usageTeamPlays > 0)) return null;
  return (100 * player.usagePlays * (player.usageTeamMinutes / 5)) / (player.usageMinutes * player.usageTeamPlays);
}

export function playerPerGame(player: SeasonPlayerRow, stat: keyof Pick<SeasonPlayerRow, "points" | "rebounds" | "assists" | "steals" | "blocks" | "blocksReceived" | "plusMinus">) {
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
        if (!(player.minutes! > 0 || player.participated === true)) continue;
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
  return !Number.isFinite(player.minutes) || player.minutes <= 0 ? null : (player.efficiency / player.minutes) * 40;
}

export function playerAttemptsPer40(player: SeasonPlayerRow) {
  const attempts = player.twoPA + player.threePA;
  return !Number.isFinite(player.minutes) || player.minutes <= 0 ? null : (attempts / player.minutes) * 40;
}
