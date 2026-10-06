import { leagues, type LeagueId } from "./leagues.ts";
import { isCompletedScheduleStatus, isLiveScheduleStatus, type ScheduleMatch, type SeasonMatchRecord, type SeasonId } from "./SeasonContext";
import type { ViewKey } from "./data";
import { aggregateSeasonPlayers, progressivePlayerQualification, type SeasonPlayerRow } from "./playerStats.ts";

export type QueryTarget = {
  view: ViewKey;
  season: SeasonId;
  id?: string;
  teamId?: string;
  league?: LeagueId;
};

export type QueryAction = { label: string; target: QueryTarget };
export type QueryFeedback = {
  tone: "answer" | "notice" | "empty" | "success";
  title: string;
  detail: string;
  actions?: QueryAction[];
  suggestions?: string[];
};
export type AskAnswer =
  | { kind: "fixture"; season: SeasonId; fixture: ScheduleMatch }
  | { kind: "team-games"; season: SeasonId; teamName: string; teamId: string; scope: "all" | "wins" | "losses"; games: Array<{ id: string; date: string | null; opponent: string; teamScore: number; opponentScore: number; won: boolean }>; nextFixture?: ScheduleMatch }
  | { kind: "player-stat" | "player-leader"; season: SeasonId; playerId: string; playerName: string; teamName: string; statLabel: string; value: number; perGame: boolean; games: number };

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
  currentSchedule: ScheduleMatch[];
  scheduleAvailable?: boolean;
  loadMatches: (season: SeasonId) => Promise<SeasonMatchRecord[]>;
  loadPlayoffMatches: (season?: SeasonId) => Promise<PlayoffMatch[]>;
  historicalTeamsBySeason?: Partial<Record<SeasonId, { aggregate: { teams: TeamLookup[] } }>>;
};

export type QueryResolution = { feedback: QueryFeedback; navigate?: QueryTarget; answer?: AskAnswer };
export const MAX_QUERY_LENGTH = 200;

const normalize = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("fi-FI")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

function mentionedTeam(query: string, teams: TeamLookup[]) {
  return mentionedTeams(query, teams)[0];
}

function teamTerms(team: TeamLookup) {
  const fullName = normalize(team.name);
  const shortName = fullName.split(" ").at(-1) ?? "";
  const genericTerms = new Set(["basket", "basketball", "koris", "team", "club"]);
  const terms = new Set([fullName]);
  const acronym = fullName.split(" ").map((part) => part[0]).join("");
  if (acronym.length >= 3) terms.add(acronym);
  if (shortName.length >= 5 && !genericTerms.has(shortName)) {
    terms.add(shortName);
    for (const suffix of ["n", "in", "ssa", "ssä", "sta", "stä", "lla", "llä", "lta", "ltä", "lle", "a", "ä"]) {
      terms.add(`${shortName}${suffix}`);
    }
    if (shortName.endsWith("et")) {
      const stem = shortName.slice(0, -2);
      for (const suffix of ["ien", "ia", "issa", "ista", "illa", "ilta", "ille"]) terms.add(`${stem}${suffix}`);
    }
  }
  return [...terms];
}

function editDistance(a: string, b: string) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let row = 1; row <= a.length; row++) {
    let diagonal = previous[0];
    previous[0] = row;
    for (let column = 1; column <= b.length; column++) {
      const above = previous[column];
      previous[column] = Math.min(previous[column] + 1, previous[column - 1] + 1, diagonal + (a[row - 1] === b[column - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return previous[b.length];
}

function mentionedTeams(query: string, teams: TeamLookup[]) {
  const paddedQuery = ` ${query} `;
  const matched = teams.flatMap((team) => teamTerms(team)
    .filter((term) => paddedQuery.includes(` ${term} `))
    .map((term) => ({ team, term })))
    .sort((a, b) => b.term.length - a.term.length);
  const seen = new Set<string>();
  const exact = matched.flatMap(({ team }) => {
    if (seen.has(team.source_team_id)) return [];
    seen.add(team.source_team_id);
    return [team];
  });
  const tokens = query.split(" ").filter((token) => token.length >= 6);
  const approximate = teams.filter((team) => !seen.has(team.source_team_id)).flatMap((team) => {
    const aliases = teamTerms(team).filter((term) => !term.includes(" ") && term.length >= 6);
    const distances = tokens.flatMap((token) => aliases.map((alias) => editDistance(token, alias)));
    const distance = Math.min(...distances);
    const longestAlias = Math.max(0, ...aliases.map((alias) => alias.length));
    const allowance = longestAlias >= 9 ? 2 : 1;
    return distance <= allowance ? [{ team, distance }] : [];
  }).sort((a, b) => a.distance - b.distance);
  if (!approximate.length) return exact;
  const bestDistance = approximate[0].distance;
  return [...exact, ...approximate.filter((entry) => entry.distance === bestDistance).map((entry) => entry.team)];
}

function uniqueTeams(teams: TeamLookup[]) {
  return Array.from(new Map(teams.map((team) => [team.source_team_id, team])).values());
}

function upcomingFixtures(schedule: ScheduleMatch[]) {
  const now = Date.now();
  return schedule.filter((fixture) => {
    if (isCompletedScheduleStatus(fixture.status) || isLiveScheduleStatus(fixture.status) || fixture.home.score !== null || fixture.away.score !== null) return false;
    const scheduledAt = fixture.scheduled_date ? new Date(`${fixture.scheduled_date}T${fixture.scheduled_time ?? "23:59:00"}`).getTime() : NaN;
    return Number.isFinite(scheduledAt) && scheduledAt >= now;
  }).sort((a, b) => `${a.scheduled_date ?? "9999"} ${a.scheduled_time ?? ""}`.localeCompare(`${b.scheduled_date ?? "9999"} ${b.scheduled_time ?? ""}`));
}

function hasUnrecognizedTeamTerm(query: string) {
  const intentWord = /^(?:milloin|koska|when|next|upcoming|seuraav\w*|tulev\w*|kuka|mika|mitka|mita|ketka|kuinka|monta|montako|onko|ovat|on|do|does|did|they|who|which|what|how|where|why|will|would|can|could|play\w*|pela\w*|kohtaa\w*|vastaan|vs|versus|meet\w*|ottel\w*|peli\w*|game\w*|match\w*|fixture\w*|schedule|result\w*|tulos\w*|last|latest|recent|most|viimeis\w*|wins?|voitt\w*|loss\w*|tappi\w*|points?|piste\w*|assists?|syot\w*|rebounds?|levypall\w*|average|averages|scor\w*|eniten|tehnyt|kausi|kauden|kaudella|season|sarja|sarjan|liiga|liigan|korisliiga|koripallo|naisten|the|a|an|are|was|were|am|in|on|to|for|and|or|my|our|their|team|teams)$/;
  return query.split(" ").some((word) => word.length >= 5 && !intentWord.test(word) && !/^\d+$/.test(word));
}

function isBareTeamQuery(query: string, team: TeamLookup) {
  let remainder = query;
  for (const term of teamTerms(team).sort((a, b) => b.length - a.length)) {
    remainder = remainder.replace(new RegExp(`(^| )${term}(?= |$)`, "g"), " ");
  }
  const profileWords = new Set(["avaa", "open", "joukkue", "team", "seura", "profiili", "profile", "the"]);
  const remaining = remainder.split(/\s+/).filter((word) => word && !profileWords.has(word));
  if (!remaining.length) return true;
  return remaining.length === 1 && teamTerms(team).some((term) => !term.includes(" ") && editDistance(remaining[0], term) <= (term.length >= 9 ? 2 : 1));
}

function seasonFromQuery(query: string, fallback: SeasonId): SeasonId {
  if (/\b(?:24|2024)\s+(?:25|2025)\b/.test(query)) return "2024-25";
  if (/\b(?:25|2025)\s+(?:26|2026)\b/.test(query)) return "2025-26";
  if (/\b(?:26|2026)\s+(?:27|2027)\b/.test(query)) return "2026-27";
  return fallback;
}

function feedback(language: Language, text: { fi: [string, string]; en: [string, string] }, tone: QueryFeedback["tone"] = "notice", actions?: QueryAction[], suggestions?: string[]): QueryFeedback {
  const [title, detail] = language === "fi" ? text.fi : text.en;
  return { tone, title, detail, ...(actions?.length ? { actions } : {}), ...(suggestions?.length ? { suggestions } : {}) };
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
  { terms: ["syot", "assist"], stat: { key: "assists", labelFi: "syöttöä", labelEn: "assists", value: (player) => player.assists } },
  { terms: ["levypall", "rebound"], stat: { key: "rebounds", labelFi: "levypalloa", labelEn: "rebounds", value: (player) => player.rebounds } },
  { terms: ["riisto", "steal"], stat: { key: "steals", labelFi: "riistoa", labelEn: "steals", value: (player) => player.steals } },
  { terms: ["torjunt", "block"], stat: { key: "blocks", labelFi: "torjuntaa", labelEn: "blocks", value: (player) => player.blocks } },
  { terms: ["kolmon", "three pointer", "3p"], stat: { key: "threePM", labelFi: "kolmosta", labelEn: "three-pointers", value: (player) => player.threePM } },
];

function requestedStat(query: string) {
  return statQuestions.find(({ terms }) => terms.some((term) => query.includes(term)))?.stat;
}

function playerTerms(playerName: string) {
  const name = normalize(playerName);
  const words = name.split(" ");
  const surname = words.at(-1) ?? "";
  const prefix = words.slice(0, -1).join(" ");
  const terms = [name];
  if (prefix && surname.length >= 4) {
    for (const suffix of ["n", "in", "ssa", "ssä", "sta", "stä", "lle", "lla", "llä"]) terms.push(`${prefix} ${surname}${suffix}`);
  }
  return terms;
}

function isBarePlayerQuery(query: string, playerName: string) {
  let remainder = query;
  for (const term of playerTerms(playerName)) remainder = remainder.replace(new RegExp(`(^| )${term}(?= |$)`, "g"), " ");
  const profileWords = new Set(["avaa", "open", "pelaaja", "player", "profiili", "profile", "the"]);
  return remainder.split(/\s+/).filter((word) => word && !profileWords.has(word)).length === 0;
}

function mentionedPlayers(query: string, players: SeasonPlayerRow[]) {
  const matches = players.flatMap((player) => {
    const matchLength = playerTerms(player.name).filter((term) => ` ${query} `.includes(` ${term} `)).reduce((longest, term) => Math.max(longest, term.length), 0);
    return matchLength ? [{ player, matchLength }] : [];
  }).sort((a, b) => b.matchLength - a.matchLength);
  return matches.filter((entry) => entry.matchLength === matches[0]?.matchLength).map((entry) => entry.player);
}

function requestedGameCount(query: string) {
  const numericMatch = query.match(/\b(?:last|viimeis\w*|latest|recent)\s+(\d{1,2})\b|\b(\d{1,2})\s+(?:viimeis\w*|ottel\w*|peli\w*|game\w*|match\w*)\b/);
  const numeric = Number(numericMatch?.[1] ?? numericMatch?.[2]);
  if (numeric > 0) return Math.min(10, numeric);
  const wordCounts: Array<[string, number]> = [["yksi", 1], ["kaksi", 2], ["kolme", 3], ["nelja", 4], ["viisi", 5], ["kuusi", 6], ["seitseman", 7], ["kahdeksan", 8], ["yhdeksan", 9], ["kymmenen", 10]];
  const count = wordCounts.find(([word]) => query.split(" ").includes(word))?.[1];
  return count ?? 5;
}

function formatNumber(value: number, language: Language) {
  return value.toLocaleString(language === "fi" ? "fi-FI" : "en-GB", { maximumFractionDigits: 1 });
}

export async function resolveBasketballQuery(rawQuery: string, options: ResolveOptions): Promise<QueryResolution> {
  if (rawQuery.length > MAX_QUERY_LENGTH) {
    return { feedback: feedback(options.language, {
      fi: ["Kysymys on liian pitkä", `Lyhennä kysymys enintään ${MAX_QUERY_LENGTH} merkkiin.`],
      en: ["Question is too long", `Shorten it to ${MAX_QUERY_LENGTH} characters or fewer.`],
    }, "notice") };
  }
  const league = leagues[options.leagueId ?? "naisten-korisliiga"];
  const query = normalize(rawQuery);
  const asksUpcoming = /\b(seuraav\w*|tulev\w*|next|upcoming)\b/.test(query)
    || (/\b(milloin|koska|when)\b/.test(query) && /\b(kohtaa\w*|pelaa\w*|vastaan|vs|versus|meet\w*|play\w*)\b/.test(query));
  const asksGames = /\b(ottel\w*|peli\w*|game\w*|match\w*|fixture\w*|schedule|result\w*|tulos\w*)\b/.test(query);
  const targetSeason = seasonFromQuery(query, asksUpcoming ? "2026-27" : options.seasonId);
  const historical = targetSeason !== "2026-27";
  const seasonTeams = targetSeason === options.seasonId
    ? options.selectedSeasonTeams
    : historical ? options.historicalTeamsBySeason?.[targetSeason]?.aggregate.teams ?? options.historicalTeams : options.currentTeams;
  const scheduleTeams = uniqueTeams(options.currentSchedule.flatMap((fixture) => [
    { source_team_id: fixture.home.source_team_id, name: fixture.home.name },
    { source_team_id: fixture.away.source_team_id, name: fixture.away.name },
  ]));
  const targetTeams = uniqueTeams([...seasonTeams, ...(!historical ? scheduleTeams : [])]);
  const teamsMentioned = mentionedTeams(query, targetTeams);
  const team = teamsMentioned[0];
  const asksRecent = /\b(viimeis\w*|viimeksi|last|latest|recent|most recent)\b/.test(query);
  const asksWins = /\b(voitt\w*|wins?|win|won)\b/.test(query);
  const asksLosses = /\b(tappi\w*|havis?\w*|loss\w*|lost)\b/.test(query);
  const asksWinner = /\b(voittaja|mestari|mestaruus|champion|winner)\b/.test(query)
    || (!team && !asksRecent && !asksGames && /\b(won|voitt\w*)\b/.test(query));
  const asksSeason = /\b(kausi|season|runkosarja|playoff|pudotuspel|league|sarja)\b/.test(query);
  const targetLabel = targetSeason.replace("-", "–");

  if (teamsMentioned.length > 1 && !(asksUpcoming && teamsMentioned.length === 2)) {
    const suggestions = teamsMentioned.slice(0, 3).map((row) => options.language === "fi" ? `Viimeisimmät 5 ottelua: ${row.name}` : `Last 5 games: ${row.name}`);
    return { feedback: feedback(options.language, {
      fi: ["Mitä joukkuetta tarkoitat?", `Kysymyksessä tunnistui useampi joukkue: ${teamsMentioned.slice(0, 3).map((row) => row.name).join(", ")}.`],
      en: ["Which team do you mean?", `I found more than one team in the question: ${teamsMentioned.slice(0, 3).map((row) => row.name).join(", ")}.`],
    }, "empty", undefined, suggestions) };
  }

  if (asksUpcoming && historical) {
    return { feedback: feedback(options.language, {
      fi: ["Tulevaa ottelua ei voi hakea päättyneeltä kaudelta", "Valitse nykyinen kausi, jos etsit seuraavaa ottelua."],
      en: ["An upcoming game can't be found in a completed season", "Choose the current season to look for the next game."],
    }, "notice", [{ label: options.language === "fi" ? "Avaa nykykauden ottelut" : "Open current-season games", target: viewTarget("matches", "2026-27") }]) };
  }

  if (asksUpcoming && targetSeason === "2026-27" && options.scheduleAvailable === false) {
    return { feedback: feedback(options.language, {
      fi: ["Otteluohjelmaa ei saatu ladattua", "En voi vielä varmistaa seuraavaa ottelua. Yritä hetken kuluttua uudelleen."],
      en: ["The schedule couldn't be loaded", "I can't verify the next game yet. Please try again shortly."],
    }, "notice", [{ label: options.language === "fi" ? "Avaa ottelut" : "Open games", target: viewTarget("matches", "2026-27") }]) };
  }

  if (!teamsMentioned.length && asksUpcoming && hasUnrecognizedTeamTerm(query)) {
    const suggestions = options.currentScheduleTeams.slice(0, 3).map((name) => options.language === "fi" ? `Seuraava ottelu: ${name}` : `Next game: ${name}`);
    return { feedback: feedback(options.language, {
      fi: ["En tunnistanut joukkuetta tai pelaajaa", "Tarkista nimi tai kokeile valita joukkue alla olevista ehdotuksista."],
      en: ["I couldn't identify the team or player", "Check the name or choose a team from the suggestions below."],
    }, "empty", undefined, suggestions.length ? suggestions : [options.language === "fi" ? "Mikä on sarjan seuraava ottelu?" : "What is the league's next game?"]) };
  }

  if (asksUpcoming && targetSeason === "2026-27") {
    const namedUpcomingTeams = mentionedTeams(query, uniqueTeams([...scheduleTeams, ...seasonTeams]));
    const namedIds = new Set(namedUpcomingTeams.map((row) => row.source_team_id));
    const fixtures = upcomingFixtures(options.currentSchedule).filter((fixture) => {
      const pair = [fixture.home.source_team_id, fixture.away.source_team_id];
      return [...namedIds].every((id) => pair.includes(id));
    });
    const fixture = fixtures[0];
    if (fixture) {
      const date = fixture.scheduled_date ? new Intl.DateTimeFormat(options.language === "fi" ? "fi-FI" : "en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${fixture.scheduled_date}T12:00:00`)) : "";
      const time = fixture.scheduled_time ? fixture.scheduled_time.slice(0, 5) : "";
      const matchup = `${fixture.home.name} – ${fixture.away.name}`;
      return {
        answer: { kind: "fixture", season: targetSeason, fixture },
        feedback: feedback(options.language, {
          fi: [`${matchup} seuraavaksi ${date}`, [time && `klo ${time}`, fixture.venue, "kauden 2026–27 otteluohjelma"].filter(Boolean).join(" · ")],
          en: [`${matchup} next on ${date}`, [time && `at ${time}`, fixture.venue, "2026–27 schedule"].filter(Boolean).join(" · ")],
        }, "answer"),
      };
    }
    return {
      feedback: feedback(options.language, {
        fi: ["Tulevaa ottelua ei löytynyt", namedUpcomingTeams.length ? `Kauden 2026–27 ohjelmassa ei ole päivämäärältään tulevaa ottelua: ${namedUpcomingTeams.map((row) => row.name).join(" – ")}.` : "Kauden 2026–27 ohjelmassa ei ole päivämäärältään tulevia otteluita."],
        en: ["No upcoming game found", namedUpcomingTeams.length ? `The 2026–27 schedule has no future game for ${namedUpcomingTeams.map((row) => row.name).join(" – ")}.` : "There are no future games in the 2026–27 schedule."],
      }, "notice", [{ label: options.language === "fi" ? "Avaa otteluohjelma" : "Open schedule", target: viewTarget("matches", "2026-27") }]),
    };
  }

  if (team && (asksGames || asksRecent || asksWins || asksLosses) && !asksWinner) {
    const matches = await options.loadMatches(targetSeason);
    const count = requestedGameCount(query);
    const scope = asksWins && !asksLosses ? "wins" : asksLosses && !asksWins ? "losses" : "all";
    const games = matches.flatMap((record) => {
      const selected = record.teams.find((row) => row.source_id === team.source_team_id);
      const opponent = record.teams.find((row) => row.source_id !== team.source_team_id);
      if (!selected || !opponent) return [];
      const won = selected.score > opponent.score;
      if (scope === "wins" && !won || scope === "losses" && won) return [];
      return [{ id: record.game.source_id, date: record.game.scheduled_at ?? null, opponent: opponent.name, teamScore: selected.score, opponentScore: opponent.score, won }];
    }).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")).slice(0, count);
    const nextFixture = targetSeason === "2026-27"
      ? upcomingFixtures(options.currentSchedule).find((fixture) => fixture.home.source_team_id === team.source_team_id || fixture.away.source_team_id === team.source_team_id)
      : undefined;
    const filterName = scope === "wins" ? (options.language === "fi" ? "voittoa" : "wins") : scope === "losses" ? (options.language === "fi" ? "tappiota" : "losses") : (options.language === "fi" ? "ottelua" : "games");
    const hasResult = games.length > 0 || Boolean(nextFixture);
    return {
      answer: { kind: "team-games", season: targetSeason, teamName: team.name, teamId: team.source_team_id, scope, games, nextFixture },
      feedback: feedback(options.language, hasResult ? {
        fi: games.length
          ? [`${team.name}: viimeisimmät ${games.length} ${filterName}`, `Näytetään kauden ${targetLabel} varmennetut ottelut uusimmasta vanhimpaan.`]
          : [`${team.name}: ei vielä pelattuja otteluita kaudella ${targetLabel}`, "Alla näkyy joukkueen seuraava ottelu."] ,
        en: games.length
          ? [`${team.name}: ${games.length} most recent ${filterName}`, `Verified ${targetLabel} games, newest first.`]
          : [`${team.name} has no played games in ${targetLabel} yet`, "The team's next scheduled game is shown below."],
      } : {
        fi: [`${team.name}: otteluita ei löytynyt kaudelta ${targetLabel}`, matches.length ? `Varmennetuissa tuloksissa ei ole joukkueelle ${scope === "wins" ? "voittoja" : scope === "losses" ? "tappioita" : "pelattuja otteluita"}.` : "Tämän kauden pelattuja ja varmennettuja otteluita ei ole vielä aineistossa."],
        en: [`${team.name}: no games found for ${targetLabel}`, matches.length ? `The verified results contain no ${scope === "wins" ? "wins" : scope === "losses" ? "losses" : "played games"} for this team.` : "There are no played and verified games for this season in the data yet."],
      }, hasResult ? "answer" : "notice"),
    };
  }

  if (team && isBareTeamQuery(query, team) && !asksWinner && !asksRecent && !asksUpcoming && !requestedStat(query)) {
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
  if (team && !isBareTeamQuery(query, team) && !asksSeason && !stat) {
    const actions: QueryAction[] = [{ label: options.language === "fi" ? "Avaa joukkueprofiili" : "Open team profile", target: viewTarget("teams", targetSeason, undefined, team.source_team_id) }];
    const suggestions = options.language === "fi"
      ? [`Viimeisimmät 5 ottelua: ${team.name}`, `Seuraava ottelu: ${team.name}`]
      : [`Last 5 games: ${team.name}`, `Next game: ${team.name}`];
    return { feedback: feedback(options.language, {
      fi: [`Tunnistin ${team.name}n, mutta en vielä kysymystä`, "Kokeile joukkueen otteluita tai seuraavaa ottelua koskevaa hakua."],
      en: [`I found ${team.name}, but not the question yet`, "Try asking for the team's games or its next game."],
    }, "empty", actions, suggestions) };
  }

  const matches = await options.loadMatches(targetSeason);
  const seasonPlayers = aggregateSeasonPlayers(matches);
  const qualification = progressivePlayerQualification(matches);
  const foundPlayers = mentionedPlayers(query, seasonPlayers);
  if (foundPlayers.length > 1) {
    const suggestions = foundPlayers.slice(0, 3).map((player) => options.language === "fi" ? `${player.name} pisteet` : `${player.name} points`);
    const actions: QueryAction[] = foundPlayers.slice(0, 3).map((player) => ({ label: player.name, target: viewTarget("player-profile", targetSeason, player.id) }));
    return { feedback: feedback(options.language, {
      fi: ["Kummasta pelaajasta haluat tietää?", `Kysymyksessä tunnistui useampi pelaaja: ${foundPlayers.slice(0, 3).map((player) => player.name).join(", ")}.`],
      en: ["Which player do you mean?", `I found more than one player in the question: ${foundPlayers.slice(0, 3).map((player) => player.name).join(", ")}.`],
    }, "empty", actions, suggestions) };
  }
  if (foundPlayers.length === 1 && !stat && isBarePlayerQuery(query, foundPlayers[0].name)) {
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
      const perGame = /\b(per game|per ottel\w*|ottel\w* kohti|per peli\w*|keskiarv\w*|average)\b/.test(query);
      const requestedPlayer = foundPlayers.length === 1 ? foundPlayers[0] : undefined;
      const selectedTeam = mentionedTeam(query, seasonTeams);
      const pool = requestedPlayer ? [requestedPlayer] : selectedTeam ? seasonPlayers.filter((player) => player.team === selectedTeam.name) : seasonPlayers;
      const eligible = requestedPlayer ? pool : perGame ? pool.filter((player) => player.games >= qualification.minimumGames && player.minutes >= qualification.minimumMinutes) : pool;
      const ranked = eligible
        .map((player) => ({ player, value: stat.value(player) }))
        .filter((row): row is { player: SeasonPlayerRow; value: number } => row.value != null)
        .sort((a, b) => (perGame ? b.value / b.player.games - a.value / a.player.games : b.value - a.value) || a.player.name.localeCompare(b.player.name, "fi"));
      const leader = ranked[0];
      if (leader) {
        const shownValue = perGame ? leader.value / leader.player.games : leader.value;
        const statName = options.language === "fi" ? stat.labelFi : stat.labelEn;
        const measure = perGame ? (options.language === "fi" ? `${statName} ottelua kohti` : `${statName} per game`) : (options.language === "fi" ? `${statName} yhteensä` : `total ${statName}`);
        return {
          answer: { kind: requestedPlayer ? "player-stat" : "player-leader", season: targetSeason, playerId: leader.player.id, playerName: leader.player.name, teamName: leader.player.team, statLabel: measure, value: shownValue, perGame, games: leader.player.games },
          feedback: feedback(options.language, {
            fi: [`${leader.player.name} johtaa tilastossa: ${measure}`, `${formatNumber(shownValue, options.language)} · ${leader.player.team} · ${leader.player.games} ottelua · kausi ${targetLabel}.`],
            en: [`${leader.player.name} leads in ${measure}`, `${formatNumber(shownValue, options.language)} · ${leader.player.team} · ${leader.player.games} games · ${targetLabel} season.`],
          }, "answer"),
        };
      }
      const entity = requestedPlayer?.name ?? selectedTeam?.name;
      const actions: QueryAction[] = requestedPlayer
        ? [{ label: options.language === "fi" ? "Avaa pelaajaprofiili" : "Open player profile", target: viewTarget("player-profile", targetSeason, requestedPlayer.id) }]
        : selectedTeam
          ? [{ label: options.language === "fi" ? "Avaa joukkueprofiili" : "Open team profile", target: viewTarget("teams", targetSeason, undefined, selectedTeam.source_team_id) }]
          : [{ label: options.language === "fi" ? "Avaa pelaajat" : "Open players", target: viewTarget("players", targetSeason) }];
      return { feedback: feedback(options.language, {
        fi: [entity ? `${entity}: ${stat.labelFi} ei löytynyt` : `${stat.labelFi} ei löytynyt aineistosta`, pool.length ? "Tälle tilastolle ei ole varmennettua arvoa valitulla kaudella." : `Kaudelta ${targetLabel} ei löytynyt tähän hakuun sopivia pelaajia.`],
        en: [entity ? `${stat.labelEn} not found for ${entity}` : `${stat.labelEn} not found in the data`, pool.length ? "There is no verified value for this statistic in the selected season." : `No players matching this search were found for ${targetLabel}.`],
      }, "notice", actions) };
  }

  if (foundPlayers.length === 1 && !stat) {
    const player = foundPlayers[0];
    return { feedback: feedback(options.language, {
      fi: [`Tunnistin pelaajan ${player.name}, mutta en vielä kysymystä`, "Kokeile pelaajan pisteitä, syöttöjä tai levypalloja koskevaa hakua."],
      en: [`I found ${player.name}, but not the question yet`, "Try asking about the player's points, assists, or rebounds."],
    }, "empty", [{ label: options.language === "fi" ? "Avaa pelaajaprofiili" : "Open player profile", target: viewTarget("player-profile", targetSeason, player.id) }], options.language === "fi"
      ? [`${player.name} pisteet`, `${player.name} syötöt`, `${player.name} levypallot`]
      : [`${player.name} points`, `${player.name} assists`, `${player.name} rebounds`]) };
  }

  if (!team && !foundPlayers.length && asksGames && !asksUpcoming && !stat && !asksSeason) {
    if (hasUnrecognizedTeamTerm(query)) {
      const suggestions = options.currentScheduleTeams.slice(0, 3).map((name) => options.language === "fi" ? `Viimeisimmät 5 ottelua: ${name}` : `Last 5 games: ${name}`);
      return { feedback: feedback(options.language, {
        fi: ["En tunnistanut joukkuetta", "Tarkista nimi tai valitse alta joukkue, jonka otteluita haet."],
        en: ["I couldn't identify the team", "Check the name or choose below which team's games to find."],
      }, "empty", undefined, suggestions) };
    }
    return {
      navigate: viewTarget("matches", targetSeason),
      feedback: feedback(options.language, {
        fi: ["Avataan ottelut", `Näytetään kauden ${targetLabel} ottelut.`],
        en: ["Opening games", `Showing games from the ${targetLabel} season.`],
      }, "success"),
    };
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
      fi: ["En vielä ymmärtänyt kysymystä", "Kysyn tällä hetkellä varmennetuista pelaajatilastoista, joukkueiden otteluista ja seuraavista peleistä."],
      en: ["I don't understand that question yet", "I can currently answer verified player stats, team games, and upcoming fixtures."],
    }, "empty", undefined, options.language === "fi" ? [
      "Kuka johtaa pisteissä kaudella 2025–26?",
      options.currentScheduleTeams[0] ? `Viimeisimmät 5 ottelua: ${options.currentScheduleTeams[0]}` : "Mikä on sarjan seuraava ottelu?",
      options.currentScheduleTeams[0] ? `Seuraava ottelu: ${options.currentScheduleTeams[0]}` : "Kuka johtaa syötöissä kaudella 2025–26?",
    ] : [
      "Who leads in points in 2025–26?",
      options.currentScheduleTeams[0] ? `Last 5 games: ${options.currentScheduleTeams[0]}` : "What is the league's next game?",
      options.currentScheduleTeams[0] ? `Next game: ${options.currentScheduleTeams[0]}` : "Who leads in assists in 2025–26?",
    ]),
  };
}
