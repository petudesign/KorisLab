import { useEffect, useState } from "react";
import { MetalFx } from "metal-fx";
import { ThinkingOrb } from "thinking-orbs";
import { Icon } from "./Icon";
import { useI18n } from "./i18n";
import { useSeason } from "./SeasonContext";
import type { QueryFeedback, QueryTarget } from "./basketballQuery";

type SearchMode = "hero" | "topbar";
export function QuerySearch({
  mode,
  value,
  busy,
  theme,
  result,
  onChange,
  onSubmit,
  onAction,
}: {
  mode: SearchMode;
  value: string;
  busy: boolean;
  theme: "dark" | "light";
  result: QueryFeedback | null;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onAction: (target: QueryTarget) => void;
}) {
  const { language, tr } = useI18n();
  const { leagueId } = useSeason();
  const [reducedMotion, setReducedMotion] = useState(false);
  const inputId = `query-search-${mode}`;
  const submitButton = <button className="query-search-submit" type="submit" disabled={busy || !value.trim()} aria-label={tr("Hae", "Search")} title={tr("Hae", "Search")}>
    {busy
      ? <ThinkingOrb state="working" size={20} theme={theme} aria-label={tr("Haku käynnissä", "Search in progress")} />
      : <Icon name="arrowOutward" size={mode === "topbar" ? 15 : 17} />}
  </button>;

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(preference.matches);
    sync();
    preference.addEventListener("change", sync);
    return () => preference.removeEventListener("change", sync);
  }, []);

  return <div className={`query-search query-search--${mode}`}>
    <form className="query-search-field" role="search" onSubmit={(event) => { event.preventDefault(); onSubmit(value); }} aria-busy={busy}>
      <label className="sr-only" htmlFor={inputId}>{tr("Hae joukkuetta tai pelaajaa tai kysy sarjasta", "Search for a team or player, or ask about the league")}</label>
      <input
        id={inputId}
        type="search"
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={mode === "hero"
          ? leagueId === "korisliiga" ? tr("Esim. Kouvot tai kuka voitti kauden 2025–26?", "For example, Kouvot or who won the 2025–26 season?") : tr("Esim. ToPo tai kuka voitti kauden 2025–26?", "For example, ToPo or who won the 2025–26 season?")
          : tr("Hae tai kysy…", "Search or ask…")}
      />
      <MetalFx variant="circle" preset="chromatic" strength={1} theme={theme} paused={busy || reducedMotion} disableGlow className="query-search-metal">
        {submitButton}
      </MetalFx>
    </form>
    {result && <div className={`query-search-result query-search-result--${result.tone}`} role="status" aria-live="polite">
      <strong>{result.title}</strong>
      <p>{result.detail}</p>
      {result.actions?.length ? <div className="query-search-actions">{result.actions.map((action) => <button type="button" key={`${action.label}-${action.target.view}-${action.target.season}-${action.target.id ?? action.target.teamId ?? ""}`} onClick={() => onAction(action.target)}>{action.label}<Icon name="arrowOutward" size={14} /></button>)}</div> : null}
    </div>}
  </div>;
}
