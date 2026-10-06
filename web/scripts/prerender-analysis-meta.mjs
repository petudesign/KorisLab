import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const appDirectory = path.resolve(scriptDirectory, "..");
const distDirectory = path.resolve(scriptDirectory, "../dist");
const buildEnv = { ...loadEnv("production", appDirectory, "VITE_"), ...process.env };
const projectId = buildEnv.VITE_SANITY_PROJECT_ID?.trim();
const dataset = buildEnv.VITE_SANITY_DATASET?.trim() || "production";
const configuredSiteUrl = buildEnv.VITE_SITE_URL?.trim()
  || (buildEnv.VERCEL_PROJECT_PRODUCTION_URL?.trim() ? `https://${buildEnv.VERCEL_PROJECT_PRODUCTION_URL.trim()}` : "");

let siteUrl = null;
if (configuredSiteUrl) {
  try {
    const parsed = new URL(configuredSiteUrl);
    if (!new Set(["https:", "http:"]).has(parsed.protocol) || parsed.username || parsed.password) throw new Error("Unsupported site URL");
    if (["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
      console.info("Skipping static SEO URLs for a loopback VITE_SITE_URL.");
    } else {
      siteUrl = parsed.origin;
    }
  } catch {
    console.warn("Static SEO pages, sitemap, and article previews skipped: VITE_SITE_URL must be an http(s) site origin.");
  }
}

function escapeAttribute(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function setMeta(html, attribute, name, content) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<meta\\b(?=[^>]*\\b${attribute}=["']${escapedName}["'])[^>]*>`, "i");
  const tag = `<meta ${attribute}="${name}" content="${escapeAttribute(content)}" />`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `  ${tag}\n  </head>`);
}

function setCanonical(html, href) {
  const pattern = /<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/i;
  const tag = `<link rel="canonical" href="${escapeAttribute(href)}" />`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `  ${tag}\n  </head>`);
}

function setStructuredData(html, value) {
  const json = JSON.stringify(value).replaceAll("</", "<\\/");
  const pattern = /<script\b(?=[^>]*\bdata-page-structured-data(?:=["'][^"']*["'])?)[^>]*>[\s\S]*?<\/script>/i;
  const tag = `<script type="application/ld+json" data-page-structured-data="true">${json}</script>`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `  ${tag}\n  </head>`);
}

function setStaticSummary(html, summary) {
  const root = /<div id="root"><\/div>/i;
  if (!root.test(html)) throw new Error("Build shell is missing the empty #root element");
  return html.replace(root, `<div id="root">${summary}</div>`);
}

function playerDisplayName(value) {
  const name = String(value ?? "").trim();
  const letters = name.match(/\p{L}/gu) ?? [];
  if (!letters.length || letters.some((letter) => letter !== letter.toLocaleUpperCase("fi-FI"))) return name;
  return name.toLocaleLowerCase("fi-FI").replace(/(^|[\s\-‐‑‒–—'’])(\p{L})/gu, (_match, boundary, initial) => boundary + initial.toLocaleUpperCase("fi-FI"));
}

function formatOneDecimal(value) {
  return Number(value).toLocaleString("fi-FI", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function scopedUrl(pathname, season, leagueId) {
  const url = new URL(pathname, siteUrl);
  url.searchParams.set("season", season);
  if (leagueId === "korisliiga") url.searchParams.set("league", leagueId);
  return url;
}

function seasonRank(season) {
  return Number.parseInt(season.slice(0, 4), 10) || 0;
}

function pageHtml(shell, { title, description, url, structuredData, summary }) {
  let html = shell.replace(/<title>[^<]*<\/title>/i, `<title>${escapeAttribute(title)}</title>`);
  html = setMeta(html, "name", "description", description);
  html = setMeta(html, "name", "robots", "index,follow");
  html = setMeta(html, "property", "og:type", structuredData["@type"] === "SportsEvent" ? "website" : "profile");
  html = setMeta(html, "property", "og:title", title);
  html = setMeta(html, "property", "og:description", description);
  html = setMeta(html, "property", "og:url", url.href);
  html = setMeta(html, "property", "og:locale", "fi_FI");
  html = setMeta(html, "name", "twitter:card", "summary");
  html = setMeta(html, "name", "twitter:title", title);
  html = setMeta(html, "name", "twitter:description", description);
  html = setCanonical(html, url.href);
  html = setStructuredData(html, structuredData);
  return setStaticSummary(html, summary);
}

function teamSlug(name) {
  return String(name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fi-FI")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function escapeXml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

const sitemapUrls = new Set();

async function writeSitemap() {
  if (!siteUrl) return;
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...sitemapUrls].sort().map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`).join("\n")}\n</urlset>\n`;
  await mkdir(distDirectory, { recursive: true });
  await writeFile(path.join(distDirectory, "sitemap.xml"), sitemap, "utf8");
  const robotsPath = path.join(distDirectory, "robots.txt");
  const robots = await readFile(robotsPath, "utf8");
  const sitemapLine = `Sitemap: ${siteUrl}/sitemap.xml`;
  if (!robots.includes(sitemapLine)) await writeFile(robotsPath, `${robots.trimEnd()}\n${sitemapLine}\n`, "utf8");
}

async function prerenderTeamProfiles() {
  const leagues = [
    { id: "naisten-korisliiga", pathSlug: "korisliiga-women", name: "Naisten Korisliiga", file: "season-2026-27.json" },
    { id: "korisliiga", pathSlug: "korisliiga", name: "Korisliiga", file: "korisliiga/season-2026-27.json" },
  ];
  const shell = await readFile(path.join(distDirectory, "index.html"), "utf8");
  let generated = 0;

  const publicRoutes = ["/", "/overview/", "/matches/", "/teams/", "/players/", "/season/", "/analyysit/"];
  for (const leagueId of ["naisten-korisliiga", "korisliiga"]) {
    for (const season of ["2024-25", "2025-26", "2026-27"]) {
      for (const route of publicRoutes) {
        const url = new URL(route, siteUrl);
        url.searchParams.set("season", season);
        if (leagueId === "korisliiga") url.searchParams.set("league", leagueId);
        sitemapUrls.add(url.href);
      }
    }
  }

  // Keep the base sitemap available even if a team snapshot is malformed.
  await writeSitemap();

  for (const league of leagues) {
    const snapshot = JSON.parse(await readFile(path.join(appDirectory, "public", league.file), "utf8"));
    const teams = snapshot.aggregate?.teams;
    if (!Array.isArray(teams) || !teams.length) throw new Error(`No teams in ${league.file}`);
    const seenSlugs = new Set();
    for (const team of teams) {
      if (typeof team.name !== "string" || typeof team.source_team_id !== "string") continue;
      const slug = teamSlug(team.name);
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || seenSlugs.has(slug)) throw new Error(`Invalid or duplicate team slug in ${league.id}: ${slug}`);
      seenSlugs.add(slug);

      const pathname = `/teams/${league.pathSlug}/${encodeURIComponent(slug)}/`;
      const url = new URL(pathname, siteUrl);
      url.searchParams.set("season", "2026-27");
      if (league.id === "korisliiga") url.searchParams.set("league", league.id);
      const title = `${team.name} · ${league.name} 2026–27 | KorisLab`;
      const description = `${team.name} – ${league.name}, kausi 2026–27: ottelut, heittotarkkuus, yritysmäärät ja vertailu sarjan tasoon KorisLabissa.`;
      let html = shell.replace(/<title>[^<]*<\/title>/i, `<title>${escapeAttribute(title)}</title>`);
      html = setMeta(html, "name", "description", description);
      html = setMeta(html, "name", "robots", "index,follow");
      html = setMeta(html, "property", "og:type", "website");
      html = setMeta(html, "property", "og:title", title);
      html = setMeta(html, "property", "og:description", description);
      html = setMeta(html, "property", "og:url", url.href);
      html = setMeta(html, "property", "og:locale", "fi_FI");
      html = setMeta(html, "name", "twitter:card", "summary");
      html = setMeta(html, "name", "twitter:title", title);
      html = setMeta(html, "name", "twitter:description", description);
      html = setCanonical(html, url.href);
      const teamDirectory = path.join(distDirectory, "teams", league.pathSlug, slug);
      await mkdir(teamDirectory, { recursive: true });
      await writeFile(path.join(teamDirectory, "index.html"), html, "utf8");
      sitemapUrls.add(url.href);
      generated++;
    }
  }

  await writeSitemap();
  return generated;
}

const entityLeagues = [
  {
    id: "naisten-korisliiga",
    pathSlug: "korisliiga-women",
    name: "Naisten Korisliiga",
    datasets: [
      { season: "2024-25", phase: "regular", file: "data/normalized/season_2024_2025.json" },
      { season: "2024-25", phase: "playoffs", file: "data/normalized/season_playoffs_2024_2025.json" },
      { season: "2025-26", phase: "regular", file: "data/normalized/season_verified.json" },
      { season: "2025-26", phase: "playoffs", file: "data/normalized/season_playoffs_2025_2026.json" },
      { season: "2026-27", phase: "regular", file: "web/public/season-2026-27.json" },
    ],
  },
  {
    id: "korisliiga",
    pathSlug: "korisliiga",
    name: "Korisliiga",
    datasets: [
      { season: "2024-25", phase: "regular", file: "data/normalized/season_korisliiga_2024_2025.json" },
      { season: "2024-25", phase: "playoffs", file: "data/normalized/season_korisliiga_playoffs_2024_2025.json" },
      { season: "2025-26", phase: "regular", file: "data/normalized/season_korisliiga_2025_2026.json" },
      { season: "2025-26", phase: "playoffs", file: "data/normalized/season_korisliiga_playoffs_2025_2026.json" },
      { season: "2026-27", phase: "regular", file: "web/public/korisliiga/season-2026-27.json" },
    ],
  },
];

function validEntityMatch(record) {
  return record?.validation?.valid !== false
    && typeof record?.game?.source_id === "string"
    && Array.isArray(record?.teams) && record.teams.length === 2
    && record.teams.every((team) => typeof team.name === "string" && typeof team.source_id === "string")
    && record.teams.every((team) => Number.isFinite(team.score));
}

function aggregateIndexedPlayers(records) {
  const players = new Map();
  for (const record of records) {
    for (const team of record.teams ?? []) {
      for (const appearance of team.players ?? []) {
        if (!appearance?.source_player_id || !appearance.participated || !(appearance.minutes > 0)) continue;
        const id = String(appearance.source_player_id);
        const player = players.get(id) ?? {
          id,
          name: playerDisplayName(appearance.display_name),
          games: 0,
          totals: { points: 0, rebounds: 0, assists: 0, minutes: 0 },
          samples: { points: 0, rebounds: 0, assists: 0 },
          teams: new Map(),
        };
        player.games++;
        player.totals.minutes += Number(appearance.minutes) || 0;
        for (const [key, sourceKey] of [["points", "points"], ["rebounds", "rebounds"], ["assists", "assists"]]) {
          const value = appearance.stats?.[sourceKey];
          if (Number.isFinite(value)) {
            player.totals[key] += value;
            player.samples[key]++;
          }
        }
        player.teams.set(team.name, (player.teams.get(team.name) ?? 0) + 1);
        players.set(id, player);
      }
    }
  }
  return players;
}

function safeSourceUrl(record) {
  const source = record?.source?.source_url;
  if (typeof source !== "string") return "https://tulospalvelu.basket.fi/";
  try {
    const url = new URL(source);
    return url.protocol === "https:" && url.hostname === "tulospalvelu.basket.fi" ? url.href : "https://tulospalvelu.basket.fi/";
  } catch {
    return "https://tulospalvelu.basket.fi/";
  }
}

function matchDate(record, scheduledGame) {
  const value = record.game?.scheduled_at || scheduledGame?.scheduled_date || null;
  if (typeof value !== "string") return null;
  const date = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function dateLabel(value) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.valueOf()) ? null : date.toLocaleDateString("fi-FI", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
}

async function prerenderPlayerAndMatchPages() {
  const shell = await readFile(path.join(distDirectory, "index.html"), "utf8");
  const repositoryDirectory = path.resolve(appDirectory, "..");
  const playersById = new Map();
  const matchesById = new Map();
  let availableDatasets = 0;

  for (const league of entityLeagues) {
    for (const dataset of league.datasets) {
      const sourcePath = path.resolve(repositoryDirectory, dataset.file);
      let snapshot;
      try {
        snapshot = JSON.parse(await readFile(sourcePath, "utf8"));
      } catch (error) {
        console.warn(`Skipped SEO entity data ${dataset.file}:`, error instanceof Error ? error.message : error);
        continue;
      }
      const records = Array.isArray(snapshot.matches) ? snapshot.matches.filter(validEntityMatch) : [];
      if (!records.length) continue;
      availableDatasets++;
      const scheduledById = new Map((Array.isArray(snapshot.schedule) ? snapshot.schedule : []).map((game) => [String(game.source_match_id), game]));
      for (const record of records) {
        const id = String(record.game.source_id);
        if (!/^[a-zA-Z0-9-]+$/.test(id)) continue;
        const candidate = { league, dataset, record, schedule: scheduledById.get(id) };
        const previous = matchesById.get(id);
        if (!previous || seasonRank(dataset.season) >= seasonRank(previous.dataset.season)) matchesById.set(id, candidate);
      }

      if (dataset.phase !== "regular") continue;
      const seasonPlayers = aggregateIndexedPlayers(records);
      for (const [id, player] of seasonPlayers) {
        if (!/^[a-zA-Z0-9-]+$/.test(id)) continue;
        const previous = playersById.get(id);
        if (!previous || seasonRank(dataset.season) >= seasonRank(previous.dataset.season)) playersById.set(id, { league, dataset, player });
      }
    }
  }

  let generatedPlayers = 0;
  for (const [id, { league, dataset, player }] of playersById) {
    const seasonLabel = dataset.season.replace("-", "–");
    const teams = [...player.teams.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
    const perGame = (key) => player.samples[key] ? formatOneDecimal(player.totals[key] / player.samples[key]) : null;
    const averages = [
      perGame("points") && `${perGame("points")} pistettä`,
      perGame("rebounds") && `${perGame("rebounds")} levypalloa`,
      perGame("assists") && `${perGame("assists")} syöttöä`,
    ].filter(Boolean).join(", ");
    const teamPhrase = teams.length ? `Joukkue${teams.length === 1 ? "" : "et"}: ${teams.join(", ")}. ` : "";
    const title = `${player.name} · ${league.name} ${seasonLabel} | KorisLab`;
    const description = `${player.name} – ${league.name}, kausi ${seasonLabel}: ${player.games} pelattua ottelua${averages ? `, ${averages} ottelua kohti` : ""}. Ottelumäärä ja saatavilla olevat box score -tilastot näytetään yhdessä.`;
    const url = scopedUrl(`/players/${encodeURIComponent(id)}/`, dataset.season, league.id);
    const teamLinks = teams.map((name) => {
      const teamUrl = scopedUrl(`/teams/${league.pathSlug}/${encodeURIComponent(teamSlug(name))}/`, dataset.season, league.id);
      return `<a href="${escapeAttribute(teamUrl.href)}">${escapeHtml(name)}</a>`;
    }).join(", ");
    const statItems = [
      ["Pelit", String(player.games)],
      ["Pisteet / ottelu", perGame("points") ?? "Ei saatavilla"],
      ["Levypallot / ottelu", perGame("rebounds") ?? "Ei saatavilla"],
      ["Syötöt / ottelu", perGame("assists") ?? "Ei saatavilla"],
      ["Peliaika / ottelu", player.games ? `${formatOneDecimal(player.totals.minutes / player.games)} min` : "Ei saatavilla"],
    ].map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");
    const summary = `<main class="seo-static-summary"><p class="seo-static-kicker">KorisLab · pelaajaprofiili</p><h1>${escapeHtml(player.name)}</h1><p>${escapeHtml(description)}</p><dl><div><dt>Sarja</dt><dd>${escapeHtml(league.name)}</dd></div><div><dt>Kausi</dt><dd>${escapeHtml(seasonLabel)}</dd></div><div><dt>Joukkue</dt><dd>${teamLinks || "—"}</dd></div>${statItems}</dl><p>${escapeHtml(teamPhrase)}Keskiarvot lasketaan pelaajan pelatuista otteluista. Pieni ottelumäärä näkyy pelimäärässä eikä sitä tulkita vakiintuneeksi tasoksi.</p><p><a href="${escapeAttribute(scopedUrl("/players/", dataset.season, league.id).href)}">Kauden pelaajatilastot</a> · <a href="https://tulospalvelu.basket.fi/">Lähde: Basket.fi:n tulospalvelu</a></p></main>`;
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      "@id": url.href,
      url: url.href,
      name: `${player.name} · ${league.name} ${seasonLabel}`,
      description,
      inLanguage: "fi",
      mainEntity: {
        "@type": "Person",
        "@id": `${url.href}#player`,
        name: player.name,
        description: `${teamPhrase}${description}`,
        memberOf: teams.map((name) => ({ "@type": "SportsTeam", name })),
      },
    };
    const html = pageHtml(shell, { title, description, url, structuredData, summary });
    const outputDirectory = path.join(distDirectory, "players", id);
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(path.join(outputDirectory, "index.html"), html, "utf8");
    sitemapUrls.add(url.href);
    generatedPlayers++;
  }

  let generatedMatches = 0;
  for (const [id, { league, dataset, record, schedule }] of matchesById) {
    const seasonLabel = dataset.season.replace("-", "–");
    const home = record.teams.find((team) => team.home_away === "home") ?? record.teams[0];
    const away = record.teams.find((team) => team.home_away === "away") ?? record.teams[1];
    const date = matchDate(record, schedule);
    const dateText = dateLabel(date);
    const periods = (record.game.periods ?? []).map((period) => `${period.period}. neljännes ${period.home_score}–${period.away_score}`).join(", ");
    const periodSentence = periods ? ` Neljännespisteet: ${periods}.` : "";
    const score = `${home.score}–${away.score}`;
    const title = `${home.name} – ${away.name} ${score} · ${league.name} ${seasonLabel} | KorisLab`;
    const description = `${league.name}, kausi ${seasonLabel}: ${home.name} ${score} ${away.name}.${dateText ? ` Ottelu pelattiin ${dateText}.` : ""}${periodSentence} Kooste perustuu varmennettuun ottelutilastoon.`;
    const url = scopedUrl(`/matches/${encodeURIComponent(id)}/`, dataset.season, league.id);
    const homeTeamUrl = scopedUrl(`/teams/${league.pathSlug}/${encodeURIComponent(teamSlug(home.name))}/`, dataset.season, league.id);
    const awayTeamUrl = scopedUrl(`/teams/${league.pathSlug}/${encodeURIComponent(teamSlug(away.name))}/`, dataset.season, league.id);
    const sourceUrl = safeSourceUrl(record);
    const startDate = date ? { startDate: date } : {};
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "SportsEvent",
      "@id": `${url.href}#event`,
      url: url.href,
      name: `${home.name} vs ${away.name} · ${league.name} ${seasonLabel}`,
      description,
      inLanguage: "fi",
      sport: "Basketball",
      eventStatus: "https://schema.org/EventCompleted",
      ...startDate,
      homeTeam: { "@type": "SportsTeam", name: home.name, url: homeTeamUrl.href },
      awayTeam: { "@type": "SportsTeam", name: away.name, url: awayTeamUrl.href },
      ...(home.score === away.score ? {} : { winner: { "@type": "SportsTeam", name: home.score > away.score ? home.name : away.name } }),
      ...(record.game.venue?.name ? { location: { "@type": "Place", name: record.game.venue.name } } : {}),
    };
    const summary = `<main class="seo-static-summary"><p class="seo-static-kicker">KorisLab · ottelukooste</p><h1>${escapeHtml(home.name)} – ${escapeHtml(away.name)} ${escapeHtml(score)}</h1><p>${escapeHtml(description)}</p><dl><div><dt>Sarja</dt><dd>${escapeHtml(league.name)}</dd></div><div><dt>Kausi</dt><dd>${escapeHtml(seasonLabel)}</dd></div>${dateText ? `<div><dt>Päivä</dt><dd>${escapeHtml(dateText)}</dd></div>` : ""}<div><dt>Lopputulos</dt><dd>${escapeHtml(score)}</dd></div>${periods ? `<div><dt>Neljännekset</dt><dd>${escapeHtml(record.game.periods.map((period) => `${period.home_score}–${period.away_score}`).join(" · "))}</dd></div>` : ""}<div><dt>Kotijoukkue</dt><dd><a href="${escapeAttribute(homeTeamUrl.href)}">${escapeHtml(home.name)}</a></dd></div><div><dt>Vierasjoukkue</dt><dd><a href="${escapeAttribute(awayTeamUrl.href)}">${escapeHtml(away.name)}</a></dd></div></dl><p>Ottelusivun pelaajatilastot perustuvat varmennettuun box score -aineistoon. Heittokartta ja tapahtumat näytetään, jos ne ovat saatavilla.</p><p><a href="${escapeAttribute(sourceUrl)}" rel="nofollow">Avaa ottelun lähdetilastot Basket.fi:ssä</a> · <a href="${escapeAttribute(scopedUrl("/matches/", dataset.season, league.id).href)}">Muut ${escapeHtml(seasonLabel)}-kauden ottelut</a></p></main>`;
    const html = pageHtml(shell, { title, description, url, structuredData, summary });
    const outputDirectory = path.join(distDirectory, "matches", id);
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(path.join(outputDirectory, "index.html"), html, "utf8");
    let dataHtml = shell.replace(/<title>[^<]*<\/title>/i, `<title>Otteludata · ${escapeAttribute(home.name)} – ${escapeAttribute(away.name)} | KorisLab</title>`);
    dataHtml = setMeta(dataHtml, "name", "robots", "noindex,follow");
    dataHtml = setMeta(dataHtml, "name", "description", `Ottelun ${home.name} – ${away.name} tilastojen saatavuus ja lähdetiedot.`);
    dataHtml = setCanonical(dataHtml, url.href);
    const dataDirectory = path.join(outputDirectory, "data");
    await mkdir(dataDirectory, { recursive: true });
    await writeFile(path.join(dataDirectory, "index.html"), dataHtml, "utf8");
    sitemapUrls.add(url.href);
    generatedMatches++;
  }

  await writeSitemap();
  return { generatedPlayers, generatedMatches, availableDatasets };
}

if (!siteUrl) {
  console.info("Team, player, and match SEO pages plus sitemap skipped: set VITE_SITE_URL or build with Vercel's production URL available.");
} else {
  try {
    const generated = await prerenderTeamProfiles();
    console.info(`Prerendered SEO metadata for ${generated} current-season team profiles and wrote sitemap.xml.`);
  } catch (error) {
    console.warn("Team profile SEO metadata could not be prerendered; the app build will continue.", error instanceof Error ? error.message : error);
  }
}

if (siteUrl) {
  try {
    const { generatedPlayers, generatedMatches, availableDatasets } = await prerenderPlayerAndMatchPages();
    console.info(`Prerendered ${generatedPlayers} player profiles and ${generatedMatches} verified game pages from ${availableDatasets} data snapshots.`);
  } catch (error) {
    console.warn("Player and game SEO pages could not be prerendered; the app build will continue.", error instanceof Error ? error.message : error);
  }
}

if (!projectId || !siteUrl) {
  console.info("Article social previews skipped: set VITE_SANITY_PROJECT_ID and VITE_SITE_URL, or build on Vercel with Sanity configured.");
  process.exit(0);
}

if (!/^[a-z0-9]+$/i.test(projectId) || !/^[a-z0-9_-]+$/i.test(dataset)) {
  console.warn("Article social previews skipped: the Sanity project ID or dataset is invalid.");
  process.exit(0);
}

try {
  const query = '*[_type == "analysisArticle" && defined(publishedAt) && dateTime(publishedAt) <= dateTime(now())] | order(publishedAt desc) { "slug": slug.current, title, standfirst, "coverUrl": coverImage.asset->url }';
  const params = new URLSearchParams({ query });
  const response = await fetch(`https://${projectId}.apicdn.sanity.io/v2025-01-01/data/query/${encodeURIComponent(dataset)}?${params}`);
  if (!response.ok) throw new Error(`Sanity returned ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload.result)) throw new Error("Sanity did not return an article list");

  const shell = await readFile(path.join(distDirectory, "index.html"), "utf8");
  let generated = 0;
  for (const article of payload.result) {
    const slug = typeof article.slug === "string" ? article.slug : "";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || typeof article.title !== "string" || typeof article.standfirst !== "string") continue;
    const articleUrl = `${siteUrl}/analyysit/${encodeURIComponent(slug)}/`;
    let html = shell.replace(/<title>[^<]*<\/title>/i, `<title>${escapeAttribute(article.title)} | KorisLab</title>`);
    html = setMeta(html, "name", "description", article.standfirst);
    html = setMeta(html, "name", "robots", "index,follow");
    html = setMeta(html, "property", "og:type", "article");
    html = setMeta(html, "property", "og:title", article.title);
    html = setMeta(html, "property", "og:description", article.standfirst);
    html = setMeta(html, "property", "og:url", articleUrl);
    html = setMeta(html, "property", "og:locale", "fi_FI");
    html = setMeta(html, "name", "twitter:card", typeof article.coverUrl === "string" ? "summary_large_image" : "summary");
    html = setMeta(html, "name", "twitter:title", article.title);
    html = setMeta(html, "name", "twitter:description", article.standfirst);
    if (typeof article.coverUrl === "string") {
      html = setMeta(html, "property", "og:image", article.coverUrl);
      html = setMeta(html, "name", "twitter:image", article.coverUrl);
    }
    html = setCanonical(html, articleUrl);
    const articleDirectory = path.join(distDirectory, "analyysit", slug);
    await mkdir(articleDirectory, { recursive: true });
    await writeFile(path.join(articleDirectory, "index.html"), html, "utf8");
    sitemapUrls.add(articleUrl);
    generated++;
  }
  await writeSitemap();
  console.info(`Prerendered social metadata for ${generated} published analysis article(s).`);
} catch (error) {
  console.warn("Article social previews could not be prerendered; the app build will continue.", error instanceof Error ? error.message : error);
}
