# Capacity Model v2 — Claude Code Context

## Stack
- Airtable Interface Extension (React in iFrame)
- Styling: inline styles only for layout/colors (Tailwind JIT fails in iFrame).
  Do NOT add Tailwind utility classes for layout/spacing/color — use inline
  `style={{...}}` with the brand tokens below.
- Web Worker for all heavy calculations (Base64-encoded)
- Recharts for visualization
- Airtable Blocks SDK (@airtable/blocks)

> Known inconsistency: `frontend/style.css` still ships `@tailwind base/components/utilities`
> and is imported by `frontend/index.js`, but `tailwind.config.js`/`bundler.js` are absent,
> so Tailwind utilities are effectively inert in the iFrame. A few `className`s remain in the
> UI (`animate-shimmer`, `animate-spin`, `dropdown-enter`, `custom-scrollbar`, `spinner`) —
> these are hand-rolled CSS animation/scrollbar helpers (see `<style>` blocks / LoadingScreen.jsx),
> NOT Tailwind layout classes, so they are fine to keep. New code should still avoid Tailwind.

## Critical Rules
1. Never edit `workerCode_v4.js`. Edit `workerCodeSource.js` then run `node frontend/worker/buildWorker.js`
2. Bump `APP_VERSION` in `frontend/constants/settings.js` before every deploy
3. Deploy: **`npm run release`** from project root. Its `prerelease` hook runs
   `build:worker` first. Do NOT use `npx block release` / `npx @airtable/blocks-cli release`
   directly — calling the CLI binary skips the `prerelease` hook, so worker source
   edits won't be rebuilt and ship stale.
4. CI also auto-deploys on every push to `main` (`.github/workflows/deploy.yml`).
   Do real work on feature branches. See HANDOVER.md → "CI/CD".
5. Dashboard.jsx is 6100+ lines — edit surgically with small targeted changes
6. No barrel imports for services/hooks (causes circular dep crashes). The
   `hooks/index.js` and `services/index.js` barrels have been removed — import
   directly from the file (e.g. `../hooks/useCapacityData`).

## Brand Colors
- Primary purple: #7637E3
- Success green: #00BD00
- Accent lilac: #BD65FF
- Dark: #180126

## Architecture
Data flow: Airtable → Dashboard.jsx → useCapacityData.js → Worker → processedData → Charts/Grid

## Key Files
- `frontend/components/Dashboard.jsx` — main hub
- `frontend/hooks/useCapacityData.js` — data bridge
- `frontend/worker/workerCodeSource.js` — calculation engine
- `frontend/constants/settings.js` — field IDs + APP_VERSION
- `frontend/services/ScenarioManager.js` — scenario CRUD
