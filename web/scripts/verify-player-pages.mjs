import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { aggregateSeasonPlayers, playerPerGame, playerFgPctFromTotals, playerGameOutcome } from "../src/playerStats.ts";
import { parseRoute, routeHref } from "../src/routing.ts";

const snapshot = JSON.parse(readFileSync(new URL("../../data/normalized/season_verified.json", import.meta.url), "utf8"));
const players = aggregateSeasonPlayers(snapshot.matches);
const sara = players.find((player) => player.id === "83e7b871-90bd-11f1-b512-a37e7de974d8");
assert.equal(sara.name, "Sara Puckett");
assert.equal(sara.games, 24);
assert.equal(sara.points, 664);
assert.equal(playerPerGame(sara, "points"), 664 / 24);
const qualified = players.filter((player) => player.games >= 8 && player.minutes >= 120);
const assistLeader = [...qualified].sort((a, b) => playerPerGame(b, "assists") - playerPerGame(a, "assists"))[0];
const reboundLeader = [...qualified].sort((a, b) => playerPerGame(b, "rebounds") - playerPerGame(a, "rebounds"))[0];
assert.equal(assistLeader.name, "Jeanae Terry");
assert.equal(reboundLeader.name, "Stephanie McBride");

// A DNP must not inflate games, starts or totals; an unavailable stat is not zero.
const played = structuredClone(snapshot.matches[0]);
played.teams = [played.teams[0]];
played.teams[0].players = [played.teams[0].players[0]];
const dnp = structuredClone(played);
dnp.teams[0].players[0].minutes = 0;
dnp.teams[0].players[0].stats.points = 999;
const one = aggregateSeasonPlayers([played, dnp])[0];
assert.equal(one.games, 1);
assert.equal(one.points, played.teams[0].players[0].stats.points);
const incomplete = structuredClone(played);
incomplete.teams[0].players[0].stats.steals = null;
assert.equal(playerPerGame(aggregateSeasonPlayers([played, incomplete])[0], "steals"), null);
assert.equal(playerFgPctFromTotals({ ...one, twoPM: 1, twoPA: 2, threePM: 0, threePA: 8 }), 10);
assert.equal(playerFgPctFromTotals({ ...one, twoPA: 0, threePA: 0 }), null);

assert.equal(playerGameOutcome(78, 84), "loss");
assert.equal(playerGameOutcome(93, 85), "win");
assert.equal(playerGameOutcome(70, 70), "draw");
assert.equal(playerGameOutcome(null, 0), "unknown");
assert.equal(playerGameOutcome(70, undefined), "unknown");
assert.equal(playerGameOutcome(NaN, 70), "unknown");
const lastSaraGame = snapshot.matches.find(game => game.game.source_id === "969019");
const saraTeam = lastSaraGame.teams.find(team => team.players.some(player => player.source_player_id === sara.id));
const opponent = lastSaraGame.teams.find(team => team !== saraTeam);
assert.equal(playerGameOutcome(saraTeam.score, opponent.score), "loss");

for (const view of ["home", "overview", "matches", "teams", "players", "season"]) {
  const url = new URL(routeHref(view, "2025-26"), "http://localhost");
  assert.deepEqual(parseRoute(url.pathname, url.search), { view, season: "2025-26" });
}
const profile = new URL(routeHref("player-profile", "2025-26", sara.id), "http://localhost");
assert.deepEqual(parseRoute(profile.pathname, profile.search), { view: "player-profile", playerId: sara.id, season: "2025-26" });
assert.deepEqual(parseRoute("/matches/969019/", "?season=2025-26"), { view: "story", matchId: "969019", season: "2025-26" });
assert.equal(parseRoute("/matches/969019/players/").view, "player-detail");
assert.equal(parseRoute("/matches/969019/data/").view, "data");
assert.equal(parseRoute("/unknown/").view, "not-found");
assert.equal(parseRoute("/players/%E0%A4%A/").view, "not-found");
assert.equal(parseRoute("/players/", "?season=invalid").season, undefined);
console.log("Player totals, DNP/missing stats, weighted percentages, leader eligibility and URL routes verified.");
