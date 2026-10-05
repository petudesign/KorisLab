type SparkPoint = { x: number; value: number };

export function MetricSparkline({ values, label, language, color }: {
  values: Array<number | null>;
  label: string;
  language: string;
  color?: string;
}) {
  const valid: Array<SparkPoint | null> = values.map((value, index) => value == null || !Number.isFinite(value)
    ? null
    : { x: values.length < 2 ? 96 : 4 + (index / (values.length - 1)) * 92, value });
  const observed = valid.filter((point): point is SparkPoint => point !== null);
  if (observed.length === 0) return null;

  const min = Math.min(...observed.map((point) => point.value));
  const max = Math.max(...observed.map((point) => point.value));
  const y = (value: number) => max === min ? 14 : 25 - ((value - min) / (max - min)) * 20;
  const segments: Array<Array<{ x: number; y: number }>> = [];
  let segment: Array<{ x: number; y: number }> = [];
  valid.forEach((point) => {
    if (point) segment.push({ x: point.x, y: y(point.value) });
    else if (segment.length > 0) { segments.push(segment); segment = []; }
  });
  if (segment.length > 0) segments.push(segment);
  const chartSegments = segments.filter((points) => points.length > 1);
  const linePath = chartSegments.map((points) => points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ")).join(" ");
  const areaPath = chartSegments.map((points) => `${points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ")} L${points.at(-1)!.x.toFixed(1)},32 L${points[0].x.toFixed(1)},32 Z`).join(" ");
  const latest = observed.at(-1)!;
  const number = (value: number) => value.toLocaleString(language === "fi" ? "fi-FI" : "en-GB", { maximumFractionDigits: 1 });
  const description = observed.length === 1
    ? `${label} · ${language === "fi" ? "1 otteluhavainto, trendi muodostuu datan karttuessa" : "1 game value; the trend will appear as more data is added"}`
    : `${label} · ${observed.length} ${language === "fi" ? "otteluhavaintoa, uusin oikealla" : "game values, latest on the right"}`;

  return <svg className="metric-sparkline" style={color ? { color } : undefined} viewBox="0 0 100 34" preserveAspectRatio="none" role="img" aria-label={description}>
    {areaPath && <path className="metric-sparkline-area" d={areaPath} />}
    {linePath && <path className="metric-sparkline-line" d={linePath} />}
    <circle className="metric-sparkline-latest" cx={latest.x} cy={y(latest.value)} r="2.2"><title>{language === "fi" ? "Uusin" : "Latest"}: {number(latest.value)}</title></circle>
  </svg>;
}
