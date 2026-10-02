export type ProfileStatus = "above" | "below" | "level";
export type MetricPreference = "higher" | "lower" | "descriptive";
export type ProfileComparison = {
  status: ProfileStatus;
  intensity: "normal" | "strong";
  tone: "positive" | "negative" | "level" | "neutral";
};

/** Numeric direction and performance are separate: a higher turnover rate is worse. */
export function getProfileComparison(
  value: number | null, baseline: number | null,
  near: number, strong: number, preference: MetricPreference,
): ProfileComparison | null {
  if (value === null || baseline === null || !Number.isFinite(value) || !Number.isFinite(baseline)) return null;
  const delta = value - baseline;
  const status = Math.abs(delta) <= near ? "level" : delta > 0 ? "above" : "below";
  const tone = preference === "descriptive" ? "neutral" : status === "level" ? "level"
    : delta * (preference === "lower" ? -1 : 1) > 0 ? "positive" : "negative";
  return { status, tone, intensity: status !== "level" && Math.abs(delta) >= strong ? "strong" : "normal" };
}
