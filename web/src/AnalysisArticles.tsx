import { Fragment, useEffect, useState, type ReactNode } from "react";
import { useSeason, type SeasonId, type SeasonMatchRecord } from "./SeasonContext";
import { useI18n } from "./i18n";
import { routeHref } from "./routing";
import { Icon } from "./Icon";

type ArticleSummary = {
  slug: string;
  title: string;
  standfirst: string;
  publishedAt: string;
  league: "naisten-korisliiga" | "korisliiga";
  season: SeasonId;
  category: string;
  readingMinutes: number;
  coverUrl?: string;
  coverAlt?: string;
};

type ArticleSpan = { _key: string; text: string; marks?: string[] };
type MarkDefinition = { _key: string; _type: string; href?: string };
type TextBlock = {
  _key: string;
  _type: "block";
  style?: string;
  listItem?: "bullet" | "number";
  level?: number;
  markDefs?: MarkDefinition[];
  children?: ArticleSpan[];
};

type MatchQuarterBlock = {
  _key: string;
  _type: "matchQuarterChart";
  matchId: string;
  title?: string;
  caption?: string;
};

type ArticleImage = { _key: string; _type: "image"; assetUrl?: string; alt?: string };
type ArticleBlock = TextBlock | MatchQuarterBlock | ArticleImage;
type Article = ArticleSummary & { body: ArticleBlock[]; sourceNote: string };

const sanityProjectId = import.meta.env.VITE_SANITY_PROJECT_ID?.trim();
const sanityDataset = import.meta.env.VITE_SANITY_DATASET?.trim() || "production";
const sanityApiVersion = "2025-01-01";

async function sanityQuery<T>(query: string, params: Record<string, string> = {}): Promise<T> {
  if (!sanityProjectId) throw new Error("Content is not configured");
  const search = new URLSearchParams({ query });
  Object.entries(params).forEach(([key, value]) => search.set(`$${key}`, JSON.stringify(value)));
  const response = await fetch(`https://${sanityProjectId}.apicdn.sanity.io/v${sanityApiVersion}/data/query/${encodeURIComponent(sanityDataset)}?${search}`);
  if (!response.ok) throw new Error(`Content request failed (${response.status})`);
  const payload = await response.json() as { result: T };
  return payload.result;
}

const articleFields = `"slug": slug.current, title, standfirst, publishedAt, league, season, category, readingMinutes, "coverUrl": coverImage.asset->url, "coverAlt": coverImageAlt`;
const listQuery = `*[_type == "analysisArticle" && defined(publishedAt) && dateTime(publishedAt) <= dateTime(now())] | order(publishedAt desc) { ${articleFields} }`;
const articleQuery = `*[_type == "analysisArticle" && slug.current == $slug && defined(publishedAt) && dateTime(publishedAt) <= dateTime(now())][0] { ${articleFields}, sourceNote, body[] { ..., children[] { ..., marks }, markDefs[], "assetUrl": asset->url } }`;

function dateLabel(value: string, language: "fi" | "en") {
  return new Intl.DateTimeFormat(language === "fi" ? "fi-FI" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Helsinki" }).format(new Date(value));
}

function updateArticleMetadata(article: Article | null) {
  if (!article) return;
  document.title = `${article.title} | KorisLab`;
  const description = article.standfirst;
  const url = new URL(window.location.href);
  url.search = "";
  const setMeta = (selector: string, attribute: "name" | "property", key: string, content: string) => {
    let element = document.head.querySelector<HTMLMetaElement>(selector);
    if (!element) { element = document.createElement("meta"); element.setAttribute(attribute, key); document.head.append(element); }
    element.content = content;
  };
  setMeta('meta[name="description"]', "name", "description", description);
  setMeta('meta[property="og:type"]', "property", "og:type", "article");
  setMeta('meta[property="og:title"]', "property", "og:title", article.title);
  setMeta('meta[property="og:description"]', "property", "og:description", description);
  setMeta('meta[property="og:url"]', "property", "og:url", url.href);
  setMeta('meta[name="twitter:card"]', "name", "twitter:card", article.coverUrl ? "summary_large_image" : "summary");
  setMeta('meta[name="twitter:title"]', "name", "twitter:title", article.title);
  setMeta('meta[name="twitter:description"]', "name", "twitter:description", description);
  if (article.coverUrl) {
    setMeta('meta[property="og:image"]', "property", "og:image", article.coverUrl);
    setMeta('meta[name="twitter:image"]', "name", "twitter:image", article.coverUrl);
  } else {
    document.head.querySelector('meta[property="og:image"]')?.remove();
    document.head.querySelector('meta[name="twitter:image"]')?.remove();
  }
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.append(canonical); }
  canonical.href = url.href;
  const html = document.documentElement;
  html.lang = "fi";
}

function ArticleCard({ article, onOpen }: { article: ArticleSummary; onOpen: (article: ArticleSummary) => void }) {
  const { language, tr } = useI18n();
  const leagueName = article.league === "korisliiga" ? tr("Korisliiga", "Korisliiga") : tr("Naisten Korisliiga", "Women's Korisliiga");
  return <a className="analysis-article-card" href={routeHref("analysis-article", article.season, article.slug, article.league)} onClick={(event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onOpen(article);
  }}>
    {article.coverUrl ? <img className="analysis-article-image" src={article.coverUrl} alt={article.coverAlt ?? ""} loading="lazy" /> : <div className="analysis-article-image analysis-article-image--empty" aria-hidden="true"><span>01</span><i /></div>}
    <div className="analysis-article-card-copy">
      <div className="analysis-article-meta"><span>{leagueName}</span><span>{article.season.replace("-", "–")}</span></div>
      <h2>{article.title}</h2>
      <p>{article.standfirst}</p>
      <div className="analysis-article-byline"><time dateTime={article.publishedAt}>{dateLabel(article.publishedAt, language)}</time><span>{article.readingMinutes} {tr("min lukuaika", "min read")}</span><span>{article.category}</span></div>
    </div>
    <Icon name="arrowOutward" size={17} className="analysis-article-arrow" />
  </a>;
}

export function AnalysesIndex({ onOpenArticle }: { onOpenArticle: (slug: string, season: SeasonId, league: "naisten-korisliiga" | "korisliiga") => void }) {
  const { tr } = useI18n();
  const { seasonId, leagueId } = useSeason();
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error" | "unconfigured">(sanityProjectId ? "loading" : "unconfigured");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!sanityProjectId) { setState("unconfigured"); return; }
    setState("loading");
    sanityQuery<ArticleSummary[]>(listQuery).then((result) => {
      if (!cancelled) { setArticles(result); setState("ready"); }
    }).catch(() => { if (!cancelled) setState("error"); });
    return () => { cancelled = true; };
  }, [attempt]);

  const matchingArticles = articles.filter((article) => article.season === seasonId && article.league === leagueId);
  const open = (article: ArticleSummary) => onOpenArticle(article.slug, article.season, article.league);

  return <section className="analyses-page" aria-labelledby="analyses-page-title">
    <div className="analyses-intro">
      <div><h2 id="analyses-page-title">{tr("Mitä tuloksen taustalla tapahtui?", "What happened behind the score?")}</h2><p>{tr("Otteluanalyysejä ja kausivertailuja suomalaisesta koripallosta. Jokainen juttu näyttää, mitä datasta voi päätellä — ja missä sen rajat tulevat vastaan.", "Game analysis and season comparisons in Finnish basketball. Each story shows what the data supports — and where its limits begin.")}</p></div>
    </div>

    <div className="analyses-content-grid">
      <section className="analyses-list" aria-labelledby="analyses-list-title">
        <div className="analyses-section-heading"><div><h3 id="analyses-list-title">{tr("Uusimmat", "Latest")}</h3></div>{state === "ready" && <span>{String(matchingArticles.length).padStart(2, "0")}</span>}</div>
        {state === "loading" ? <div className="analyses-state" role="status">{tr("Ladataan analyysejä…", "Loading analysis…")}</div>
          : state === "error" ? <div className="analyses-state analyses-state--error" role="status"><strong>{tr("Julkaisuja ei saatu ladattua", "Could not load stories")}</strong><p>{tr("Yritä hetken kuluttua uudelleen.", "Try again in a moment.")}</p><button className="text-button" type="button" onClick={() => setAttempt((value) => value + 1)}>{tr("Yritä uudelleen", "Try again")}</button></div>
            : matchingArticles.length ? <div className="analysis-article-list">{matchingArticles.map((article) => <ArticleCard key={article.slug} article={article} onOpen={open} />)}</div>
              : <div className="analyses-state analyses-state--empty"><span>{tr("KORISLAB · ANALYYSIT", "KORISLAB · ANALYSIS")}</span><div><strong>{articles.length === 0 ? tr("Ensimmäinen analyysi julkaistaan pian.", "The first analysis will be published soon.") : tr("Tälle sarjalle ja kaudelle ei ole vielä juttuja.", "There are no stories for this league and season yet.")}</strong><p>{articles.length === 0 ? tr("Tänne tulevat jutut, joissa ottelun tulos avataan pelin kulun, heittovalintojen ja vertailukelpoisen datan kautta.", "This is where game results are explored through game flow, shot selection and comparable data.") : tr("Valitse toinen sarja tai kausi, niin näet sen julkaisut.", "Choose a different league or season to see its stories.")}</p></div></div>}
      </section>

      <aside className="analyses-method-panel" aria-labelledby="analyses-method-title">
        <h3 id="analyses-method-title">{tr("Havainto, joka kestää tarkistamisen.", "A finding that stands up to scrutiny.")}</h3>
        <ol><li><span>01</span><div><strong>{tr("Kysymys", "Question")}</strong><p>{tr("Mikä pelissä tai joukkueen alussa herätti huomion?", "What stood out in the game or team’s start?")}</p></div></li><li><span>02</span><div><strong>{tr("Vertailu", "Comparison")}</strong><p>{tr("Näytämme saman luvun suhteessa joukkueen tai sarjan lähtötasoon.", "We compare the figure with the team’s or league’s baseline.")}</p></div></li><li><span>03</span><div><strong>{tr("Raja", "Limit")}</strong><p>{tr("Kerrotaan myös, mitä yhdestä ottelusta ei vielä voi päätellä.", "We also say what one game cannot yet tell us.")}</p></div></li></ol>
        <div className="analyses-method-foot"><span>{tr("TILASTO", "STAT")}</span><span>×</span><span>{tr("KONTEKSTI", "CONTEXT")}</span><span>×</span><span>{tr("RAJAUS", "SCOPE")}</span></div>
      </aside>
    </div>
  </section>;
}

function QuarterScoreChart({ matchId, season, title, caption }: { matchId: string; season: SeasonId; title?: string; caption?: string }) {
  const { tr } = useI18n();
  const { loadMatchesForSeason } = useSeason();
  const [match, setMatch] = useState<SeasonMatchRecord | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    setMatch(null); setStatus("loading");
    loadMatchesForSeason(season).then((matches) => {
      if (!cancelled) { setMatch(matches.find((item) => item.game.source_id === matchId) ?? null); setStatus("ready"); }
    }).catch(() => { if (!cancelled) setStatus("error"); });
    return () => { cancelled = true; };
  }, [loadMatchesForSeason, matchId, season]);

  const periods = match?.game.periods ?? [];
  const maxPoints = Math.max(1, ...periods.flatMap((period) => [period.home_score, period.away_score]));
  if (status !== "ready" || !match) return <figure className="analysis-data-visual"><h3>{title ?? tr("Pisteet neljänneksittäin", "Points by quarter")}</h3><p role="status">{status === "error" ? tr("Otteludataa ei saatu ladattua.", "Could not load game data.") : status === "loading" ? tr("Ladataan ottelun varmennettuja pistetietoja…", "Loading verified game scores…") : tr("Tälle jutulle ei löytynyt varmennettua otteludataa.", "No verified game data was found for this story.")}</p>{caption && <figcaption>{caption}</figcaption>}</figure>;

  const home = match.teams.find((team) => team.home_away === "home") ?? match.teams[0];
  const away = match.teams.find((team) => team.home_away === "away") ?? match.teams[1];
  const scoreSummary = periods.map((period) => `${period.period}. ${period.home_score}–${period.away_score}`).join(", ");
  return <figure className="analysis-data-visual"><div className="analysis-data-visual-heading"><div><span>{tr("OTTELUDATA", "GAME DATA")} · #{matchId}</span><h3>{title ?? tr(`${home.name} ja ${away.name} neljänneksittäin`, `${home.name} and ${away.name} by quarter`)}</h3></div><div className="analysis-chart-legend"><span><i />{home.name}</span><span><i className="analysis-chart-legend-away" />{away.name}</span></div></div>
    <div className="analysis-quarter-chart" role="img" aria-label={tr(`${home.name}: ${scoreSummary}; ${away.name}: ${periods.map((period) => `${period.period}. ${period.away_score}`).join(", ")}`, `${home.name}: ${scoreSummary}; ${away.name}: ${periods.map((period) => `${period.period}. ${period.away_score}`).join(", ")}`)}>{periods.map((period) => <div className="analysis-quarter-group" key={period.period}><div className="analysis-quarter-bars"><div className="analysis-quarter-bar-wrap"><span>{period.home_score}</span><i style={{ height: `${Math.max(3, (period.home_score / maxPoints) * 100)}%` }} /></div><div className="analysis-quarter-bar-wrap analysis-quarter-bar-wrap--away"><span>{period.away_score}</span><i style={{ height: `${Math.max(3, (period.away_score / maxPoints) * 100)}%` }} /></div></div><small>{period.period}. {tr("neljännes", "quarter")}</small></div>)}</div>
    {caption && <figcaption>{caption}</figcaption>}
  </figure>;
}

function ArticleBody({ article }: { article: Article }) {
  const content: ReactNode[] = [];
  const blocks = article.body ?? [];
  for (let index = 0; index < blocks.length;) {
    const block = blocks[index];
    if (block._type === "block" && block.listItem) {
      const listType = block.listItem;
      const level = block.level ?? 1;
      const items: TextBlock[] = [];
      while (index < blocks.length) {
        const item = blocks[index];
        if (item._type !== "block" || item.listItem !== listType || (item.level ?? 1) !== level) break;
        items.push(item);
        index++;
      }
      const List = listType === "number" ? "ol" : "ul";
      content.push(<List className="analysis-article-list-block" key={block._key}>{items.map((item) => <li key={item._key}>{renderInline(item)}</li>)}</List>);
      continue;
    }
    if (block._type === "matchQuarterChart") content.push(<QuarterScoreChart key={block._key} matchId={block.matchId} season={article.season} title={block.title} caption={block.caption} />);
    else if (block._type === "image") content.push(block.assetUrl ? <figure className="analysis-article-inline-image" key={block._key}><img src={block.assetUrl} alt={block.alt ?? ""} loading="lazy" /></figure> : null);
    else content.push(<TextBlockView key={block._key} block={block} />);
    index++;
  }
  return <div className="analysis-article-body">{content}</div>;
}

function safeArticleHref(href: string) {
  try {
    const url = new URL(href, window.location.origin);
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

function renderInline(block: TextBlock) {
  return block.children?.map((child) => {
    let content: ReactNode = child.text;
    for (const mark of [...(child.marks ?? [])].reverse()) {
      if (mark === "strong") content = <strong>{content}</strong>;
      else if (mark === "em") content = <em>{content}</em>;
      else if (mark === "code") content = <code>{content}</code>;
      else {
        const definition = block.markDefs?.find((item) => item._key === mark && item._type === "link");
        const href = definition?.href ? safeArticleHref(definition.href) : null;
        if (href) {
          const external = new URL(href).origin !== window.location.origin;
          content = <a href={href} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>{content}</a>;
        }
      }
    }
    return <Fragment key={child._key}>{content}</Fragment>;
  });
}

function TextBlockView({ block }: { block: TextBlock }) {
  const children = renderInline(block);
  if (block.style === "h2") return <h2>{children}</h2>;
  if (block.style === "h3") return <h3>{children}</h3>;
  if (block.style === "blockquote") return <blockquote>{children}</blockquote>;
  return <p>{children}</p>;
}

export function AnalysisArticlePage({ slug, onBack }: { slug: string; onBack: () => void }) {
  const { language, tr } = useI18n();
  const { seasonId, leagueId } = useSeason();
  const [article, setArticle] = useState<Article | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error" | "unconfigured">(sanityProjectId ? "loading" : "unconfigured");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setArticle(null);
    if (!sanityProjectId) { setState("unconfigured"); return () => { cancelled = true; }; }
    setState("loading");
    sanityQuery<Article | null>(articleQuery, { slug }).then((result) => {
      if (cancelled) return;
      setArticle(result); setState("ready");
      if (result) updateArticleMetadata(result);
    }).catch(() => { if (!cancelled) setState("error"); });
    return () => { cancelled = true; };
  }, [slug, attempt]);

  if (state === "loading") return <div className="analysis-article-state" role="status">{tr("Ladataan analyysiä…", "Loading analysis…")}</div>;
  if (state === "error") return <div className="analysis-article-state" role="alert"><strong>{tr("Analyysiä ei saatu ladattua", "Could not load the analysis")}</strong><p>{tr("Tarkista yhteys ja yritä uudelleen.", "Check the connection and try again.")}</p><button className="outline-button" type="button" onClick={() => setAttempt((value) => value + 1)}>{tr("Yritä uudelleen", "Try again")}</button></div>;
  if (!article) return <div className="analysis-article-state"><span>{state === "unconfigured" ? tr("KORISLAB · ANALYYSIT", "KORISLAB · ANALYSIS") : "404 / ANALYYSIT"}</span><h1>{state === "unconfigured" ? tr("Analyysit avautuvat pian.", "Analysis will be available soon.") : tr("Analyysiä ei löytynyt.", "Analysis not found.")}</h1><p>{state === "unconfigured" ? tr("Ensimmäiset analyysit julkaistaan täällä.", "The first analysis will appear here.") : tr("Tarkista linkki tai palaa julkaisujen listaan.", "Check the link or return to the stories list.")}</p><button className="outline-button" type="button" onClick={onBack}>{tr("Palaa analyyseihin", "Back to analysis")} <Icon name="arrowBack" size={15} /></button></div>;

  const shareUrl = typeof window === "undefined" ? "" : new URL(routeHref("analysis-article", article.season, article.slug, article.league), window.location.origin).href;
  const shareText = `${article.title} · KorisLab`;
  return <article className="analysis-article-page" lang="fi">
    <a className="analysis-back-link" href={routeHref("analyses", seasonId, undefined, leagueId)} onClick={(event) => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onBack(); } }}><Icon name="arrowBack" size={15} />{tr("Kaikki analyysit", "All analysis")}</a>
    <header className="analysis-article-header">
      <div className="analysis-article-meta"><span>{article.league === "korisliiga" ? "Korisliiga" : tr("Naisten Korisliiga", "Women's Korisliiga")}</span><span>{article.season.replace("-", "–")}</span><span>{article.category}</span></div>
      <h1>{article.title}</h1><p className="analysis-article-standfirst">{article.standfirst}</p>
      <div className="analysis-article-byline"><time dateTime={article.publishedAt}>{dateLabel(article.publishedAt, language)}</time><span>{article.readingMinutes} {tr("min lukuaika", "min read")}</span><a className="analysis-share-link" href={`https://twitter.com/intent/tweet?${new URLSearchParams({ text: shareText, url: shareUrl })}`} target="_blank" rel="noreferrer">{tr("Jaa X:ssä", "Share on X")} <Icon name="arrowOutward" size={14} /></a></div>
    </header>
    {article.coverUrl && <img className="analysis-article-cover" src={article.coverUrl} alt={article.coverAlt ?? ""} />}
    <ArticleBody article={article} />
    <footer className="analysis-article-footer"><span>{tr("AINEISTO JA RAJAUKSET", "DATA AND LIMITS")}</span><p>{article.sourceNote}</p></footer>
  </article>;
}
