# KorisLab: discovery and HTTP responses

Implementation date: 11 October 2026. Target production origin: https://korislab.vercel.app.

## What is implemented

- `server/seo.mjs`: one tested page resolver and HTML renderer for Sites, Vercel and local development. Unknown addresses, unsupported explicit seasons and missing entity records return HTTP 404. GET and HEAD preserve the same status, with no HEAD body.
- `scripts/build-seo.mjs`: 1,975 scoped metadata/summary entries from the same six season snapshots and validated match/player aggregation used by the UI. Each entity page is resolved within its selected league and season. Player summaries expose PTS/REB/AST per played appearance; team summaries expose recorded wins/losses and scoring averages; match summaries distinguish verified results from fixtures and missing statistics.
- Metadata, canonical URL, visible heading and facts exist in the initial HTML, before React. The same response goes to readers and crawlers; there is no user-agent-specific content. React replaces the static summary with the interactive app, rather than duplicating hidden SEO text.
- Schema.org WebSite, WebPage/CollectionPage/ProfilePage, Person, SportsTeam, SportsEvent and BreadcrumbList describe visible content. They do not claim current player affiliation from a historical season, fabricated prizes, ratings, licence, or full coverage.
- Generated XML sitemap includes only indexable pages. Private tools, search results, prototype catalogue, unimplemented analyses and team-ID aliases are excluded. Tracking queries are stripped from canonical URLs; league and season are retained; match subviews canonicalize to their game. Static data source update labels are source timestamps, not artificial build dates.
- Production permits ordinary search crawlers and OAI-SearchBot. Other origins receive noindex and a robots policy excluding crawling, plus an empty sitemap. Error pages have no canonical and no entity structured data. Client-side navigation clears stale JSON-LD and applies noindex to missing records.
- Local Vite middleware uses the generated manifest to make actual local HTTP status checks possible. The server-side summary is Finnish. English remains a browser setting: no invented alternate language URLs or hreflang are emitted.

## Deployment outputs

`npm run build` produces `dist/client`, the Sites worker in `dist/server`, and `.vercel/output` using Vercel Build Output API v3. Vercel output routes static assets through the filesystem and navigation through a Node function; query-dependent season pages therefore retain the correct facts. The static homepage shell is not allowed to bypass the renderer. Configure the new project/root to build `prototypes/paper-home`; verify the generated output in a preview before changing the current production project.

The UI's build pipeline needs Node >=22.18 for native TypeScript stripping in the source aggregation imports. Vercel runtime is nodejs22.x. `server/vercel.mjs` reads the generated manifest and template beside its function entrypoint. Sites reads these through its ASSETS binding. Neither runtime calls Basket.fi or invents a live feed.

## GEO / ChatGPT discovery

This creates eligibility and readable evidence, not a ranking guarantee. Public Finnish summaries explain what KorisLab provides, identify league/season, give exact statistics with samples and link to original sources. Schema describes those facts; there is no special AI-only markup. Search visibility does not require consenting to model training. The explicit OAI-SearchBot rule concerns retrieval/search; no separate GPTBot policy was changed.

After production deployment: verify OAI-SearchBot is not blocked by Vercel protection or a firewall; submit sitemap and inspect representative URLs in Google Search Console and Bing Webmaster Tools. No account submission or analytics service was performed here. Observe referral traffic such as `utm_source=chatgpt.com` if existing analytics supports it. Use a small Finnish question set (“mistä löydän Naisten Korisliigan pelaajatilastot?”, team comparisons, historical player stats) as a baseline, repeat over time, and record citations rather than claiming guaranteed recommendations. Relevant editorial links from teams, basketball media or researchers are a separate outreach task, not automated here.

## Release gate

Do not replace the current live version until its before screenshots have been saved and matched to new after screenshots. Identical viewport, league, season, entity, filters and scroll position are required for the case comparison. Unknown HTTP 404, known entity 200, preview noindex, production sitemap, GET/HEAD, private resources and missing records must pass integration checks. Changes are prepared locally; production has not been replaced.

## Sources

- [Google: JavaScript SEO and meaningful HTTP responses](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- [Google: AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)
- [OpenAI: publishers and developers FAQ](https://help.openai.com/en/articles/12627856)
- [OpenAI: crawlers](https://developers.openai.com/api/docs/bots)
- [Vercel: Build Output configuration](https://vercel.com/docs/build-output-api/configuration)
- [Vercel: function primitives](https://vercel.com/docs/build-output-api/primitives)
