import { useSeason } from "./SeasonContext";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { playerDisplayName } from "./playerName";
import { useI18n } from "./i18n";
import { eventAtTime, parseReplay, replayIndex, replayMoments, type Replay, type ReplayEvent } from "./replayStats";

export function useMatchReplay(matchId: string, seasonId: string, enabled = true) {
  const { assetPath } = useSeason();
  const [data, setData] = useState<Replay | null>(null);
  const [status, setStatus] = useState("loading");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading"); setData(null);
    if (!enabled) return;
    void fetch(assetPath(`replays/${encodeURIComponent(matchId)}.json`), { signal: controller.signal }).then(async response => {
      if (response.status === 404) { if (!controller.signal.aborted) setStatus("missing"); return null; }
      if (!response.ok) throw new Error("Replay unavailable");
      return parseReplay(await response.json(), matchId, seasonId);
    }).then(replay => { if (replay && !controller.signal.aborted) { setData(replay); setStatus("ready"); } }).catch(() => { if (!controller.signal.aborted) setStatus("error"); });
    return () => controller.abort();
  }, [matchId, seasonId, retry, enabled, assetPath]);
  return { data, status, retry: () => setRetry(value => value + 1) };
}

export function MatchReplay({ matchId, state, seek }: { matchId: string; state: ReturnType<typeof useMatchReplay>; seek?: { index: number; request: number } | null }) {
  const { tr } = useI18n();
  const { data, status } = state;
  const [index, setIndex] = useState(0);
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(20);
  const [width, setWidth] = useState(600);
  const chart = useRef<HTMLDivElement>(null);
  const time = useRef(0);
  useEffect(() => {
    setPlaying(false);
    if (!data) return;
    const initial = replayIndex(new URLSearchParams(location.search).get("replay"), data.events.length);
    setIndex(initial); time.current = data.events[initial].elapsed; setPosition(time.current);
  }, [data]);
  useEffect(() => {
    if (!chart.current) return;
    const observer = new ResizeObserver(entries => setWidth(Math.max(240, entries[0].contentRect.width)));
    observer.observe(chart.current); return () => observer.disconnect();
  }, [data]);
  useEffect(() => {
    if (!data || playing) return;
    const timer = window.setTimeout(() => { const url = new URL(location.href); if (index) url.searchParams.set("replay", String(index)); else url.searchParams.delete("replay"); history.replaceState(history.state, "", url); }, 200);
    return () => window.clearTimeout(timer);
  }, [index, data, playing]);
  useEffect(() => {
    if (!data) return;
    const back = () => { const next = replayIndex(new URLSearchParams(location.search).get("replay"), data.events.length); setIndex(next); time.current = data.events[next].elapsed; setPosition(time.current); setPlaying(false); };
    window.addEventListener("popstate", back); return () => window.removeEventListener("popstate", back);
  }, [data]);
  useEffect(() => {
    if (!playing || !data) return;
    const timer = window.setInterval(() => { time.current = Math.min(data.duration, time.current + speed / 10); setPosition(time.current); setIndex(eventAtTime(data.events, time.current)); if (time.current >= data.duration) setPlaying(false); }, 100);
    const hide = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener("visibilitychange", hide);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", hide); };
  }, [playing, data, speed]);
  useEffect(() => {
    if (!data || !seek) return;
    const next = Math.max(0, Math.min(data.events.length - 1, seek.index));
    setPlaying(false); setIndex(next); time.current = data.events[next].elapsed; setPosition(time.current);
  }, [data, seek]);
  const choose = (next: number) => { if (!data) return; const bounded = Math.max(0, Math.min(data.events.length - 1, next)); setPlaying(false); setIndex(bounded); time.current = data.events[bounded].elapsed; setPosition(time.current); };
  const chooseTime = (seconds: number) => { if (!data) return; setPlaying(false); time.current = seconds; setPosition(seconds); setIndex(eventAtTime(data.events, seconds)); };
  const clock = (event: ReplayEvent) => `${event.period <= 4 ? `${event.period}. ${tr("neljännes", "quarter")}` : `${tr("Jatkoaika", "Overtime")} ${event.period - 4}`} · ${Math.floor(event.remaining / 60)}:${String(Math.floor(event.remaining % 60)).padStart(2, "0")}`;
  const describe = (event: ReplayEvent) => {
    const labels: Record<string, string> = { start: tr("Ottelu alkaa", "Game starts"), periodEnd: tr("Jakson loppu", "Period ends"), "2pt": tr("Kahden pisteen heitto", "Two-point shot"), "3pt": tr("Kolmen pisteen heitto", "Three-point shot"), freeThrow: tr("Vapaaheitto", "Free throw"), assist: tr("Koriin johtanut syöttö", "Assist"), rebound: tr("Levypallo", "Rebound"), steal: tr("Riisto", "Steal"), block: tr("Torjunta", "Block"), turnover: tr("Menetys", "Turnover"), foul: tr("Virhe", "Foul"), substitution: tr("Vaihto", "Substitution"), timeOut: tr("Aikalisä", "Timeout"), jumpBall: tr("Ylösheitto", "Jump ball") };
    return `${labels[event.kind] ?? tr("Pelitapahtuma", "Game event")}${["2pt", "3pt", "freeThrow"].includes(event.kind) ? event.made ? ` · ${tr("osuma", "made")}` : ` · ${tr("ohi", "missed")}` : ""}`;
  };
  if (!data) return <section id="match-replay" className="panel replay-panel overview-section-anchor"><h2>{tr("Kelaa ottelun tarinaa", "Explore the game timeline")}</h2><p role="status">{status === "loading" ? tr("Ladataan tapahtumia…", "Loading events…") : status === "missing" ? tr("Tähän otteluun ei ole vielä tarkistettua tapahtumalokia.", "A verified event log is not yet available for this game.") : tr("Tapahtumia ei voitu ladata.", "Could not load events.")}</p>{status === "error" && <button type="button" onClick={state.retry}>{tr("Yritä uudelleen", "Retry")}</button>}</section>;
  const event = data.events[Math.min(index, data.events.length - 1)], moments = replayMoments(data);
  const period = data.periods.find(item => position < item.end) ?? data.periods[data.periods.length - 1];
  const selectedClock = clock({ ...event, period: period.number, remaining: period.end - position });
  const padding = { left: 35, right: 12, top: 18, bottom: 32 }, height = width < 500 ? 185 : 220;
  const extent = Math.max(5, ...data.events.map(item => Math.abs(item.home - item.away)));
  const x = (seconds: number) => padding.left + seconds / data.duration * (width - padding.left - padding.right);
  const y = (margin: number) => padding.top + (extent - margin) / (extent * 2) * (height - padding.top - padding.bottom);
  const scoring = data.events.filter(item => item.points || item.kind === "start" || item.kind === "periodEnd");
  const path = (events: ReplayEvent[]) => events.map((item, n) => `${n ? "H" : "M"}${x(item.elapsed)}${n ? `V${y(item.home - item.away)}` : `,${y(item.home - item.away)}`}`).join(" ");
  const progress = [...scoring.filter(item => data.events.indexOf(item) <= index)];
  progress.push({ ...event, elapsed: position });
  const visible = data.events.map((item, n) => ({ item, n })).filter(({ item }) => item.points || ["turnover", "steal", "block", "timeOut", "periodEnd", "start"].includes(item.kind));
  const active = Math.max(0, visible.reduce((last, item, n) => item.n <= index ? n : last, 0));
  return <section id="match-replay" className="panel replay-panel overview-section-anchor" tabIndex={-1} aria-labelledby="replay-heading">
    <div className="panel-heading panel-heading--plain"><div><h2 id="replay-heading">{tr("Kelaa ottelun tarinaa", "Explore the game timeline")}</h2><p className="panel-subcopy">{tr("Milloin peli kääntyi? Valitse hetki tai toista ottelun kulku.", "When did the game turn? Select a moment or play through the game.")}</p></div><span className="replay-coverage">{data.event_count} {tr("tarkistettua tapahtumaa", "verified events")}</span></div>
    <div className="replay-score" aria-live={playing ? "off" : "polite"}>
      <div className="replay-home"><span>{data.teams[0].name}<small>{tr("koti", "home")}</small></span></div>
      <div className="replay-center"><span>{tr("Tilanne valitulla hetkellä", "Score at selected moment")}</span><div className="replay-points"><strong>{event.home}</strong><span>–</span><strong>{event.away}</strong></div><strong className="replay-clock">{selectedClock}</strong></div>
      <div className="replay-away"><span>{data.teams[1].name}<small>{tr("vieras", "away")}</small></span></div>
    </div>
    <div className="replay-legend"><span className="replay-home">{data.teams[0].name} {tr("johdossa", "leading")}</span><span className="replay-away">{data.teams[1].name} {tr("johdossa", "leading")}</span></div>
    <div ref={chart} className="replay-chart"><svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label={tr(`Piste-ero ottelun aikana. Valittu tilanne ${event.home} - ${event.away}.`, `Score margin during the game. Selected score ${event.home} - ${event.away}.`)}>
      <defs><clipPath id={`replay-home-${matchId}`}><rect x="0" y="0" width={width} height={y(0)} /></clipPath><clipPath id={`replay-away-${matchId}`}><rect x="0" y={y(0)} width={width} height={height - y(0)} /></clipPath></defs>
      {[extent, 0, -extent].map(margin => <g key={margin}><line className={margin ? "replay-grid" : "replay-zero"} x1={padding.left} x2={width - padding.right} y1={y(margin)} y2={y(margin)} /><text x={padding.left - 8} y={y(margin) + 4} textAnchor="end">{margin > 0 ? `+${margin}` : margin}</text></g>)}
      {data.periods.map(period => <g key={period.number}><line className="replay-grid" x1={x(period.end)} x2={x(period.end)} y1={padding.top} y2={height - padding.bottom} /><text x={x((period.start + period.end) / 2)} y={height - 9} textAnchor="middle">{period.number <= 4 ? `${period.number}.` : `OT${period.number - 4}`}</text></g>)}
      <path d={path(scoring)} className="replay-full" /><path d={path(progress)} className="replay-line replay-line--home" clipPath={`url(#replay-home-${matchId})`} /><path d={path(progress)} className="replay-line replay-line--away" clipPath={`url(#replay-away-${matchId})`} />
      <line className="replay-cursor" x1={x(position)} x2={x(position)} y1={padding.top} y2={height - padding.bottom} /><circle cx={x(position)} cy={y(event.home - event.away)} r="4" className={event.home >= event.away ? "replay-dot--home" : "replay-dot--away"} />
    </svg></div>
    <label className="replay-range"><span className="sr-only">{tr("Ottelun aikajana", "Game timeline")}</span><input type="range" min={0} max={data.duration} step={1} value={position} aria-valuetext={`${selectedClock} · ${event.home} - ${event.away}`} onChange={e => chooseTime(Number(e.target.value))} /></label>
    <div className="replay-controls"><div className="replay-transport"><button type="button" aria-label={tr("Edellinen tapahtuma", "Previous event")} disabled={index === 0} onClick={() => choose(index - 1)}><Icon name="previous" /></button><button type="button" className="replay-play" onClick={() => { if (index === data.events.length - 1) { setIndex(0); time.current = 0; setPosition(0); } setPlaying(value => !value); }}><Icon name={playing ? "pause" : "play"} />{playing ? tr("Pysäytä", "Pause") : tr("Toista", "Play")}</button><button type="button" aria-label={tr("Seuraava tapahtuma", "Next event")} disabled={index === data.events.length - 1} onClick={() => choose(index + 1)}><Icon name="next" /></button><label><span className="sr-only">{tr("Toistonopeus", "Playback speed")}</span><select aria-label={tr("Toistonopeus", "Playback speed")} value={speed} onChange={e => setSpeed(Number(e.target.value))}><option value={20}>20×</option><option value={40}>40×</option><option value={80}>80×</option></select></label></div><div className="replay-jumps">{data.periods.map(period => <button key={period.number} type="button" onClick={() => choose(period.start === 0 ? 0 : eventAtTime(data.events, period.start))}>{period.number <= 4 ? `${period.number}. ${tr("nelj.", "Q")}` : `OT${period.number - 4}`}</button>)}<button type="button" onClick={() => choose(eventAtTime(data.events, data.duration - 120))}>{tr("Viimeiset 2 min", "Last 2 min")}</button><button type="button" onClick={() => choose(data.events.length - 1)}>{tr("Loppu", "End")}</button></div></div>
    <div className="replay-bottom"><div className="replay-moments"><h3>{tr("Ottelun käännekohdat", "Game turning points")}</h3><p>{moments.changes} {tr("johdon vaihtumista", "lead changes")}</p>{[{ n: moments.biggestHome, label: data.teams[0].name }, { n: moments.biggestAway, label: data.teams[1].name }].map(({ n, label }) => <button key={label} type="button" onClick={() => choose(n)}><span>{label} · {tr("suurin johto", "largest lead")}</span><strong>{Math.abs(data.events[n].home - data.events[n].away)}</strong><Icon name="arrowOutward" size={15} /></button>)}{moments.lastChange > 0 && <button type="button" onClick={() => choose(moments.lastChange)}>{tr("Viimeinen johdon vaihto", "Last lead change")}<Icon name="arrowOutward" size={15} /></button>}</div><div className="replay-events"><h3>{tr("Tapahtumat valitun hetken lähellä", "Events near the selected moment")}</h3><ol>{visible.slice(Math.max(0, active - 2), active + 3).map(({ item, n }) => <li key={item.id}><button type="button" aria-current={n === visible[active]?.n ? "step" : undefined} onClick={() => choose(n)}><time>{clock(item)}</time><span><strong>{item.player ? playerDisplayName(item.player) : data.teams.find(team => team.id === item.team_id)?.name ?? describe(item)}</strong>{item.player && <small>{describe(item)}</small>}</span><b className={item.team_id === data.teams[0].id ? "replay-home" : "replay-away"}>{item.home} - {item.away}</b></button></li>)}</ol></div></div>
    <p className="replay-method">{tr("Kuvaaja näyttää piste-eron, ei pelaajien liikettä. Toisto nopeuttaa pelikelloa. Samalla kellonlyömällä olevat tapahtumat voi tutkia yksitellen nuolipainikkeilla.", "The chart shows score margin, not player movement. Playback speeds up the game clock. Use the step buttons to inspect events sharing a timestamp.")}</p>
  </section>;
}
