import { useEffect } from "react";
import { useSeason } from "./SeasonContext";

type PageMetadataOptions = { noindex?: boolean; enabled?: boolean; structuredData?: Record<string, unknown> | null };

export function usePageMetadata(title: string, description: string, { noindex = false, enabled = true, structuredData = null }: PageMetadataOptions = {}) {
  const { leagueId, seasonId } = useSeason();
  const structuredDataJson = structuredData ? JSON.stringify(structuredData) : null;
  useEffect(() => {
    if (!enabled) return;
    document.title = `${title} | KorisLab`;
    const setMeta = (name: string, value: string) => {
      let element = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      if (!element) { element = document.createElement("meta"); element.name = name; document.head.append(element); }
      element.content = value;
    };
    const setPropertyMeta = (property: string, value: string) => {
      let element = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
      if (!element) { element = document.createElement("meta"); element.setAttribute("property", property); document.head.append(element); }
      element.content = value;
    };
    setMeta("description", description);
    setMeta("robots", noindex ? "noindex,follow" : "index,follow");
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.append(canonical); }
    const url = new URL(window.location.href);
    url.pathname = url.pathname.replace(/\/?$/, "/");
    if (/^\/matches\/\d+\/data\/$/.test(url.pathname)) url.pathname = url.pathname.replace(/data\/$/, "");
    url.search = ""; // Chart filters share the underlying game's canonical page.
    url.searchParams.set("season", seasonId);
    if (leagueId === "korisliiga") url.searchParams.set("league", leagueId);
    url.hash = "";
    canonical.href = url.href;
    setPropertyMeta("og:type", "website");
    setPropertyMeta("og:title", title);
    setPropertyMeta("og:description", description);
    setPropertyMeta("og:url", url.href);
    setMeta("twitter:card", "summary");
    setMeta("twitter:title", title);
    setMeta("twitter:description", description);
    document.head.querySelector('meta[property="og:image"]')?.remove();
    document.head.querySelector('meta[name="twitter:image"]')?.remove();
    let structuredDataScript = document.head.querySelector<HTMLScriptElement>('script[data-page-structured-data]');
    if (structuredDataJson) {
      if (!structuredDataScript) {
        structuredDataScript = document.createElement("script");
        structuredDataScript.type = "application/ld+json";
        structuredDataScript.dataset.pageStructuredData = "true";
        document.head.append(structuredDataScript);
      }
      structuredDataScript.textContent = structuredDataJson;
    } else {
      structuredDataScript?.remove();
    }
  }, [title, description, noindex, enabled, seasonId, leagueId, structuredDataJson]);
}
