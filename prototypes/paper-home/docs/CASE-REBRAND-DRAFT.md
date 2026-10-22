# KorisLab rebrand — case draft

Draft for [petu.design/korislab](https://www.petu.design/korislab/), 11 October 2026. English copy follows the current portfolio. This is a working document, not a published case update. The original case already covers search, analytics, data validation and earlier SEO work; describe this work as the next iteration, not a first implementation of those capabilities.

## Proposed opening

### A clearer home for Finnish basketball data

KorisLab began with a question: how could I compare Finnish basketball teams and players beyond a single box score? The first version connected season statistics, player profiles and match analysis. As its tools grew, I wanted the interface to make that depth easier to find and read.

I redesigned KorisLab around a consistent visual language and a more connected path from a question to the underlying evidence. The work spans the brand, navigation, charts, profiles and the less visible parts of a product: loading states, missing data and discoverability.

Role: Product design, interface development and analytics. Scope: the men’s and women’s Korisliiga. Status: the new version is being prepared alongside the existing live product; production migration is pending.

## TL;DR cards

**Problem — More depth, harder to read.** As views accumulated, the product needed clearer hierarchy and consistent routes between a season, a team, a player and a match.

**Contribution — A visual system tied to real interactions.** I developed the new identity and interface in code, documented its reusable components, and created an editable design-system reference in Paper. Charts and comparisons retain their samples, units and source context.

**Current state — Working redesign, staged migration.** The new local version includes the primary data views, supported search answers, Matchup Lab, recovery states and server-readable content. It has not replaced the existing live site, and visibility or usability gains have not yet been measured.

## Full case copy

### Turn the visual direction into a working product

The initial dashboard reference became an interactive overview shared between the home-page preview and the full application. Team filters, comparison metrics and links lead into the actual data views. That shared component keeps the entry point consistent with the product people use after it.

The new look uses restrained dark surfaces, white text, orange data accents and KorisLab’s green brand colour. Dither adds character to the hero and selected highlights; the charts and tables stay clean. Typography, spacing and static shadows separate supporting labels from the figures that matter.

*[Visual: first matched Overview pair saved in `case-assets/`, 1440×900, Naisten Korisliiga 2025–26. These are source captures, not the slider component.]*

### Use hierarchy to explain the numbers

A chart needs more than a line. I added units, ranges, real last-five-game values and league baselines where they help explain a comparison. Game-level details are available through hover, focus or touch. Missing data stays missing rather than becoming an invented zero.

In tables, player names and team context have different visual emphasis. Sort controls show the active metric. Winners’ scores are brighter than losers’ scores, keeping results scannable without colouring every number. Player and team profiles connect identity, season statistics, recent games and the available shot or assist data.

*[Visual: a compact player identity area with latest-game stats and season cards; match results with clear score hierarchy.]*

### Make the layout suit the device

Desktop data views keep navigation available while the content area scrolls. On the home page, the page itself scrolls. Mobile navigation collapses into a menu and gives the search field its own full-width row. Horizontally arranged match cards also accept touch scrolling.

I reduced repeated headings and navigation links, then adjusted card density separately for desktop and mobile. The aim was to use the available space without turning every view into a longer list of large cards.

*[Visual: the same profile at desktop and mobile sizes.]*

### Add movement with a purpose

Menus, settings and view changes use brief transitions. Below the home-page dashboard, content appears as it enters the viewport; selected bars and counters animate together. The animation starts when the content is visible, rather than finishing before a reader reaches it.

The larger search button keeps its material effect on the home page; the navigation version remains static. Reduced-motion preferences remove unnecessary movement. Motion supports orientation and feedback without making the figures harder to compare.

*[Visual: short motion clip, alongside a still image rather than forcing animation on the reader.]*

### Build a system that can be edited

I extracted shared colours, typography, radii, shadows and motion timings into a design-system catalogue. It also includes controls, identity elements and data patterns. Paper holds an editable reference for design exploration; the application remains the place to verify behaviour and responsive layouts. The two are not automatically synchronised.

An interactive design-system page makes loading, empty and error states visible alongside the successful states. This avoids treating resilience as an implementation detail that only appears when something breaks.

*[Visual: selected design tokens and a small set of real components, not an exhaustive catalogue screenshot.]*

### Treat loading and missing pages as part of the product

Loading placeholders follow the main shapes of lists and profiles. Failed data requests have an explicit retry action, while empty filters can be cleared. A player missing from a selected season is distinguished from an unknown address. The former suggests checking the season; the latter opens a recovery page with useful routes back into the product.

The server now returns a genuine HTTP 404 for missing pages. The earlier interface-only recovery page could not communicate that state to a crawler through its HTTP response. The new behaviour preserves the designed recovery view while making the response meaningful outside the browser interface.

*[Visual: 404 and a compact loading/error example.]*

### Preserve discoverability through the redesign

The existing product already had metadata, canonical URLs, a sitemap and pre-rendered summaries. I carried that foundation into the new architecture and extended its coverage to league-and-season-specific home, directory, team, player and match views.

The build creates 1,975 scoped summary entries from the same copied datasets used by the application. Readers and crawlers receive factual headings, statistics, samples and source links before JavaScript runs. The interactive application then replaces that summary. Canonical URLs retain the season and league, discard tracking parameters and connect match subviews to their underlying game.

Public production pages permit OpenAI’s search crawler; preview and internal tool pages remain excluded from indexing. The work creates clearer evidence for search engines and AI-assisted discovery, particularly for Finnish basketball questions. It does not guarantee that ChatGPT will recommend KorisLab or that search traffic will increase.

*[Visual: one UI profile beside an annotated HTML response showing the same facts and source.]*

### Keep the claims proportional to the evidence

The redesign still uses recorded data with uneven coverage. Verified box scores, estimated possession metrics and event-based on/off comparisons have different limits. A short sample or a visible difference is not evidence of causation.

At this stage, validation covers source parity, calculation logic, routes, response codes and representative desktop/mobile interactions. The test suite currently has 101 passing tests; this is engineering evidence, not proof of user comprehension or production search performance. The next stage is to capture matched comparisons, review the redesigned flows with users and validate the new deployment before replacing the live version.

## Before–after component brief — intentionally not implemented

One image-sized frame contains two screenshots of the **same** view. A divider/handle can be dragged left and right to reveal the previous interface beneath the new one. This is an image reveal, not a horizontally scrolling carousel or a 3D treatment.

- Fixed aspect ratio; the images share dimensions and aligned crops.
- Visible “Before” and “After” labels. Start at 50%, with a small handle and unobtrusive hint.
- Mouse and touch drag, keyboard left/right with Home/End, accessible slider label and position. Provide separate-image links or a toggle alternative for readers who cannot use the slider.
- No auto-animation. Respect reduced motion, constrain the handle inside the frame, and prevent horizontal drag from unexpectedly scrolling the page.
- Caption explains one concrete change. Do not use it to imply measured performance improvements.

Capture plan before migration: primary pair is Overview; optional second pair is a player profile. Record viewport dimensions, league, season, entity ID, filters, active tabs and scroll position with both images. Use the same source data and avoid hover/tooltips or transient loading states unless comparing those states deliberately. Save the original screenshots before replacing the old live version.

## Editorial notes before publication

Confirm deployment status, replace placeholders with actual matched screenshots, update test count if it changes, and keep the copy aligned with what shipped. Do not call staged local work live. Do not claim improved retention, speed, accessibility compliance, search ranking or AI citations without measurement. Review the existing on/off example independently; do not reuse its numerical claim as new rebrand evidence.
