# Capacity Model v2

A high-performance **Airtable Interface Extension** (React, rendered inside an
Airtable iframe) for capacity, demand and scenario planning. All heavy
calculation runs in a Web Worker; charts are rendered with Recharts.

> **New engineer? Start here, then read [`HANDOVER.md`](HANDOVER.md) (full walkthrough)
> and [`CLAUDE.md`](CLAUDE.md) (critical rules & architecture).**

## Prerequisites
- Node.js 20+
- An Airtable account with access to the base this extension is installed on
- An Airtable **personal access token** with the `block:manage` scope
  (https://airtable.com/create/tokens)

## Setup
```bash
npm install
npx @airtable/blocks-cli set-api-key   # paste your personal access token (one-time)
```

## Run locally
```bash
npm run start            # or: npx @airtable/blocks-cli run
```
Then open the extension in the Airtable base (Extensions → edit → run) and point
it at your local dev server.

## Build the Web Worker
The worker is generated — never edit `frontend/worker/workerCode_v4.js` by hand.
Edit `frontend/worker/workerCodeSource.js`, then:
```bash
npm run build:worker     # node frontend/worker/buildWorker.js
```

## Test
```bash
npm test                 # vitest run — covers the pure util modules
```
Minimal coverage today (pure modules only). See [`HANDOVER.md`](HANDOVER.md) → "Testing".

## Deploy
```bash
npm run release          # runs build:worker (prerelease hook) then releases
```
⚠️ Do **not** run `npx @airtable/blocks-cli release` directly — that skips the
worker build (see [`CLAUDE.md`](CLAUDE.md) rule #3).

Before deploying, bump `APP_VERSION` in `frontend/constants/settings.js`.

## CI/CD
Pushing to `main` **auto-deploys** to Airtable via
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) (needs the
`AIRTABLE_API_KEY` repo secret). Do day-to-day work on feature branches and open
PRs. See [`HANDOVER.md`](HANDOVER.md) → "CI/CD" for details.

## Architecture (at a glance)
```
Airtable → Dashboard.jsx → useCapacityData.js → Web Worker → processedData → Charts/Grid
```

## Key files
| Path | Purpose |
|------|---------|
| `frontend/components/Dashboard.jsx` | Main hub (large — edit surgically) |
| `frontend/hooks/useCapacityData.js` | Data bridge to the worker |
| `frontend/worker/workerCodeSource.js` | Calculation engine (source of `workerCode_v4.js`) |
| `frontend/constants/settings.js` | Field IDs + `APP_VERSION` |
| `frontend/services/ScenarioManager.js` | Scenario CRUD |

## Conventions
- **100% inline styles** — no Tailwind/className (JIT fails in the iframe).
- **No barrel imports** for `hooks/` or `services/` — import directly from the file.
- See [`docs/CODE_REVIEW.md`](docs/CODE_REVIEW.md) for the current findings backlog.
