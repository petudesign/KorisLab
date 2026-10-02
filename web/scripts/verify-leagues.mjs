import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { leagues, leagueAssetPath } from "../src/leagues.ts";
import { parseRoute, routeHref } from "../src/routing.ts";
import { buildComparisonEntries, parseOnOff } from "../src/matchupStats.ts";
import { resolveBasketballQuery } from "../src/basketballQuery.ts";
import { parseAssistStats } from "../src/assistStats.ts";
import { parseQuarterStats } from "../src/quarterStats.ts";
import { parseReplay } from "../src/replayStats.ts";
import { parseShotChart } from "../src/shotStats.ts";

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const datasets = {};
const seenGames = new Set();
for (const [season, expectedRegular, expectedPlayoffs] of [["2024-25", 191, 28], ["2025-26", 192, 43]]) {
  const year = season === "2024-25" ? "2024_2025" : "2025_2026";
  const regular = read(`../../data/normalized/season_korisliiga_${year}.json`);
  const playoffs = read(`../../data/normalized/season_korisliiga_playoffs_${year}.json`);
  const summary = read(`../../data/normalized/season_korisliiga_${year}.summary.json`);
  assert.equal(regular.matches.length, expectedRegular);
  assert.equal(regular.summary.available_played_games, 192);
  assert.equal(summary.aggregate.games, expectedRegular);
  assert.equal(playoffs.matches.length, expectedPlayoffs);
  assert.equal(buildComparisonEntries(regular.matches, "teams").length, 12);
  for (const record of [...regular.matches, ...playoffs.matches]) {
    assert.ok(!seenGames.has(record.game.source_id), "No duplicate games across seasons or phases");
    seenGames.add(record.game.source_id);
  }
  if (season === "2025-26") {
    for (const team of buildComparisonEntries(regular.matches, "teams")) assert.equal(team.games, 32);
  }
  datasets[season] = { regular, playoffs, summary };
  for (const [phase, records] of [["regular", regular.matches], ["playoffs", playoffs.matches]]) {
    const assetSeason = phase === "playoffs" ? `${season}-playoffs` : season;
    const assist = parseAssistStats(read(`../public/korisliiga/assists-${assetSeason}.json`), assetSeason);
    const quarters = parseQuarterStats(read(`../public/korisliiga/quarters-${assetSeason}.json`), assetSeason);
    const onoff = parseOnOff(read(`../public/korisliiga/onoff-${assetSeason}.json`), assetSeason);
    const shots = read(`../public/korisliiga/player-shots-${assetSeason}.json`);
    assert.equal(assist.expected_games, records.length);
    assert.equal(quarters.expected_games, records.length);
    assert.equal(onoff.expected_games, records.length);
    assert.equal(shots.season_id, assetSeason);
    assert.equal(shots.games_with_data, records.length);
    const recordIds = new Set(records.map(record => record.game.source_id));
    assert.ok(assist.match_ids.every(id => recordIds.has(id)));
    assert.ok(onoff.match_ids.every(id => recordIds.has(id)));
    const playerIds = new Set(records.flatMap(record => record.teams.flatMap(team => team.players.map(player => player.source_player_id))));
    assert.ok(shots.players.every(player => playerIds.has(player.id) || !player.name), "Unknown source players retain empty names and are not assigned to another player");
  }
  const decidingId = leagues.korisliiga.decidingFinals[season];
  const replay = parseReplay(read(`../public/korisliiga/replays/${decidingId}.json`), decidingId, season);
  const final = playoffs.matches.find(record => record.game.source_id === decidingId);
  const last = replay.events.at(-1);
  for (const team of final.teams) {
    const side = replay.teams.find(side => side.id === team.source_id);
    assert.equal(side.home ? last.home : last.away, team.score);
  }
  const chart = parseShotChart(read(`../public/korisliiga/shots/${decidingId}.json`), decidingId);
  assert.ok(chart.shots.length > 0);
  assert.ok(chart.box_score_matches);
}
const women = read("../../data/normalized/season_verified.json");
assert.ok(women.matches.every(record => !seenGames.has(record.game.source_id)), "Leagues have separate games");
const current = read("../public/korisliiga/season-2026-27.json");
assert.equal(current.schedule.length, current.schedule_summary.games);
assert.equal(current.matches.length, current.summary.valid_games);
assert.ok(current.schedule.every(game => game.category_id === leagues.korisliiga.categoryId));
assert.equal(current.schedule_summary.team_count, 12);
assert.equal(leagueAssetPath("korisliiga", "shots/1004241.json"), "/korisliiga/shots/1004241.json");
assert.equal(leagueAssetPath("naisten-korisliiga", "shots/1003919.json"), "/shots/1003919.json");
assert.equal(routeHref("teams", "2025-26"), "/teams/?season=2025-26");
for (const view of ["home", "overview", "teams", "players", "season", "matchup", "story", "player-profile"]) {
  const href = routeHref(view, "2024-25", "965763", "korisliiga");
  const url = new URL(href, "http://localhost");
  const route = parseRoute(url.pathname, url.search);
  assert.equal(route.view, view);
  assert.equal(route.league, "korisliiga");
  assert.equal(route.season, "2024-25");
}
for (const [season, winner] of [["2024-25", "Helsinki Seagulls"], ["2025-26", "Salon Vilpas"]]) {
  const result = await resolveBasketballQuery(`Korisliigan voittaja ${season}`, {
    leagueId: "korisliiga", language: "fi", seasonId: season,
    selectedSeasonTeams: datasets[season].summary.aggregate.teams,
    historicalTeams: datasets[season].summary.aggregate.teams,
    currentTeams: [], currentScheduleTeams: [],
    loadMatches: async requested => datasets[requested].regular.matches,
    loadPlayoffMatches: async requested => datasets[requested].playoffs.matches,
  });
  assert.ok(result.feedback.title.includes(winner), result.feedback.title);
  assert.ok(!result.feedback.title.includes("Naisten"));
}
console.log("League checks passed: scoped routes, separate datasets, 12 teams, 191/192 and 192/192 coverage, playoff champions and current-season category.");
