import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { appearanceSplit, buildComparisonEntries, comparisonValues, entityGames, parseOnOff, recentSplit, statKeys, sumStatLines } from "../src/matchupStats.ts";

const regular = JSON.parse(readFileSync(new URL("../../data/normalized/season_verified.json", import.meta.url))).matches;
const playoffs = JSON.parse(readFileSync(new URL("../../data/normalized/season_playoffs_2025_2026.json", import.meta.url))).matches;
const onoff = parseOnOff(JSON.parse(readFileSync(new URL("../public/onoff-2025-26.json", import.meta.url))), "2025-26");
assert.equal(buildComparisonEntries([], "players").length, 0);
const teams = buildComparisonEntries(regular, "teams");
const players = buildComparisonEntries(regular, "players");
assert.equal(teams.length, 9);
assert.ok(players.length > 100);
for (const team of teams) {
  assert.equal(team.games, 24);
  assert.equal(team.values.wins + team.values.losses, 24);
  assert.ok(Math.abs(team.values.ortg - team.values.drtg - team.values.net) < 1e-10);
  const split = recentSplit(regular, "teams", team.id);
  assert.equal(split.recent.length, 5);
  assert.equal(split.earlier.length, 19);
  assert.equal(split.undated, 0);
}
const per40 = buildComparisonEntries(regular, "players", "40");
for (const player of players) {
  const normalized = per40.find((row) => row.id === player.id);
  assert.equal(normalized.values.ft, player.values.ft);
  assert.equal(normalized.values.efg, player.values.efg);
  assert.ok(Math.abs(normalized.values.points - player.shots.points * 40 / player.minutes) < 1e-10);
  const split = recentSplit(regular, "players", player.id);
  assert.equal(split.recent.length, Math.min(5, player.games));
  assert.equal(split.recent.length + split.earlier.length, player.games);
  assert.ok(split.recent.every((record) => entityGames([record], "players", player.id).length === 1));
}
const playoffPlayers = buildComparisonEntries(playoffs, "players");
assert.ok(playoffPlayers.some((player) => players.some((regularPlayer) => regularPlayer.id === player.id)));

// Weighted ratios, null propagation, zero denominators and team possessions.
const zero = Object.fromEntries(statKeys.map((key) => [key, 0]));
const totals = sumStatLines([{ ...zero, two_pm: 1, two_pa: 1 }, { ...zero, two_pm: 0, two_pa: 9 }]);
assert.equal(comparisonValues(totals, 2).fg, 10); // Not (100% + 0%) / 2.
assert.equal(comparisonValues(zero, 0).points, null);
assert.equal(comparisonValues(zero, 1).ft, null);
assert.equal(comparisonValues(zero, 1).astTo, null);
assert.equal(sumStatLines([{ ...zero, steals: null }, zero]).steals, null);
assert.equal(comparisonValues({ ...zero, fta: 5, two_pa: 10 }, 1).ftRate, .5);
const values = comparisonValues({ ...zero, points: 84, two_pa: 64 }, 1, { ...zero, points: 47, two_pa: 64 });
assert.equal(values.ortg, 131.25);
assert.equal(values.drtg, 73.4375);
assert.equal(values.net, 57.8125);

const fixture = structuredClone(regular[0]);
fixture.game.source_id = "undated-test"; fixture.game.scheduled_at = null;
assert.equal(recentSplit([fixture], "teams", fixture.teams[0].source_id).undated, 1);
const team = fixture.teams[0], player = team.players[0];
player.minutes = null; player.participated = null;
assert.equal(appearanceSplit([fixture], team.source_id, player.source_player_id).unknown, 1);
player.participated = false;
assert.equal(appearanceSplit([fixture], team.source_id, player.source_player_id).absent.length, 1);
player.minutes = 12;
assert.equal(appearanceSplit([fixture], team.source_id, player.source_player_id).played.length, 1);
assert.equal(appearanceSplit([fixture], team.source_id, "not-on-roster").absent.length, 1);
team.score = null;
assert.equal(buildComparisonEntries([fixture], "teams").find((row) => row.id === team.source_id).values.wins, null);

assert.ok(onoff.verified_games > 0 && onoff.verified_games < onoff.expected_games);
const pyrinto = teams.find(team => team.name === "Tampereen Pyrintö");
const annika = players.find(player => player.name === "Annika Aarrejoki");
assert.ok(pyrinto && annika);
const annikaAppearances = appearanceSplit(regular, pyrinto.id, annika.id);
assert.equal(annikaAppearances.played.length, 24);
assert.equal(annikaAppearances.absent.length, 0);
assert.equal(annikaAppearances.unknown, 0);
const annikaOnOff = onoff.players.find(row => row.id === annika.id && row.team_id === pyrinto.id);
assert.ok(annikaOnOff && annikaOnOff.games > 0 && annikaOnOff.games < annikaAppearances.played.length);
assert.ok(annikaOnOff.off.seconds > 0);
assert.throws(() => parseOnOff(onoff, "2026-27"));
const malformed = structuredClone(onoff); malformed.players[0].on.seconds = -1;
assert.throws(() => parseOnOff(malformed, "2025-26"));
const duplicate = structuredClone(onoff); duplicate.match_ids[1] = duplicate.match_ids[0];
assert.throws(() => parseOnOff(duplicate, "2025-26"));
assert.equal(onoff.methodology.playing_time_tolerance_seconds, 30);
const invalidMethod = structuredClone(onoff); invalidMethod.methodology.playing_time_tolerance_seconds = -1;
assert.throws(() => parseOnOff(invalidMethod, "2025-26"));
for (const row of onoff.players) {
  assert.ok(row.on.seconds + row.off.seconds >= row.games * 2400);
  const a = comparisonValues(row.on.own, row.on.seconds / 2400, row.on.opponent);
  if (a.net != null) assert.ok(Math.abs(a.ortg - a.drtg - a.net) < 1e-10);
}
console.log(`Matchup verified: ${teams.length} teams, ${players.length} players, ${playoffs.length} playoff games; on/off ${onoff.verified_games}/${onoff.expected_games}.`);
