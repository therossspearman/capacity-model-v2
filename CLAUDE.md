# Capacity Model v2 — Claude Code Context

## Stack
- Airtable Interface Extension (React in iFrame)
- NO Tailwind — 100% inline styles only (JIT fails in iFrame)
- Web Worker for all heavy calculations (Base64-encoded)
- Recharts for visualization
- Airtable Blocks SDK (@airtable/blocks)

## Critical Rules
1. Never edit `workerCode_v4.js`. Edit `workerCodeSource.js` then run `node frontend/worker/buildWorker.js`
2. Bump `APP_VERSION` in `frontend/constants/settings.js` before every deploy
3. Deploy: `npx block release` from project root
4. Dashboard.jsx is 5800+ lines — edit surgically with small targeted changes
5. No barrel imports for services/hooks (causes circular dep crashes)

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
