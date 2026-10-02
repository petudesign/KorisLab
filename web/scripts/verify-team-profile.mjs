import assert from "node:assert/strict";
import { getProfileComparison } from "../src/teamProfileComparison.ts";

// Reported BC Nokia bug: 25.5% turnovers versus the league's 22.5%.
assert.deepEqual(getProfileComparison(25.5, 22.5, 1, 2, "lower"), { status: "above", tone: "negative", intensity: "strong" });
assert.equal(getProfileComparison(18.4, 22.5, 1, 2, "lower").tone, "positive");
// Defensive rating also rewards fewer points conceded, not a higher number.
assert.equal(getProfileComparison(95, 93.1, 1.5, 3, "lower").tone, "negative");
assert.equal(getProfileComparison(85.2, 93.1, 1.5, 3, "lower").tone, "positive");
assert.equal(getProfileComparison(89.2, 93, 1.5, 3, "higher").tone, "negative");
assert.equal(getProfileComparison(103.4, 93, 1.5, 3, "higher").tone, "positive");
assert.equal(getProfileComparison(23.5, 22.5, 1, 2, "lower").tone, "level");
for (const value of [15, 22.5, 30]) assert.equal(getProfileComparison(value, 22.5, 1, 2, "descriptive").tone, "neutral");
for (const value of [null, NaN, Infinity]) assert.equal(getProfileComparison(value, 22.5, 1, 2, "lower"), null);
assert.equal(getProfileComparison(22.5, null, 1, 2, "lower"), null);
console.log("Team profile: lower/higher is better, neutral style metrics, tolerance and missing data verified.");
