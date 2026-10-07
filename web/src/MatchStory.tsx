import { useMemo } from "react";
import { useI18n } from "./i18n";
import { playerDisplayName } from "./playerName";
import { matchStory, storyContributors } from "./matchStory";
import type { Replay, ReplayEvent } from "./replayStats";

export function MatchStory({ replay, onSelect }: { replay: Replay; onSelect: (index: number) => void }) {
  const { tr } = useI18n();
  const moments = useMemo(() => matchStory(replay), [replay]);
  const clock = (event: ReplayEvent) => `${event.period <= 4 ? `${event.period}. ${tr("neljännes", "quarter")}` : `OT${event.period - 4}`} · ${Math.floor(event.remaining / 60)}:${String(event.remaining % 60).padStart(2, "0")}`;
  return <div className="insight-list">
    {moments.map((moment, index) => {
      const team = replay.teams[moment.team].name;
      const first = replay.events[moment.start + 1];
      const end = replay.events[moment.end];
      const contributors = storyContributors(replay, moment);
      const title = moment.kind === "run"
        ? tr(`${team}: ${moment.scored}–${moment.allowed}-jakso`, `${team}: a ${moment.scored}–${moment.allowed} stretch`)
        : moment.kind === "lead"
          ? tr(`${team} johtoon pysyvästi`, `${team} took the lead for good`)
          : tr(`Viimeiset kaksi minuuttia ${moment.scored}–${moment.allowed}`, `Final two minutes: ${moment.scored}–${moment.allowed}`);
      const body = moment.kind === "run"
        ? tr(`Ottelun suurin piste-eron kasvu enintään kolmen minuutin jaksolla. ${clock(first)} → ${clock(end)}. Tilanne ${replay.events[moment.start].home}–${replay.events[moment.start].away} → ${end.home}–${end.away}.`, `The largest scoring advantage over a stretch of up to three minutes. ${clock(first)} → ${clock(end)}. Score ${replay.events[moment.start].home}–${replay.events[moment.start].away} → ${end.home}–${end.away}.`)
        : moment.kind === "lead"
          ? tr(`${clock(end)}: ${end.home}–${end.away}. Tämän korin jälkeen ${team} pysyi johdossa loppuun asti.`, `${clock(end)}: ${end.home}–${end.away}. After this basket, ${team} stayed ahead until the end.`)
          : tr(`${team} teki ${moment.scored} pistettä ja vastustaja ${moment.allowed}. Lopputulos ${end.home}–${end.away}${end.period > 4 ? " jatkoajan jälkeen" : ""}.`, `${team} scored ${moment.scored} points and their opponent ${moment.allowed}. Final score ${end.home}–${end.away}${end.period > 4 ? " after overtime" : ""}.`);
      return <article className="insight" key={moment.kind}>
        <div className={`insight-index ${["mint", "amber", "coral"][index]}`}>0{index + 1}</div>
        <div><span className="insight-eyebrow">{moment.kind === "run" ? tr("Vahvin pistejakso", "Strongest scoring stretch") : moment.kind === "lead" ? tr("Johtoonmeno", "Taking the lead") : tr("Loppuhetket", "Closing minutes")}</span>
          <h4>{title}</h4><p>{body}</p>
          {moment.kind !== "lead" && contributors.length > 0 && <p>{tr("Jakson tekijät", "Contributors in this stretch")}: {contributors.map(player => `${playerDisplayName(player.name)} ${player.points} ${tr("p", "pts")}${player.assists ? `, ${player.assists} ${tr("s", "ast")}` : ""}`).join(" · ")}</p>}
          <button className="outline-button" type="button" onClick={() => onSelect(moment.kind === "lead" ? moment.end : moment.start)}>{tr("Avaa kohta aikajanalla", "Open moment on timeline")}</button>
        </div>
      </article>;
    })}
    <p className="replay-method">{tr("Havainnot lasketaan tarkistetusta tapahtumalokista. Pistejaksot voivat ylittää neljännesrajan; tekijöissä näkyy enintään kolme pelaajaa ja jaksolle kirjatut syötöt. Vahvin pistejakso ei välttämättä ratkaissut ottelua.", "Observations use the verified event log. Stretches can cross quarter boundaries; contributors show up to three players and assists recorded within the stretch. The strongest scoring stretch did not necessarily decide the game.")}</p>
  </div>;
}
