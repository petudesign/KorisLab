import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { filterShots, parseShotChart, shotClock, summarizeShots } from '../src/shotStats.ts';

const directory = fileURLToPath(new URL('../public/shots/', import.meta.url));
const sample = parseShotChart(JSON.parse(readFileSync(`${directory}/968948.json`, 'utf8')), '968948');
assert.deepEqual(summarizeShots(sample.shots), { attempts: 131, made: 42, pct: 4200 / 131, located: 131 });
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
assert.equal(shotClock('PT09M03S'), '09:03');
assert.equal(shotClock('PT0S'), '0:00');
assert.throws(() => parseShotChart(sample, 'other'));
assert.throws(() => parseShotChart({ ...sample, shots: [...sample.shots, sample.shots[0]] }, '968948'));
for (const file of readdirSync(directory).filter((file) => file.endsWith('.json'))) {
  parseShotChart(JSON.parse(readFileSync(`${directory}/${file}`, 'utf8')), file.slice(0, -5));
}
console.log('Shot chart: source identity, real-game totals, combined filters, missing locations, and published payloads passed.');
