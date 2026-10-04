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
const configuredSiteUrl = buildEnv.VITE_SITE_URL?.trim();

if (!projectId || !configuredSiteUrl) {
  console.info("Article social previews skipped: set VITE_SANITY_PROJECT_ID and VITE_SITE_URL to prerender them.");
  process.exit(0);
}

if (!/^[a-z0-9]+$/i.test(projectId) || !/^[a-z0-9_-]+$/i.test(dataset)) {
  console.warn("Article social previews skipped: the Sanity project ID or dataset is invalid.");
  process.exit(0);
}

let siteUrl;
try {
  const parsed = new URL(configuredSiteUrl);
  if (!new Set(["https:", "http:"]).has(parsed.protocol) || parsed.username || parsed.password) throw new Error("Unsupported site URL");
  siteUrl = parsed.origin;
} catch {
  console.warn("Article social previews skipped: VITE_SITE_URL must be an http(s) site origin.");
  process.exit(0);
}

function escapeAttribute(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
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
    generated++;
  }
  console.info(`Prerendered social metadata for ${generated} published analysis article(s).`);
} catch (error) {
  console.warn("Article social previews could not be prerendered; the app build will continue.", error instanceof Error ? error.message : error);
}
