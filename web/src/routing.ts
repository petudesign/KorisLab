import { useCallback, useEffect, useState, type MouseEvent } from "react";
import type { ViewKey } from "./data";
import { leagueFromRouteSlug, leagueRouteSlugs, type LeagueId } from "./leagues";
import type { SeasonId } from "./SeasonContext";

export type AppRoute = { view: ViewKey; matchId?: string; playerId?: string; teamId?: string; articleSlug?: string; askQuery?: string; season?: SeasonId; league?: LeagueId };
const paths: Partial<Record<ViewKey, string>> = {
  home: "/", overview: "/overview/", matches: "/matches/", teams: "/teams/",
  players: "/players/", season: "/season/", data: "/data/", matchup: "/matchup/", analyses: "/analyysit/", ask: "/ask/", "custom-import": "/custom-import/",
};

export function teamSlug(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fi-FI")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function parseRoute(pathname: string, search = ""): AppRoute {
  const seasonValue = new URLSearchParams(search).get("season");
  const season: SeasonId | undefined = seasonValue === "2024-25" || seasonValue === "2025-26" || seasonValue === "2026-27" ? seasonValue : undefined;
  const leagueValue = new URLSearchParams(search).get("league");
  const scope = { season, ...(leagueValue === "korisliiga" ? { league: "korisliiga" as const } : {}) };
  const path = pathname.replace(/\/+$/, "") || "/";
  const page = Object.entries(paths).find(([, value]) => (value?.replace(/\/+$/, "") || "/") === path);
  if (page) return { view: page[0] as ViewKey, ...(page[0] === "ask" ? { askQuery: new URLSearchParams(search).get("q") ?? "" } : {}), ...scope };
  const ask = path.match(/^\/ask\/([^/]+)$/);
  if (ask) {
    try { return { view: "ask", askQuery: new URLSearchParams(search).get("q") ?? decodeURIComponent(ask[1]).replaceAll("-", " "), ...scope }; }
    catch { return { view: "not-found", ...scope }; }
  }
  const team = path.match(/^\/teams\/([^/]+)(?:\/([^/]+))?$/);
  if (team) {
    try {
      const pathLeague = team[2] ? leagueFromRouteSlug(team[1]) : undefined;
      if (team[2] && !pathLeague) return { view: "not-found", ...scope };
      const token = decodeURIComponent(pathLeague ? team[2] : team[1]);
      return { view: "teams", teamId: token, ...scope, ...(pathLeague ? { league: pathLeague } : {}) };
    }
    catch { return { view: "not-found", ...scope }; }
  }
  const player = path.match(/^\/players\/([^/]+)$/);
  if (player) {
    try { return { view: "player-profile", playerId: decodeURIComponent(player[1]), ...scope }; }
    catch { return { view: "not-found", ...scope }; }
  }
  const article = path.match(/^\/analyysit\/([^/]+)$/);
  if (article) {
    try { return { view: "analysis-article", articleSlug: decodeURIComponent(article[1]), ...scope }; }
    catch { return { view: "not-found", ...scope }; }
  }
  const match = path.match(/^\/matches\/(\d+)(?:\/(players|data))?$/);
  if (match) return { view: match[2] === "data" ? "data" : "story", matchId: match[1], ...scope };
  return { view: "not-found", ...scope };
}

export function routeHref(view: ViewKey, season: SeasonId, id?: string, league: LeagueId = "naisten-korisliiga", teamName?: string) {
  const askSlug = view === "ask" && id ? id.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fi-FI").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90) : "";
  const path = view === "ask" && askSlug ? `/ask/${askSlug}/`
    : view === "player-profile" && id ? `/players/${encodeURIComponent(id)}/`
    : view === "teams" && id && teamName ? `/teams/${leagueRouteSlugs[league]}/${encodeURIComponent(teamSlug(teamName))}/`
    : view === "teams" && id ? `/teams/${encodeURIComponent(id)}/`
    : view === "analysis-article" && id ? `/analyysit/${encodeURIComponent(id)}/`
    : ["story", "data"].includes(view) && id ? `/matches/${encodeURIComponent(id)}/${view === "data" ? "data/" : ""}`
    : paths[view] ?? "/404/";
  const query = new URLSearchParams({ season });
  if (league === "korisliiga") query.set("league", league);
  if (view === "ask" && id) query.set("q", id);
  return `${path}?${query.toString()}`;
}

export function followLink(event: MouseEvent<HTMLAnchorElement>, navigate: () => void) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate();
}

export function useAppRoute(season: SeasonId, league: LeagueId = "naisten-korisliiga") {
  const read = () => parseRoute(window.location.pathname, window.location.search);
  const [route, setRoute] = useState<AppRoute>(read);
  useEffect(() => {
    const back = () => setRoute(read());
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, []);
  const navigate = useCallback((view: ViewKey, id?: string, targetSeason = season, targetLeague = league, replace = false, teamName?: string) => {
    const href = routeHref(view, targetSeason, id, targetLeague, teamName);
    if (window.location.pathname + window.location.search !== href) {
      if (replace) window.history.replaceState(null, "", href);
      else window.history.pushState(null, "", href);
    }
    setRoute(read());
  }, [season, league]);
  return { route, navigate };
}
