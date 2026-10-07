import type { Replay } from "./replayStats";

export type StoryMoment = { kind: "run" | "lead" | "finish"; start: number; end: number; team: number; scored: number; allowed: number };

/** Short scoring stretches, a lead never surrendered (including ties), and the final two minutes. */
export function matchStory(replay: Replay): StoryMoment[] {
  const { events } = replay;
  const last = events[events.length - 1];
  const winner = last.home >= last.away ? 0 : 1;
  const score = (index: number, team: number) => team === 0 ? events[index].home : events[index].away;
  const moments: StoryMoment[] = [];
  let best: StoryMoment | undefined;
  // Start immediately before a scoring event; end at a scoring event within three game minutes.
  for (let start = 1; start < events.length; start++) {
    if (!events[start].points) continue;
    for (let end = start; end < events.length && events[end].elapsed - events[start].elapsed <= 180; end++) {
      if (!events[end].points) continue;
      const home = events[end].home - events[start - 1].home;
      const away = events[end].away - events[start - 1].away;
      const team = home >= away ? 0 : 1;
      const scored = Math.max(home, away), allowed = Math.min(home, away);
      const duration = events[end].elapsed - events[start].elapsed;
      const bestDuration = best ? events[best.end].elapsed - events[best.start + 1].elapsed : Infinity;
      if (!best || scored - allowed > best.scored - best.allowed ||
        (scored - allowed === best.scored - best.allowed && duration < bestDuration)) {
        best = { kind: "run", start: start - 1, end, team, scored, allowed };
      }
    }
  }
  if (best && best.scored - best.allowed >= 6) moments.push(best);
  if (last.home !== last.away) {
    let lead = events.length - 1;
    while (lead > 0 && score(lead - 1, winner) > score(lead - 1, 1 - winner)) lead--;
    moments.push({ kind: "lead", start: Math.max(0, lead - 1), end: lead, team: winner, scored: score(lead, winner), allowed: score(lead, 1 - winner) });
  }
  // Include all events at the cutoff, even when several share the same clock.
  const cutoff = replay.duration - 120;
  const first = events.findIndex(event => event.elapsed >= cutoff);
  const start = Math.max(0, first - 1);
  moments.push({ kind: "finish", start, end: events.length - 1, team: winner,
    scored: score(events.length - 1, winner) - score(start, winner),
    allowed: score(events.length - 1, 1 - winner) - score(start, 1 - winner) });
  return moments;
}

export function storyContributors(replay: Replay, moment: StoryMoment) {
  const players = new Map<string, { name: string; points: number; assists: number }>();
  for (const event of replay.events.slice(moment.start + 1, moment.end + 1)) {
    if (event.team_id !== replay.teams[moment.team].id || !event.player || (!event.points && event.kind !== "assist")) continue;
    const player = players.get(event.player) ?? { name: event.player, points: 0, assists: 0 };
    player.points += event.points;
    if (event.kind === "assist") player.assists++;
    players.set(event.player, player);
  }
  return [...players.values()].sort((a, b) => b.points - a.points || b.assists - a.assists).slice(0, 3);
}
