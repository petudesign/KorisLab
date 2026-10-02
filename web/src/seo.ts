import { useEffect } from "react";
import { useSeason } from "./SeasonContext";

export function usePageMetadata(title: string, description: string, { noindex = false, enabled = true } = {}) {
  const { leagueId, seasonId } = useSeason();
  useEffect(() => {
    if (!enabled) return;
    document.title = `${title} | KorisLab`;
    const setMeta = (name: string, value: string) => {
      let element = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      if (!element) { element = document.createElement("meta"); element.name = name; document.head.append(element); }
      element.content = value;
    };
    setMeta("description", description);
    setMeta("robots", noindex ? "noindex,follow" : "index,follow");
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.append(canonical); }
    const url = new URL(window.location.href);
    url.pathname = url.pathname.replace(/\/?$/, "/");
    url.search = ""; // Chart filters share the underlying game's canonical page.
    url.searchParams.set("season", seasonId);
    if (leagueId === "korisliiga") url.searchParams.set("league", leagueId);
    url.hash = "";
    canonical.href = url.href;
  }, [title, description, noindex, enabled, seasonId, leagueId]);
}
