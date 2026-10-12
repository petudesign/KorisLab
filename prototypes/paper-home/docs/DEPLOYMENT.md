# KorisLab deployment and current-season data

Production URL: https://korislab.vercel.app. The existing Vercel project is `petudesigns-projects/korislab`, linked to the GitHub main branch. Its Root Directory is `prototypes/paper-home`; the original `web` app remains a reference implementation.

The new app pins pnpm 11.25.0 and installs with a frozen lockfile. Node 24 builds both the static assets and `.vercel/output` renderer. No blanket SPA rewrite is needed: the generated renderer returns real HTTP 404 and scoped SEO HTML. The initial renderer has no visible skeleton or text-summary flash when JavaScript is enabled.

`.github/workflows/update-season.yml` publishes verified source snapshots under `web/public`, then runs `python prototypes/paper-home/scripts/sync-data.py`. That copies the current-season aggregates, schedules, player shot/assist/profile files and verified match replay/shot files into the new app. Historical sources remain intact. The workflow builds the new UI and runs its tests before committing refreshed snapshots. A successful commit triggers the new Vercel production build.

The sync script makes no network requests; it uses already-published, validated ingestion output and preserves its actual update timestamp. It is idempotent. Source failures or frontend test failures prevent the data commit. Missing files retain the last available verified copy rather than inventing data.

The temporary Ignored Build Step used during the first manual release must be removed after this migration (`commandForIgnoringBuildStep: null`). Otherwise legacy bot commits without the new app were intentionally skipped. A rollback can use the retained previous Vercel deployment, but its old Root Directory settings should not be restored without an explicit decision to revert the application.

Local build: `pnpm install --frozen-lockfile`, `pnpm run build`, `pnpm test` from this folder. Data sync requires the repository checkout and Python 3. The initial migration was checked against a clean checkout of current main: 102 frontend tests passed, and repeated sync produced identical hashes across 1,236 JSON files.
