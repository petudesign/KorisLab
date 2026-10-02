export type ReplayEvent = { id: string; elapsed: number; period: number; remaining: number; kind: string; subtype?: string; made?: boolean; team_id: string | null; player: string | null; points: number; home: number; away: number };
export type Replay = { schema_version: string; match_id: string; season_id: string; verified: boolean; event_count: number; duration: number; teams: { id: string; name: string; home: boolean }[]; periods: { number: number; start: number; end: number }[]; events: ReplayEvent[] };

export function parseReplay(value: unknown, matchId: string, seasonId: string): Replay {
  const data = value as Replay;
  if (!data || data.schema_version !== "0.1" || data.match_id !== matchId || data.season_id !== seasonId || data.verified !== true || !Array.isArray(data.events) || !data.events.length || !Array.isArray(data.teams) || data.teams.length !== 2 || data.teams[0].home !== true || data.teams[1].home !== false || data.teams[0].id === data.teams[1].id || !Number.isFinite(data.duration) || data.duration <= 0 || !Array.isArray(data.periods) || !data.periods.length) throw new Error("Invalid replay");
  const ids = new Set<string>();
  let elapsed = 0, home = 0, away = 0;
  for (const event of data.events) {
    if (!event || typeof event.id !== "string" || ids.has(event.id) || typeof event.kind !== "string" || !Number.isFinite(event.elapsed) || event.elapsed < elapsed || event.elapsed > data.duration || !Number.isFinite(event.remaining) || event.remaining < 0 || !Number.isInteger(event.period) || event.period < 1 || !Number.isInteger(event.home) || !Number.isInteger(event.away) || event.home < home || event.away < away || ![0, 1, 2, 3].includes(event.points) || event.home - home + event.away - away !== event.points || event.points > 0 && !data.teams.some(team => team.id === event.team_id && (team.home ? event.home - home : event.away - away) === event.points)) throw new Error("Invalid replay event");
    ids.add(event.id); elapsed = event.elapsed; home = event.home; away = event.away;
  }
  if (data.events[0].elapsed !== 0 || data.events[0].home !== 0 || data.events[0].away !== 0 || elapsed !== data.duration) throw new Error("Incomplete replay");
  let end = 0;
  for (const period of data.periods) {
    if (period.start !== end || period.end - period.start !== (period.number <= 4 ? 600 : 300)) throw new Error("Invalid replay periods");
    end = period.end;
  }
  if (end !== data.duration) throw new Error("Incomplete replay periods");
  return data;
}

export function eventAtTime(events: ReplayEvent[], seconds: number) {
  let low = 0, high = events.length - 1;
  while (low < high) { const middle = Math.ceil((low + high) / 2); if (events[middle].elapsed <= seconds) low = middle; else high = middle - 1; }
  return low;
}

export function replayIndex(value: string | null, count: number) {
  return value && /^\d+$/.test(value) ? Math.min(count - 1, Number(value)) : 0;
}

export function replayMoments(replay: Replay) {
  let leader = 0, changes = 0, lastChange = 0, biggestHome = 0, biggestAway = 0;
  replay.events.forEach((event, index) => {
    const margin = event.home - event.away, next = Math.sign(margin);
    if (event.points && next) { if (leader && leader !== next) { changes++; lastChange = index; } leader = next; }
    if (margin > replay.events[biggestHome].home - replay.events[biggestHome].away) biggestHome = index;
    if (-margin > replay.events[biggestAway].away - replay.events[biggestAway].home) biggestAway = index;
  });
  return { changes, lastChange, biggestHome, biggestAway };
}
