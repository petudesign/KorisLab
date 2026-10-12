# KorisLab design system 0.1

Paper: https://app.paper.design/file/01M2MMJYJ5ADS11SD1CQ75MJZM/p-2-0
Local catalog: http://127.0.0.1:5174/design-system/

## Editing and handoff

The Paper page **KorisLab · Design system** contains four editable artboards:
1. Tyyliperusta: brand SVG, colors, typography, spacing, radii, elevation.
2. Haut ja valinnat: search states, buttons, select/open menu, tabs and focus.
3. Data ja identiteetit: metric cards, actual recent-game chart samples, table lanes, team logos, match card and player identity.
4. Navigaatio, liike ja tilat: desktop/mobile navigation, motion rules and proposed loading/error/404 patterns.

`source/design-tokens.json` records all 61 Paper tokens. `src/design-tokens.css` uses the same variable names and values and is loaded by the app. `src/DesignSystem.jsx` is an interactive local catalog using the real BrandMark, TeamLogo and MetalFx components. Native inputs, season selection, tabs and the current dialog transition can be tested there. Do not add this internal catalog to the product navigation.

Paper edits do **not** sync automatically. Change the corresponding token in JSON and CSS, update its affected production components, then compare both versions. Existing screens still contain local literal CSS values; migration to shared primitives/tokens is incremental. This first pass establishes the reference rather than rewriting every component.

## Current rules

- Inter 400–600 for UI, Cal Sans 400 for headings, Array Semibold 600 for hero display.
- Array is available in the website's `/fonts/Array-Semibold.woff2` but not currently available in Paper. The foundation artboard documents this explicitly instead of substituting a different font.
- Brand mark may stand alone; KorisLab text accompanies the mark. Lab uses #44d17a.
- Orange #df945b is the main interaction/data accent. Brand/positive green #44d17a. Negative #e18b8b and series blue #91b4c8 are documented semantic defaults; existing metric contexts may have local shades pending consolidation.
- Positive/negative always follow the metric's desired direction. Series colors identify teams, not automatically performance. Winner score #f3f3f4, loser #929297.
- Dither stays behind hero/highlight content; charts and tables stay clean. Glow belongs to area fills or deliberately selected large values, not all text.
- Actual last five games, oldest on the left, with units, context, league average and hover/focus detail. Missing data is —, never invented zero.
- UI averages use one decimal, totals integers. Finnish differences use % without %-yks.
- Radii: controls 6–8 px, cards 12–16 px, hero 24 px. Existing surface shadows come from `src/elevation.css`.
- Select arrow has 12 px right inset and 40 px reserved padding. Mobile touch targets at least 44 px. Visible focus must not clip.
- Desktop data pages keep sidebar and top navigation; mobile puts brand/menu above a full-width search. No duplicate view links in desktop top navigation.
- Motion: 120 ms feedback, 180 ms menus/view entry, 250 ms dialogs, 600 ms home reveals/bars/counters. Ease-out (.23,1,.32,1), bar easing (.77,0,.175,1). Respect reduced motion and keyboard paths. Paper states are static, animation is verified in code.

## Loading and recovery states

`PageStates.jsx` and `page-states.css` implement shared skeletons, retry/empty state cards, offline notice and an app-level render error boundary. Match/player/team/search/trend/Matchup views use the shared states. Skeletons expose one loading announcement, hide decorative shapes from assistive technology and become static with reduced motion. Filter selections survive failed requests; clearing filters is explicit. Switching seasons cancels obsolete match requests and never displays the previous season's records.

Unknown paths show a 404 recovery page with season-aware navigation. A record absent from the selected season instead explains the missing data and suggests changing season. The catalogue contains real loading/error/empty examples. The shared server resolver now returns actual HTTP 404 for missing routes and records. Sites and Vercel deployment outputs include the renderer; production migration is pending. Paper artboards have not been resynced with these changes.

## Remaining review

Paper weekly MCP quota was reached after the four artboards were written. Foundation and controls were visually verified. Data was reviewed and its incorrect language and logo references corrected; the final ORB SVG render needs another visual check. The last navigation/status artboard could not be visually checked because of the quota. The working-indicator cleanup succeeded. Follow up when Paper tools become available. Extend with full player/team leader cards, heittokartta, tooltip, trophy cabinet, search answer variants and full responsive page compositions.

## Materiaalikokeilu (11.10.2026)

Katalogin ensimmäisessä kokeiluosiossa ovat tyylitelty oikea 3D-palkintokaappi sekä Fog- ja BrushedMetal-esimerkit. Ei vielä Paperiin synkronoitu. `TrophyCabinet.jsx` käyttää samoja varmennettuja palkintomerkintöjä kuin pelaajaprofiilit. Three.js-moduuli ladataan vasta kaapin lähestyessä näkyvää aluetta, renderöinti toimii tarpeen mukaan ja kaikki GPU-resurssit vapautetaan poistuttaessa. Kaappi on paikallaan. Siinä ei ole vetämistä, kääntöpainikkeita tai palkinnon valinnan animaatiota. Palkinnot esitetään nimilistana; saman palkinnon kaudet yhdistetään ja kausiluvut avaavat lähteen. Otsikon koristeikoni poistettu. Metallisten esineiden geometria on tyyliteltyä, ei kuva virallisesta pokaalista.

`HeroFog.jsx` korvaa etusivun dashboardin aiemman staattisen alushaze-kerroksen hillityllä Fog-efektillä; staattinen gradientti jää varatyyliksi. Reduced motion ei käynnistä Fog-shaderia. BrushedMetal on erillinen materiaalinäyte; oikeiden 3D-esineiden metallipinta tuotetaan Three.js:n materiaaleilla ja hienolla proseduraalisella pintatekstuurilla. Shader Effects -telemetria pois molemmista. WebGPU:n puuttuessa käyttöliittymä ja tekstit säilyvät.

Kustannus: Shader Effects 4.0.4 tuo noin 728 kt gzip / 2.63 Mt raakaa JavaScriptiä ja Three.js-kaappi noin 144 kt gzip / 565 kt raakaa. Molemmat erillisiä lazy chunkkeja; CSS/SVG-graafeihin ei tuoda tätä riippuvuutta. Arvioi erityisesti udun hyöty suhteessa latauskustannukseen ennen tuotantopäätöstä.

Varmennus: IAB-työpöytä 1440×900 ja mobiili 390×844, palkintotietojen/lähdelinkkien säilyminen ja udun päällä/pois-vertailu. Tarkistettu tumma paletti, metallien heijastukset, kaapin syvyys, tekstien hierarkia ja mobiilin vaakaylivuoto. Kuvagenerointia ei tarvittu: kyse on nykyisen design systemin komponenttikokeilusta ja käyttäjän pyytämästä aidosta 3D-geometriasta.
