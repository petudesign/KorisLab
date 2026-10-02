import { leagues, type LeagueId } from "./leagues.ts";
import type { SeasonMatchRecord, SeasonId } from "./SeasonContext";
import type { ViewKey } from "./data";
import { aggregateSeasonPlayers, type SeasonPlayerRow } from "./playerStats.ts";

export type QueryTarget = {
  view: ViewKey;
  season: SeasonId;
  id?: string;
  teamId?: string;
};

export type QueryAction = { label: string; target: QueryTarget };
export type QueryFeedback = {
  tone: "answer" | "notice" | "empty" | "success";
  title: string;
  detail: string;
  actions?: QueryAction[];
};

type TeamLookup = { source_team_id: string; name: string };
type PlayoffTeam = { source_id: string; name: string; score: number | null };
type PlayoffMatch = { game?: { source_id: string }; teams: PlayoffTeam[] };
type Language = "fi" | "en";

type ResolveOptions = {
  leagueId?: LeagueId;
  language: Language;
  seasonId: SeasonId;
  selectedSeasonTeams: TeamLookup[];
  historicalTeams: TeamLookup[];
  currentTeams: TeamLookup[];
  currentScheduleTeams: string[];
  loadMatches: (season: SeasonId) => Promise<SeasonMatchRecord[]>;
  loadPlayoffMatches: (season?: SeasonId) => Promise<PlayoffMatch[]>;
  historicalTeamsBySeason?: Partial<Record<SeasonId, { aggregate: { teams: TeamLookup[] } }>>;
};

export type QueryResolution = { feedback: QueryFeedback; navigate?: QueryTarget };

const normalize = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("fi-FI")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

function mentionedTeam(query: string, teams: TeamLookup[]) {
  const names = teams
    .map((team) => ({ team, name: normalize(team.name) }))
    .filter((entry) => entry.name && query.includes(entry.name))
    .sort((a, b) => b.name.length - a.name.length);
  return names[0]?.team;
}

function seasonFromQuery(query: string, fallback: SeasonId): SeasonId {
  if (/\b(?:24\s+25|2024\s+2025)\b/.test(query)) return "2024-25";
  if (/\b(?:25\s+26|2025\s+2026)\b/.test(query)) return "2025-26";
  if (/\b(?:26\s+27|2026\s+2027)\b/.test(query)) return "2026-27";
  return fallback;
}

function feedback(language: Language, text: { fi: [string, string]; en: [string, string] }, tone: QueryFeedback["tone"] = "notice", actions?: QueryAction[]): QueryFeedback {
  const [title, detail] = language === "fi" ? text.fi : text.en;
  return { tone, title, detail, ...(actions?.length ? { actions } : {}) };
}

const viewTarget = (view: ViewKey, season: SeasonId, id?: string, teamId?: string): QueryTarget => ({ view, season, id, teamId });

type StatQuestion = {
  key: "points" | "assists" | "rebounds" | "steals" | "blocks" | "threePM";
  labelFi: string;
  labelEn: string;
  value: (player: SeasonPlayerRow) => number | null;
};

const statQuestions: Array<{ terms: string[]; stat: StatQuestion }> = [
  { terms: ["piste", "pisteita", "point", "scor"], stat: { key: "points", labelFi: "pistettä", labelEn: "points", value: (player) => player.points } },
  { terms: ["syotto", "assist"], stat: { key: "assists", labelFi: "syöttöä", labelEn: "assists", value: (player) => player.assists } },
  { terms: ["levypall", "rebound"], stat: { key: "rebounds", labelFi: "levypalloa", labelEn: "rebounds", value: (player) => player.rebounds } },
  { terms: ["riisto", "steal"], stat: { key: "steals", labelFi: "riistoa", labelEn: "steals", value: (player) => player.steals } },
  { terms: ["torjunta", "block"], stat: { key: "blocks", labelFi: "torjuntaa", labelEn: "blocks", value: (player) => player.blocks } },
  { terms: ["kolmon", "three pointer", "3p"], stat: { key: "threePM", labelFi: "kolmosta", labelEn: "three-pointers", value: (player) => player.threePM } },
];

function requestedStat(query: string) {
  return statQuestions.find(({ terms }) => terms.some((term) => query.includes(term)))?.stat;
}

function mentionedPlayers(query: string, players: SeasonPlayerRow[]) {
  const matches = players
    .map((player) => ({ player, name: normalize(player.name) }))
    .filter((entry) => entry.name.length > 2 && query.includes(entry.name))
    .sort((a, b) => b.name.length - a.name.length);
  return matches.filter((entry) => entry.name.length === matches[0]?.name.length).map((entry) => entry.player);
}

function formatNumber(value: number, language: Language) {
  return value.toLocaleString(language === "fi" ? "fi-FI" : "en-GB", { maximumFractionDigits: 1 });
}

export async function resolveBasketballQuery(rawQuery: string, options: ResolveOptions): Promise<QueryResolution> {
  const league = leagues[options.leagueId ?? "naisten-korisliiga"];
  const query = normalize(rawQuery);
  const targetSeason = seasonFromQuery(query, options.seasonId);
  const historical = targetSeason !== "2026-27";
  const seasonTeams = targetSeason === options.seasonId
    ? options.selectedSeasonTeams
    : historical ? options.historicalTeamsBySeason?.[targetSeason]?.aggregate.teams ?? options.historicalTeams : options.currentTeams;
  const team = mentionedTeam(query, seasonTeams);
  const asksWinner = /\b(voittaja|voitti|mestari|mestaruus|champion|winner|won)\b/.test(query);
  const asksSeason = /\b(kausi|season|runkosarja|playoff|pudotuspel|league|sarja)\b/.test(query);
  const targetLabel = targetSeason.replace("-", "–");

  if (team && !asksWinner) {
    const target = viewTarget("teams", targetSeason, undefined, team.source_team_id);
    return {
      navigate: target,
      feedback: feedback(options.language, {
        fi: [`Avataan ${team.name}n joukkueprofiili`, `Kauden ${targetLabel} joukkuevertailut perustuvat varmennettuihin ottelutilastoihin.`],
        en: [`Opening ${team.name}'s team profile`, `The ${targetLabel} team comparisons use verified game statistics.`],
      }, "success"),
    };
  }

  const scheduleTeam = !historical && !team
    ? options.currentScheduleTeams.find((name) => query.includes(normalize(name)))
    : undefined;
  if (scheduleTeam && !asksWinner && !options.currentTeams.some((row) => normalize(row.name) === normalize(scheduleTeam))) {
    const oldTeam = mentionedTeam(normalize(scheduleTeam), options.historicalTeams);
    const actions: QueryAction[] = [
      { label: options.language === "fi" ? "Avaa 2026–27 ottelut" : "Open 2026–27 games", target: viewTarget("matches", "2026-27") },
    ];
    if (oldTeam) actions.unshift({ label: options.language === "fi" ? "Avaa 2025–26 profiili" : "Open 2025–26 profile", target: viewTarget("teams", "2025-26", undefined, oldTeam.source_team_id) });
    return {
      feedback: feedback(options.language, {
        fi: [`${scheduleTeam} on kauden 2026–27 otteluohjelmassa`, "Uuden kauden varmennettuja joukkueen tilastoja ei vielä ole."],
        en: [`${scheduleTeam} is in the 2026–27 schedule`, "Verified team statistics are not available for the new season yet."],
      }, "notice", actions),
    };
  }

  if (asksWinner) {
    if (historical) {
      const playoffMatches = await options.loadPlayoffMatches(targetSeason);
      const wins = new Map<string, { team: PlayoffTeam; count: number }>();
      for (const game of playoffMatches) {
        if (game.teams.length !== 2 || game.teams.some((row) => row.score == null)) continue;
        const [first, second] = game.teams;
        const winner = first.score! > second.score! ? first : second.score! > first.score! ? second : null;
        if (!winner) continue;
        const previous = wins.get(winner.source_id);
        wins.set(winner.source_id, { team: winner, count: (previous?.count ?? 0) + 1 });
      }
      // These are the deciding games from the official finals schedules.
      // Total playoff wins alone do not establish the champion.
      const decidingId = league.decidingFinals[targetSeason === "2024-25" ? "2024-25" : "2025-26"];
      const final = playoffMatches.find(game => game.game?.source_id === decidingId);
      const championId = final?.teams.length === 2 && final.teams.every(row => row.score != null) && final.teams[0].score !== final.teams[1].score
        ? [...final.teams].sort((a, b) => b.score! - a.score!)[0].source_id : undefined;
      const champion = championId ? wins.get(championId) : undefined;
      if (champion) {
        const championTeam = seasonTeams.find((row) => row.source_team_id === champion.team.source_id);
        const actions: QueryAction[] = [
          { label: options.language === "fi" ? "Avaa kausitrendit" : "Open season trends", target: viewTarget("season", targetSeason) },
        ];
        if (championTeam) actions.push({ label: options.language === "fi" ? "Avaa joukkueprofiili" : "Open team profile", target: viewTarget("teams", targetSeason, undefined, championTeam.source_team_id) });
        return {
          feedback: feedback(options.language, {
            fi: [`${champion.team.name} voitti sarjan ${league.name} ${targetLabel}`, `${champion.count} voittoa tarkistetussa pudotuspeliaineistossa.`],
            en: [`${champion.team.name} won the ${targetLabel} ${league.nameEn}`, `${champion.count} wins in the verified playoff data.`],
          }, "answer", actions),
        };
      }
    }
    return {
      feedback: feedback(options.language, {
        fi: [`Kauden ${targetLabel} voittajaa ei voi vielä vahvistaa`, "Tämän kauden pudotuspelituloksia ei ole varmennetussa aineistossa."],
        en: [`The ${targetLabel} winner cannot be verified yet`, "Verified playoff results are not available for this season."],
      }, "notice", [{ label: options.language === "fi" ? "Avaa kausitrendit" : "Open season trends", target: viewTarget("season", targetSeason) }]),
    };
  }

  const stat = requestedStat(query);
  const matches = await options.loadMatches(targetSeason);
  const seasonPlayers = aggregateSeasonPlayers(matches);
  const foundPlayers = mentionedPlayers(query, seasonPlayers);
  if (foundPlayers.length === 1) {
    const player = foundPlayers[0];
    const target = viewTarget("player-profile", targetSeason, player.id);
    return {
      navigate: target,
      feedback: feedback(options.language, {
        fi: [`Avataan ${player.name}n pelaajaprofiili`, `Tilastot ovat kaudelta ${targetLabel}.`],
        en: [`Opening ${player.name}'s player profile`, `Statistics are from the ${targetLabel} season.`],
      }, "success"),
    };
  }

  if (!stat && foundPlayers.length === 0 && targetSeason === "2026-27") {
    const previousPlayers = aggregateSeasonPlayers(await options.loadMatches("2025-26"));
    const previousMatches = mentionedPlayers(query, previousPlayers);
    if (previousMatches.length === 1) {
      const player = previousMatches[0];
      return {
        feedback: feedback(options.language, {
          fi: [`${player.name} löytyy kauden 2025–26 aineistosta`, "Kauden 2026–27 tilastot näkyvät, kun hänestä on pelattuja ja tarkistettuja otteluita."],
          en: [`${player.name} is in the 2025–26 dataset`, "Their 2026–27 statistics will appear after games are played and verified."],
        }, "notice", [{ label: options.language === "fi" ? "Avaa 2025–26 pelaajaprofiili" : "Open 2025–26 player profile", target: viewTarget("player-profile", "2025-26", player.id) }]),
      };
    }
  }

  if (stat) {
      if (seasonPlayers.length === 0) {
        const actions: QueryAction[] = targetSeason === "2026-27" ? [
          { label: options.language === "fi" ? "Katso otteluohjelma" : "View the schedule", target: viewTarget("matches", targetSeason) },
          { label: options.language === "fi" ? "Katso 2025–26 tilastoja" : "View 2025–26 stats", target: viewTarget("players", "2025-26") },
        ] : [{ label: options.language === "fi" ? "Avaa pelaajat" : "Open players", target: viewTarget("players", targetSeason) }];
        return {
          feedback: feedback(options.language, {
            fi: [`Kaudelta ${targetLabel} ei ole vielä pelaajatilastoja`, "Vasta pelatut ja varmennetut ottelut kerryttävät kauden tilastoja."],
            en: [`There are no player statistics for ${targetLabel} yet`, "Only played and verified games contribute to season statistics."],
          }, "notice", actions),
        };
      }
      const perGame = /\b(per game|per ottelu|ottelua kohti|keskiarvo|average)\b/.test(query);
      const eligible = perGame ? seasonPlayers.filter((player) => player.games >= 8 && player.minutes >= 120) : seasonPlayers;
      const ranked = eligible
        .map((player) => ({ player, value: stat.value(player) }))
        .filter((row): row is { player: SeasonPlayerRow; value: number } => row.value != null)
        .sort((a, b) => b.value - a.value || a.player.name.localeCompare(b.player.name, "fi"));
      const leader = ranked[0];
      if (leader) {
        const shownValue = perGame ? leader.value / leader.player.games : leader.value;
        const statName = options.language === "fi" ? stat.labelFi : stat.labelEn;
        const measure = perGame ? (options.language === "fi" ? `${statName} ottelua kohti` : `${statName} per game`) : (options.language === "fi" ? `${statName} yhteensä` : `total ${statName}`);
        const action: QueryAction = {
          label: options.language === "fi" ? "Avaa pelaajaprofiili" : "Open player profile",
          target: viewTarget("player-profile", targetSeason, leader.player.id),
        };
        return {
          feedback: feedback(options.language, {
            fi: [`${leader.player.name} johtaa tilastossa: ${measure}`, `${formatNumber(shownValue, options.language)} · ${leader.player.team} · ${leader.player.games} ottelua · kausi ${targetLabel}.`],
            en: [`${leader.player.name} leads in ${measure}`, `${formatNumber(shownValue, options.language)} · ${leader.player.team} · ${leader.player.games} games · ${targetLabel} season.`],
          }, "answer", [action]),
        };
      }
  }

  if (asksSeason && !stat) {
    const target = viewTarget("season", targetSeason);
    return {
      navigate: target,
      feedback: feedback(options.language, {
        fi: [`Avataan kauden ${targetLabel} trendit`, "Kausitrendit kokoavat varmennetut ottelut sekä runkosarjan ja pudotuspelien vertailun, jos dataa on saatavilla."],
        en: [`Opening ${targetLabel} season trends`, "Season trends bring together verified games and a regular-season/playoff comparison where data is available."],
      }, "success"),
    };
  }

  return {
    feedback: feedback(options.language, {
      fi: ["En löytänyt kyselylle suoraa tulosta", "Kokeile joukkueen tai pelaajan nimeä, tilastoa kuten syöttöjä tai mestarikysymystä kaudelta 2025–26."],
      en: ["I couldn't find a direct result", "Try a team or player name, a stat such as assists, or a 2025–26 champion question."],
    }, "empty"),
  };
}
