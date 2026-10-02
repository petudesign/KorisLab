import { useCallback, useEffect, useState, type MouseEvent } from "react";
import type { ViewKey } from "./data";
import type { SeasonId } from "./SeasonContext";

export type AppRoute = { view: ViewKey; matchId?: string; playerId?: string; season?: SeasonId };
const paths: Partial<Record<ViewKey, string>> = {
  home: "/", overview: "/overview/", matches: "/matches/", teams: "/teams/",
  players: "/players/", season: "/season/", data: "/data/",
};

export function parseRoute(pathname: string, search = ""): AppRoute {
  const seasonValue = new URLSearchParams(search).get("season");
  const season = seasonValue === "2025-26" || seasonValue === "2026-27" ? seasonValue : undefined;
  const path = pathname.replace(/\/+$/, "") || "/";
  const page = Object.entries(paths).find(([, value]) => (value?.replace(/\/+$/, "") || "/") === path);
  if (page) return { view: page[0] as ViewKey, season };
  const player = path.match(/^\/players\/([^/]+)$/);
  if (player) {
    try { return { view: "player-profile", playerId: decodeURIComponent(player[1]), season }; }
    catch { return { view: "not-found", season }; }
  }
  const match = path.match(/^\/matches\/(\d+)(?:\/(players|data))?$/);
  if (match) return { view: match[2] === "players" ? "player-detail" : match[2] === "data" ? "data" : "story", matchId: match[1], season };
  return { view: "not-found", season };
}

export function routeHref(view: ViewKey, season: SeasonId, id?: string) {
  const path = view === "player-profile" && id ? `/players/${encodeURIComponent(id)}/`
    : ["story", "player-detail", "data"].includes(view) && id ? `/matches/${encodeURIComponent(id)}/${view === "player-detail" ? "players/" : view === "data" ? "data/" : ""}`
    : paths[view] ?? "/404/";
  return `${path}?season=${season}`;
}

export function followLink(event: MouseEvent<HTMLAnchorElement>, navigate: () => void) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate();
}

export function useAppRoute(season: SeasonId) {
  const read = () => parseRoute(window.location.pathname, window.location.search);
  const [route, setRoute] = useState<AppRoute>(read);
  useEffect(() => {
    const back = () => setRoute(read());
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, []);
  const navigate = useCallback((view: ViewKey, id?: string, targetSeason = season) => {
    const href = routeHref(view, targetSeason, id);
    if (window.location.pathname + window.location.search !== href) window.history.pushState(null, "", href);
    setRoute(read());
  }, [season]);
  return { route, navigate };
}
