export type LeagueId = "naisten-korisliiga" | "korisliiga";
export const leagueIds: LeagueId[] = ["naisten-korisliiga", "korisliiga"];
export const leagueRouteSlugs: Record<LeagueId, string> = {
  "naisten-korisliiga": "korisliiga-women",
  korisliiga: "korisliiga",
};
export function leagueFromRouteSlug(slug: string | undefined): LeagueId | undefined {
  return leagueIds.find(id => id === slug || leagueRouteSlugs[id] === slug);
}
export const leagues = {
  "naisten-korisliiga": {
    name: "Naisten Korisliiga", nameEn: "Women's Korisliiga", categoryId: "1",
    currentCompetition: "huki2627", currentGroup: "303031", assetPrefix: "",
    decidingFinals: { "2024-25": "965824", "2025-26": "1003919" },
    featuredFinal: { id: "1003919", home: "HBA-Märsky", away: "Peli-Karhut", homeScore: 71, awayScore: 72 },
  },
  korisliiga: {
    name: "Korisliiga", nameEn: "Korisliiga", categoryId: "4",
    currentCompetition: "huki2627", currentGroup: "303022", assetPrefix: "/korisliiga",
    decidingFinals: { "2024-25": "965763", "2025-26": "1004241" },
    featuredFinal: { id: "1004241", home: "Salon Vilpas", away: "Kataja Basket", homeScore: 100, awayScore: 69 },
  },
} as const;
export function leagueAssetPath(league: LeagueId, filename: string) {
  return `${leagues[league].assetPrefix}/${filename}`;
}
