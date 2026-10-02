import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { estimateShotDistanceMeters, filterShots, parseShotChart, shotClock, summarizeShotDistances, summarizeShots } from '../src/shotStats.ts';

const directory = fileURLToPath(new URL('../public/shots/', import.meta.url));
const sample = parseShotChart(JSON.parse(readFileSync(`${directory}/968948.json`, 'utf8')), '968948');
assert.deepEqual(summarizeShots(sample.shots), { attempts: 131, made: 42, pct: 4200 / 131, located: 131 });
const finals = parseShotChart(JSON.parse(readFileSync(`${directory}/1003919.json`, 'utf8')), '1003919');
assert.equal(finals.shots.length, 131);
assert.equal(finals.box_score_matches, true);
const home = sample.teams.find((team) => team.home);
const threes = filterShots(sample.shots, { team: home.id, player: 'all', period: 'all', type: '3' });
assert.equal(threes.length, 28);
assert.equal(summarizeShots(threes).made, 5);
const firstPeriod = filterShots(sample.shots, { team: 'all', player: 'all', period: '1', type: 'all' });
assert.equal(firstPeriod.length, 36);
const player = sample.shots.find((shot) => shot.player_name === 'Jasmina Jones').player_id;
const playerThrees = filterShots(sample.shots, { team: home.id, player, period: 'all', type: '3' });
assert.equal(playerThrees.length, 5);
assert.equal(summarizeShots(playerThrees).made, 3);
assert.equal(summarizeShots([]).pct, null);
assert.deepEqual(summarizeShots([{ ...sample.shots[0], x: null }]).located, 0);
const fromLeftBasket = (meters, made) => ({ x: (1.575 + meters) / 28 * 100, y: 50, made });
assert.ok(Math.abs(estimateShotDistanceMeters(fromLeftBasket(3, false)) - 3) < 1e-9);
const distanceSummary = summarizeShotDistances([
  fromLeftBasket(1, true), fromLeftBasket(3, false), fromLeftBasket(5, true),
  fromLeftBasket(7, false), fromLeftBasket(9, true), { x: null, y: null, made: false },
]);
assert.equal(distanceSummary.located, 5);
assert.equal(distanceSummary.unlocated, 1);
assert.deepEqual(distanceSummary.bins.map(({ attempts, made, missed }) => ({ attempts, made, missed })), [
  { attempts: 1, made: 1, missed: 0 }, { attempts: 1, made: 0, missed: 1 },
  { attempts: 1, made: 1, missed: 0 }, { attempts: 1, made: 0, missed: 1 },
  { attempts: 1, made: 1, missed: 0 },
]);
assert.equal(shotClock('PT09M03S'), '09:03');
assert.equal(shotClock('PT0S'), '0:00');
assert.throws(() => parseShotChart(sample, 'other'));
assert.throws(() => parseShotChart({ ...sample, shots: [...sample.shots, sample.shots[0]] }, '968948'));
for (const file of readdirSync(directory).filter((file) => file.endsWith('.json'))) {
  parseShotChart(JSON.parse(readFileSync(`${directory}/${file}`, 'utf8')), file.slice(0, -5));
}
const seasonIndex = JSON.parse(readFileSync(fileURLToPath(new URL('../public/player-shots-2025-26.json', import.meta.url)), 'utf8'));
const seasonShots = seasonIndex.players.flatMap(({ shots }) => shots);
const seasonDistances = summarizeShotDistances(seasonShots);
assert.equal(seasonIndex.games_with_data, 108);
assert.equal(seasonDistances.located, seasonShots.length);
assert.equal(seasonDistances.bins.reduce((total, bin) => total + bin.attempts, 0), seasonDistances.located);
assert.ok(seasonDistances.bins.every((bin) => bin.made + bin.missed === bin.attempts));
console.log('Shot chart: source identity, real-game totals, combined filters, missing locations, published payloads, and season distance totals passed.');
