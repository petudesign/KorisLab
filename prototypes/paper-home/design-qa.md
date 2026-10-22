# Paper prototype visual QA

Source: current Paper canvas, preserved in source/paper-export.jsx and qa/paper-source.png. Initial comparison is qa/comparison.png. Existing KorisLab web app remains separate.

## Accepted deviations, 2026-10-10

- Navigation 97 → 76 px and desktop match cards 118 → 92 px in the 1366 px reference canvas. Mobile match row 90 → 76 px.
- Array Semibold replaces Bitcount, using the original KorisLab decrypted-text animation.
- Original chromatic MetalFx circle search button replaces the plain arrow button.
- Dashboard shadow now has zero horizontal and vertical offsets, equal blur on both sides, and reduced alpha (0.22).
- Material Icons in navigation and horizontal match scrolling remain enabled.

## Verification

Vite production build passed. In-app browser verified desktop and 390 × 844 mobile: content renders, no overlay or page horizontal overflow, Array font loaded, shadow geometry symmetric, MetalFx visible, ToPo search opens results, match next/previous controls scroll the rail. No new console errors after the fixes. The initial dynamic dependency refresh produced a React duplicate error; resolve.dedupe prevents it. MetalFx initialization did not survive StrictMode effect replay reliably, so the isolated prototype mounts once.

Current screenshot: /tmp/korislab-updated.jpg. Earlier QA screenshots remain the initial Paper comparison, before the accepted deviations.

## Limits

Dashboard image and matches are reference content. Only the basic team search is wired to the copied season aggregate. Other sections remain prototype dialogs. Shader motion and reduced-motion handling use the original components; cross-browser QA has not been performed.

## Compact refinement

Navigation now 64 px, match row 80 px (mobile 70 px), 16 px corner radii. A fixed overlay border encloses the scroll viewport including its right edge, without intercepting clicks. Tools and Settings icons open labelled prototype dialogs; their full contents remain future work. Hero uses a 64 px centered heading/subtitle, 18/27 px supporting copy, and 15 px search guidance. Player photos use CSS saturation/brightness adjustments and a bottom mask fade; source image files are preserved.

Verified desktop and 390 × 844 mobile, utility dialogs open/close, match scroll reaches the end, fixed right border remains 1 px, and no page horizontal overflow. Production build passed. Current screenshot: /tmp/korislab-compact.jpg.

## Interactive overview first pass

Replaced the dashboard image with reusable OverviewDashboard. Hero preview and #overview share the same component. Statistics derive from the copied season aggregate; sparkline shows team point averages, not a time trend. Team selector, ranking metric selector, metric-card buttons, team rows and sidebar tabs update state. The top navigation and preview button open the expanded page; brand returns home.

Verified ToPo returns 71.1 points/game and eFG selection changes the ranking. Desktop preview and expanded layout inspected, mobile has no horizontal page overflow and preview fits its frame. Production build passed. Screenshot /tmp/korislab-overview.jpg shows expanded first pass. Match rail remains sample content; this is an initial overview layout, not the entire existing application.

## Homepage continuation and sticky navigation

Added season insight using highest eFG team, a comparison using real season per-game points/assists/turnovers with expandable observation, teams/player entry cards, and footer. Navigation sits outside the scaled canvas so sticky positioning works. Nav search returns ToPo 71.1 points/game from the lower page. Team entry opens the nine-team table. Player route remains a prototype dialog.

Verified sticky header top is 12 px on desktop after scrolling 1588 px. Mobile viewport 390 px has no horizontal overflow. Scoped mobile dashboard sizing corrected an import-order regression; measured preview width 323 px and all nine table rows available. MetalFx visible after reload. Production build passed.
