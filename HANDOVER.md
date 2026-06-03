# Capacity Model v2 — Maintenance & Handover Guide

**Audience:** the next owner/maintainer of this Airtable Interface Extension.
**Assumes:** working knowledge of React, npm, and Airtable. No prior context with this codebase needed.

---

## Table of Contents

1. [What this is](#what-this-is)
2. [Repo location & access](#repo-location--access)
3. [Setting up Claude Code (recommended)](#setting-up-claude-code-recommended)
4. [Local development](#local-development)
5. [Deploying](#deploying)
6. [Testing](#testing)
7. [Architecture overview](#architecture-overview)
7. [Key concepts you must understand](#key-concepts-you-must-understand)
8. [Operational runbooks](#operational-runbooks)
9. [Known gotchas & non-obvious bugs](#known-gotchas--non-obvious-bugs)
10. [File map (where things live)](#file-map-where-things-live)
11. [Settings, field mapping, and configuration](#settings-field-mapping-and-configuration)
12. [Adding new features — patterns to follow](#adding-new-features--patterns-to-follow)
13. [External dependencies (Airtable side)](#external-dependencies-airtable-side)
14. [Glossary](#glossary)

---

## What this is

**Capacity Model v2** is a custom **Airtable Interface Extension** that lets the resourcing team plan capacity vs. demand across:

- **Resources** (people on squads, with working hours, leave, ramp profiles)
- **Projects** (with kick-off, launch, status, allocations per role)
- **Squads / Teams** (groupings of resources)
- **Programs / Initiatives** (long-running buckets of work + simulated headcount changes)

It renders in an iFrame inside Airtable. The user picks a date range and view (squad / role / customer / country), and the extension draws:

- A **capacity-vs-demand chart** (Recharts) with stacked bars per status
- A **grid** below with one row per resource, one column per week, showing allocation %
- Drill-downs, scenarios (draft/live), AI insights, exports (CSV + chart PNG)

It runs against a single Airtable base. All writes go through the Airtable Blocks SDK.

**Tech stack:**
- React 19 + Recharts (no Tailwind — 100% inline styles, JIT fails in iFrame)
- Web Worker for capacity/demand calculations (base64-encoded for SDK delivery)
- Airtable Blocks SDK (`@airtable/blocks`, `interface-alpha` channel)
- ES modules, no TypeScript

---

## Recent changes (maintenance pass)

A full code-review remediation + feature pass landed across versions `2.98.x → 2.99.012`
(PRs #1–#11). What a new owner should know:

**Remediation (review backlog closed):**
- All 🔴 Critical (6) and 🟠 High (31) findings fixed; Medium (116 fixes) and Low (93
  fixes) addressed via verified per-file sweeps. Full report: `docs/CODE_REVIEW.md`.
- Removed dead code (the unused What-If trio: `WhatIfPanel`, `useWhatIfMode`,
  `useFinanceForecast`; the dead reducer subsystem; `components/layout/index.jsx`).
- Removed the `hooks/` and `services/` barrels — **import hooks/services directly**.
- Tailwind `className` usage converted to inline styles across the remaining files.
- Added a minimal **Vitest** harness (`npm test`) — see the Testing section.
- Added architecture docs for the deferred refactors: `docs/CALCULATION_ENGINES.md`
  (the 10 calc engines + which is authoritative) and `docs/DASHBOARD_STATE_MAP.md`
  (a phased plan to break up the 6,100-line Dashboard).

**New features:**
- **Platform menu filter** — filter the whole view by delivery platform (e.g.
  Benifex / FPS). Resources match by their **squad's** platform; projects by their
  own Platform field. Needs a `SQUAD_PLATFORM` field on the Squads table (multi-value
  — a squad can serve several platforms), mapped via the gear icon. See "Settings,
  field mapping" and the squad→platform notes below.
- **Initiative scoping** — initiatives can now be scoped to specific **Target Teams**,
  **Platforms**, and **Project Types** (e.g. "FPS Renewals only"); the worker's
  `getInitiativeMultiplier` honours all three.

**Behaviour changes to be aware of:**
- **Target / Annual Utilisation**: a blank or `0` field now reads as **0%** (the old
  80% fallback was removed). Airtable's SDK reads a `0` percent cell as null, so blank
  and 0 are indistinguishable and both mean 0%. If capacity looks low, check that the
  utilisation field is populated.
- **Settings saves are debounced** (slider drags no longer flood Airtable / toasts).

**CI / safety:**
- `.github/workflows/deploy.yml` now **fails the build if `workerCode_v4.js` is stale**
  vs `workerCodeSource.js` (it rebuilds + diffs). Always go through `npm run release`.
- The Airtable release step can occasionally fail with `invalid json response body`
  (an Airtable-side transient) — just re-run the deploy job; it's not a code error.

---

## Repo location & access

- **Git remote (source of truth):** `https://github.com/therossspearman/capacity-model-v2.git`. Clone from there — don't rely on any local copy on a previous owner's machine.
- **Airtable base:** the Resources / Projects / Squads / Programs tables live in a single Airtable base. The base ID is **not** stored in `.block/remote.json` (that file only holds `blockId`; its `baseId` reads `NONE`) — the block-to-base binding is held server-side by Airtable. Find the base by opening the Interface that hosts this extension.
- **Block release credentials:** releasing prompts for browser auth on first run (see [Deploying](#deploying) — always go through `npm run release`, not the CLI directly). Use the Airtable account that owns the base.

---

## Setting up Claude Code (recommended)

The previous owner used **Claude Code** (Anthropic's CLI assistant) heavily for development on this codebase — almost every change in 2026 went through Claude Code. The repo includes a `CLAUDE.md` file that gives Claude project-specific context on first load, so a new session immediately knows the architecture quirks (no Tailwind, worker rebuild rules, etc).

**To install Claude Code:**

1. Install Node.js 20+ if you don't have it (`brew install node` or via nvm).
2. Install Claude Code:
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```
3. Authenticate (browser-based):
   ```bash
   claude
   ```
   Follow the prompt to log in with your Anthropic account (or Claude Pro/Max subscription).
4. From the project root, start a session:
   ```bash
   cd "path/to/capacity_model_v_2"
   claude
   ```

Claude will auto-load `CLAUDE.md` at session start, giving it the architecture rules. Common workflows:

- **"Add a new field to the Projects table mapping"** → Claude knows to update `frontend/constants/settings.js` and register it in `frontend/index.js`.
- **"Change how the worker computes capacity"** → Claude knows to edit `workerCodeSource.js` then run `npm run build:worker`.
- **"Deploy"** → Claude runs `npm run release` and pipes a comment via stdin (the CLI prompts for a release comment, which doesn't auto-fill from CLI args).

**Important Claude habits to keep:**
- Always check `CLAUDE.md` is up-to-date — it's the single source of truth for "how to not break this codebase."
- Bump `APP_VERSION` in `frontend/constants/settings.js` before deploy. Claude knows this rule.
- Don't let Claude edit `workerCode_v4.js` directly — it's the encoded build artefact. Source is `workerCodeSource.js`.

**Without Claude Code:** the codebase is still maintainable, you just have to internalise the rules in `CLAUDE.md` yourself. See [Architecture overview](#architecture-overview) below.

---

## Local development

```bash
# 1. Install
cd "path/to/capacity_model_v_2"
npm install

# 2. Run a local dev server (Airtable Blocks CLI)
npx @airtable/blocks-cli run
```

`run` starts a local server (default `https://localhost:9000`). In Airtable, edit the extension and choose "Use a development server" → paste the URL. Hot reload works for React changes.

**Worker development:**
- The web worker is base64-encoded into `frontend/worker/workerCode_v4.js` at build time.
- **Never edit `workerCode_v4.js` directly** — it's a generated artefact.
- Edit `frontend/worker/workerCodeSource.js` instead. Run:
  ```bash
  npm run build:worker
  ```
  to re-encode. The `prerelease` npm hook does this automatically before `release`.
- Worker sees its own scope: `self.onmessage`, no DOM, no Airtable SDK. Communication is via `postMessage`.

**Linting:**
```bash
npm run lint
```
Note: the lint script targets a non-existent `src/` directory (legacy from before the refactor). It's harmless but doesn't actually lint anything currently — fix the script in `package.json` if you want lint coverage (change `eslint src` to `eslint frontend`).

---

## Deploying

```bash
npm run release
```

This runs (in order):
1. `prerelease` → `build:worker` → encodes `workerCodeSource.js` into `workerCode_v4.js`
2. `release` → `npx @airtable/blocks-cli release` → bundles + uploads + releases

**The CLI will interactively prompt** for a release comment. Two ways to handle this:

```bash
# Pipe a comment via stdin to npm run release (which builds the worker first)
echo "fix: your release notes here" | npm run release
```

> ⚠️ Do **not** run `npx @airtable/blocks-cli release` directly — that bypasses the
> `prerelease` → `build:worker` step, so edits to `workerCodeSource.js` ship stale.
> Always go through `npm run release`.

After `✅ Successfully released block!`, Airtable users need to **refresh the Interface page** to pick up the new bundle. There's no auto-update.

**Pre-deploy checklist:**

- [ ] Bump `APP_VERSION` in `frontend/constants/settings.js` (semver-ish, e.g. `2.97.001`)
- [ ] Worker source unchanged → `npm run build:worker` is a no-op (cheap to always run)
- [ ] No `console.log` litter in the happy path of `useDashboardHandlers.js` (verbose logs should only fire on error)
- [ ] Test in dev mode (`npx @airtable/blocks-cli run`) before releasing
- [ ] Remember: merging/pushing to `main` auto-deploys (see "CI/CD" below) — make sure the branch is release-ready

**Rollback:** Airtable Block releases can be reverted via the Airtable web UI — go to the extension's "Releases" tab and choose a prior release. No code action needed.

### CI/CD (auto-deploy on push to `main`)

There is a GitHub Actions workflow at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
that **deploys to the live Airtable base on every push to `main`** (and via manual
`workflow_dispatch`). It runs: checkout → `npm ci` → set API key → `npm run build:worker`
→ `npx @airtable/blocks-cli release`.

**Implications — read before pushing:**
- A push to `main` is a production deploy. **Do day-to-day work on feature branches and merge via PR**, so you control when a release happens (and can bump `APP_VERSION` in the same change).
- The workflow authenticates with the **`AIRTABLE_API_KEY`** GitHub repo secret — an Airtable **personal access token** with the `block:manage` scope, for the account that owns the base. Provision it under **Settings → Secrets and variables → Actions** (`gh secret set AIRTABLE_API_KEY -R <owner>/<repo>`). If it's missing/empty the deploy step fails.
- The workflow does **not** bump `APP_VERSION` — bump it yourself before merging or the version pill users see will be stale.

---

## Testing

There is a minimal **Vitest** harness (added during the post-handover cleanup).

```bash
npm test          # vitest run (CI-friendly, one-shot)
npm run test:watch
```

- Tests live next to the code in `__tests__/` folders and run in a plain `node`
  environment (`vitest.config.js`).
- **Scope today:** the *pure* modules that have no React / Airtable-SDK imports —
  `frontend/utils/SlotOptimizer.js` and `frontend/utils/PeopleOptimizer.js`. These
  cover two real regressions that were fixed (the bulk-allocation accumulator crash
  and the PeopleOptimizer input mutation).
- **This is a starting point, not full coverage.** The highest-value next targets
  are the pure capacity/demand functions in `frontend/worker/workerCodeSource.js`
  (capacity-per-week, ramp-profile application, pro-rata group share, leave
  carve-out). They currently live inside the worker source; to unit-test them,
  extract the pure helpers into a plain module imported by both the worker build
  and the tests.
- Components/hooks aren't covered yet — they pull in React + the Airtable SDK and
  would need `jsdom` + mocks. Add `@testing-library/react` + `environment: 'jsdom'`
  when you tackle that.

---

## Architecture overview

### Data flow at a glance

```
Airtable base
    │
    ▼  (Blocks SDK reads records reactively)
Dashboard.jsx           ← top-level component, holds state, renders everything
    │
    ▼  (transforms records → resource/project lists)
useCapacityData hook    ← bridges DB ↔ Worker
    │
    ▼  (postMessage with resource/project payload + config)
Web Worker              ← does the heavy lifting (capacity & demand integration over date ranges)
    │
    ▼  (postMessage back with bucketed data)
processedData           ← per-week buckets per resource per project
    │
    ▼
CapacityChart.jsx       ← Recharts stacked bars
InnerGrid.jsx           ← virtualised grid of cells, one row per resource
```

### Why a Worker?

- Capacity + demand integration over hundreds of resources × hundreds of projects × dozens of weeks is O(N×M×W) — easily 100k+ ops.
- Doing it on the main thread blocks React re-renders → user sees jank when filtering.
- The worker takes ~1-5 seconds for typical workloads; the UI stays responsive.

### Worker payload hash

`useCapacityData.js` hashes inputs (`resList`, `projList`, `timeRange`, mode flags, etc) and only re-posts to the worker when the hash changes. Toggling unrelated UI state doesn't re-trigger compute. **If you add a new input that should affect capacity, add it to the payload hash** in `useCapacityData.js` (~line 382 historically, search for `hash`).

### Direct field writes vs. proxy fields

Airtable used to disallow direct writes to synced fields, so the codebase was built with a "proxy field" pattern: write to a local editable field, run an automation that copies the value through to the canonical synced field.

In 2026 Airtable added direct write-through on sync, so the code was refactored to support both. A toggle (Settings → "Direct Field Writes") controls the route per call, and **resource updates do dual-write** (write to both canonical + proxy) for belt-and-braces — the proxy automation handles persistence even if the direct write is silently rejected (see [Known gotchas](#known-gotchas--non-obvious-bugs)).

`resolveWriteFieldId(canonicalKey, proxyKey)` in `useDashboardHandlers.js` is the single chokepoint for picking which field ID to write to. **Use it for any new field write.**

---

## Key concepts you must understand

### Resources, capacity, and the two utilisation modes

A resource has:
- `workingHours` — contracted hours per week (e.g. 40)
- `targetUtilization` — % of working hours that are productive on present days (e.g. 80%) — "weekly productivity"
- `annualUtilization` — % of working hours that are productive across a full year, *after* leave/vacation/sick days are deducted (e.g. 67%) — "annual yield"
- `startDate` / `leaveDate` — employment bounds
- `leaveStartDate` / `leaveEndDate` — temporary leave range (e.g. parental leave)
- `rampProfile` (name) + `rampStartDate` — phased onboarding (e.g. 25% week 1, 50% week 2, 75% week 3, 100% week 4)
- `squads` — array (a person can be on multiple squads, see pro-rata note below)

The **capacity utilisation model** (toggleable in Settings → Utilization Model) controls how the per-week capacity is calculated:

| Mode | Weekly cell calculation | Annual KPI |
|---|---|---|
| `field-driven` | `workingHours × targetUtilization`, leave weeks skipped | naive `weeklyCap × 52` |
| `presence` (a.k.a. annualised / AGW) | `daysPresent × dailyHours × weeklyProductivity` (partial-week leave honoured) | `workingHours × 52 × annualUtilization` (read directly from field) |

Switching modes is global (whole base, not per-resource). Toggling triggers a worker re-compute via the payload hash.

### Pro-rata for dual-squad resources

If someone is on Squad A and Squad B, they appear once in each squad's grid view (operational reality), but their capacity and demand are split **50/50** across the squads in the squad-header totals. This prevents `sum of squad headers ≠ team capacity` (which would happen if dual-squad people counted twice).

The mechanism: `useGrouping.js` computes `_groupShare = 1 / groupCount` for each resource per group. The squad-level weekly util row in `InnerGrid.jsx` multiplies by `_groupShare` before summing. Individual resource rows ignore `_groupShare` and show the full bucket values (each row is the whole person, regardless of how many squads).

### Scenarios (draft vs live)

- **Live mode:** edits write directly to Airtable.
- **Draft mode (active scenario):** edits go into `activeScenario.changes` (kept in `storedSettings.scenarios[]`). The grid renders an "overlay" of base records + scenario changes. Committing the scenario applies all changes to Airtable in one batch and clears the draft.

`handleUpdateProject` and `handleUpdateResource` in `useDashboardHandlers.js` branch on `activeScenario && !activeScenario.isLive`.

### Ramp profiles

Stored in `storedSettings.rampProfiles[]` as `{name: string, weeks: number[]}` — `weeks[i]` is the percentage of full capacity for week `i` of the ramp. The worker looks up the profile by name and multiplies bucket capacity by `profile.weeks[weekIdx] / 100`.

Used by:
- Real resources (mapped via gear icon to Airtable's Ramp Profile field, picked per-person in ResourceProfileModal)
- Virtual headcount in Initiatives (picked per-row in InitiativesModal)

### Virtual headcount in Initiatives

Initiatives can include a `headcountPlan[]` of synthetic future hires. When the "Effect" toggle is on, `useCapacityData.js` injects synthetic resources into the worker payload (`isVirtual: true`). They show up as virtual rows in the grid and contribute to capacity totals. Useful for "what if we hire 3 PDs in Q3" scenarios.

Initiatives also model **efficiency gains**: an `efficiencyPct` (with optional `rampWeeks`) applied from `launchDate`. The worker's `getInitiativeMultiplier` (`workerCodeSource.js`) boosts capacity, scoped by:
- `targetTeams` (PM / SC / PD, or `['all']`),
- `targetPlatforms` and `targetProjectTypes` (or `['all']`) — so an initiative can apply to e.g. "FPS Renewals only".

`'all'` is the catch-all in each list. Editing any of these is a settings change (debounced persist).

### Settings storage

`storedSettings` is a JSON blob in a single Airtable record. The Settings table has one row, one cell, holding the entire JSON. `storedSettings` is read on mount and saved via `settingsTable.updateRecordsAsync` whenever the user changes a setting. Defaults live in `frontend/constants/defaults.js`.

---

## Operational runbooks

### "I edited a resource and it didn't save"

1. Open browser DevTools console.
2. Look for `[handleUpdateResource]` or `Update Failed` toast.
3. Check the Network tab for `updateCells` POSTs — note status codes.
4. If you see 422s and no clear error: the most common cause is the **value doesn't match the field's options** (e.g. typed "Profile X" but the select option is "Profile-X" with a hyphen). The Airtable SDK silently swallows the 422 — it doesn't surface to the toast. Fix the value to match exactly.
5. If 422s on every field: the table-level sync write-through may be disabled. Open the sync source in Airtable and enable "Allow updates to synced fields."
6. The dual-write strategy means even if direct silently fails, the proxy automation should still persist the value within ~2 seconds. If neither route lands, check the Airtable automation's run history.

### "Worker is slow"

`Slow worker cycle: Xms (Y records, Z resources, W buckets)` shows in the console. Targets:
- < 2000ms = healthy
- 2000–6000ms = sluggish but functional
- > 6000ms = something's pathological

Diagnostic steps:
1. Check that the date range isn't gigantic (> 2 years). Reducing it should cut compute roughly proportionally.
2. Check the project list — closed/cancelled projects are filtered out by `useGrouping.js`, but they still ship to the worker. If there are thousands of historic projects, consider adding a filter at fetch time.
3. The capacity loop iterates resources × weeks. 380 resources × 53 weeks ≈ 20k iterations — should finish in well under a second on modern hardware. If it's slower, profile via `console.time` blocks in `workerCodeSource.js`.

### "Chart export PNG is missing dates / wrong width"

The chart's XAxis has `tick={false}` for grid density. Dates are rendered separately in the grid's `DateHeaderRow`. The PNG export composites them by calling `exportChartAsPng({ dates: processedData, columnWidth: currentZoom.width, addToast })` — the dates array is the source of truth, **not** the DOM (which virtualises). If dates are missing, check that the call site passes `dates` and `columnWidth` props.

### "Airtable changed a field ID"

If a sync regenerates field IDs (rare but happens after major source schema changes):
1. Open the extension settings (gear icon).
2. Re-map the affected fields in the Resources/Projects field list.
3. The mapping lives in `storedSettings.fieldMapping`. `resolveFieldId()` in `frontend/utils/cell-value.js` translates the user-friendly key (`SETTINGS.RAMP_UP_PROFILE`) to the actual Airtable field ID at runtime.

### "Direct writes broke after an Airtable update"

Flip the **Settings → Direct Field Writes** toggle OFF. This forces all writes to use the proxy field path, which has worked for years. No deploy needed — toggle takes effect immediately. Then debug the direct-write path at your leisure.

---

## Known gotchas & non-obvious bugs

### 1. Airtable SDK silently swallows HTTP 422

When `table.updateRecordsAsync` hits a server-side 422 (invalid value, non-writeable field, etc.), the SDK **resolves the promise as if it succeeded**. The browser logs the 422 in the Network tab but no exception reaches your `try/catch`. **Don't trust the absence of an error as proof the write landed.**

The defensive measures in this codebase:
- **Dual-write** for resource updates (writes to both canonical + proxy)
- **Permission check** via `table.checkPermissionsForUpdateRecord` in error paths (logs field type + reason)
- The user-facing fix is usually "your value doesn't match an option in the field's option list" — surface that in toasts when possible.

### 2. Worker re-compute is debounced via payload hash

If you change something that *should* affect capacity but the chart doesn't update, the input you changed isn't in the hash. Search for the hash construction in `useCapacityData.js` (~line 380) and add your input.

### 3. `Dashboard.jsx` is 6000+ lines

Edit surgically with small targeted patches. Don't restructure it without a plan — the call sites are dense and intertwined with handler closures from `useDashboardHandlers.js`. Lots of state is passed into handlers via the `deps` object.

### 4. No barrel imports for `services/` or `hooks/`

The `hooks/index.js` and `services/index.js` barrels have been **removed** (they caused circular-dependency crashes when a file re-exported from a barrel imported that barrel). **Always import the specific file** (`from '../hooks/useGrouping'`, `from '../services/ScenarioManager'`). Don't re-introduce the barrels.

### 5. Inline styles only

The Airtable iFrame strips/breaks Tailwind's JIT. **Don't add Tailwind, even on new components.** Use inline `style={{ ... }}` objects + the design tokens in `frontend/design-system/`.

### 6. Worker base64 encoding

`buildWorker.js` reads `workerCodeSource.js`, base64-encodes it, and emits a JS file that creates a Blob URL the worker constructor can use. This song-and-dance is because Airtable Blocks can't ship arbitrary JS files alongside the bundle — they all have to be inlined. **If you see "worker is undefined" or weird syntax errors at startup, run `npm run build:worker` and re-deploy.**

### 7. `APP_VERSION` is shown to users

It's the version pill in the bottom-right of the UI. Bump it before every deploy so users can confirm they have the latest after a refresh.

---

## File map (where things live)

```
capacity_model_v_2/
├── CLAUDE.md                    Quick context for Claude Code (read this!)
├── HANDOVER.md                  ← you are here
├── README.md                    Mostly empty placeholder
├── package.json                 Scripts: lint, build:worker, prerelease, release
├── block.json                   Airtable Blocks entry point
├── deploy_v2.sh                 Old deploy shell — superseded by `npm run release`
├── docs/
│   ├── TRAINING_GUIDE.md        End-user docs (resourcing managers)
│   └── optimizer-decision-guide.md
└── frontend/
    ├── index.js                 SDK entry — registers extension, useCustomProperties for field mapping
    ├── style.css                Minimal global CSS (most styling is inline)
    ├── components/
    │   ├── Dashboard.jsx        ⭐ Main hub. Toolbar, filters, modals, top-level state.
    │   ├── LoadingScreen.jsx
    │   ├── charts/
    │   │   └── CapacityChart.jsx    Recharts ComposedChart (bars + areas + lines)
    │   ├── grid/
    │   │   ├── InnerGrid.jsx        Virtualised grid, DateHeaderRow, squad util row
    │   │   └── ResourceRow.jsx      One row per resource, cell-by-cell rendering
    │   ├── modals/
    │   │   ├── SettingsModal.jsx
    │   │   ├── DetailModal.jsx
    │   │   ├── ResourceProfileModal.jsx
    │   │   ├── InitiativesModal.jsx
    │   │   └── ... (15+ modals)
    │   ├── ui/                  Hover cards, toasts, buttons
    │   ├── toolbar/             Top-of-page filter bar bits
    │   ├── settings/            Field-mapping UI (gear icon)
    │   ├── scenario/            Scenario picker + management
    │   └── optimization/        AI optimizer modals
    ├── hooks/                       (no index.js barrel — import hooks directly)
    │   ├── useDashboardHandlers.js  ⭐ All write handlers (resource update, project update, scenarios)
    │   ├── useCapacityData.js       ⭐ Worker bridge (in & out) + resource/project filtering
    │   ├── useGrouping.js           Resource/project grouping for grid
    │   ├── useScenarioSelection.js
    │   └── ... (small hooks)
    ├── worker/
    │   ├── workerCodeSource.js      ⭐ EDIT THIS for capacity calc changes
    │   ├── workerCode_v4.js         Generated; do NOT edit
    │   ├── buildWorker.js           Encoder
    │   ├── BulkAllocationWorker.js  Optimizer worker (separate)
    │   └── MonteCarloWorker.js      Forecast Monte Carlo (separate)
    ├── utils/
    │   ├── index.js                 Re-exports utility functions
    │   ├── cell-value.js            getCellValue, resolveFieldId — Airtable record helpers
    │   ├── cell-metrics.js          Per-cell display logic (cap/dem/util %)
    │   ├── csv-export.js
    │   ├── chart-export.js          PNG export
    │   ├── SlotOptimizer.js
    │   ├── SlotIntelligence.js      AI snapshot read/write
    │   ├── AuditLog.js              Append-only audit trail (in storedSettings)
    │   └── helpers.js
    ├── constants/
    │   ├── settings.js              ⭐ APP_VERSION + SETTINGS field-key constants
    │   ├── defaults.js              ⭐ DEFAULT_SETTINGS — every initial setting value
    │   ├── icons.jsx                Inline SVG icons
    │   └── status-colors.js
    ├── services/                    (no index.js barrel — import services directly)
    │   ├── ScenarioManager.js       Scenario CRUD logic
    │   └── ... (small services)
    └── design-system/
        ├── tokens.js                BRAND colours, TOKENS (spacing, radii)
        ├── component-styles.js      Shared inline-style objects
        └── theme.js                 Dark mode bridge (useTheme)
```
(The former `state/` reducer dir and the `hooks/`+`services/` barrels were removed.)

⭐ = critical files. If you're new, read `Dashboard.jsx`, `useCapacityData.js`, `workerCodeSource.js`, `useDashboardHandlers.js`, and `constants/defaults.js` in that order.

---

## Settings, field mapping, and configuration

### Field mapping (gear icon)

Airtable Block extensions can dynamically prompt the user to map "logical fields" (defined in code) to actual Airtable columns. This is done via `useCustomProperties` in `frontend/index.js`. Every settable field is registered there with a unique `key` from `SETTINGS` in `frontend/constants/settings.js`.

**To add a new mappable field:**
1. Add a constant to `SETTINGS` in `frontend/constants/settings.js` (e.g. `MY_NEW_FIELD: 'fld_my_new_field'`).
2. Register it in `frontend/index.js` under the appropriate table block (Resources, Projects, etc).
3. In Dashboard.jsx's `allResources` or `allProjects` loader, read the value via `getSafeCellValue(record, resolveFieldId(stableSettings[SETTINGS.MY_NEW_FIELD]))`.
4. Tell users to map the field via the gear icon after deploy.

**Squad-level fields (drive resource filtering):** the Squads table has two
single/multi-select fields read into per-resource attributes via `squadCategoryMap` /
`squadPlatformMap` in Dashboard.jsx:
- `SQUAD_CATEGORY` ("Squad Category": Implementation / BAU / Both) → drives the BAU demand filter.
- `SQUAD_PLATFORM` ("Squad Platform": e.g. Benifex / FPS) → drives the **Platform filter**.
  Make it **multi-value** (or comma/slash text) so a squad serving two platforms lists
  both; a resource then matches a platform if *any* of its squads serve it. Both must be
  mapped via the gear icon and set on each squad to have any effect.

### Settings modal tabs

`SettingsModal.jsx` has tabs for:
- **General** — direct field writes toggle, theme, misc
- **Utilization Model** — field-driven vs. presence/annualised mode + default weekly productivity slider
- **Alt Model** — alternative project effort model
- **Ramp Profiles** — define named ramp profiles with weekly % arrays
- **Thresholds** — utilisation colour bands (green/yellow/red)
- **(more)** — see the file for full list

Each tab modifies a slice of `storedSettings`. Saving any tab persists the whole blob.

### Per-environment config

There isn't a separate dev/staging/prod environment — the Block is always deployed to the same Airtable base. If you need staging:
1. Duplicate the base.
2. `npx @airtable/blocks-cli init` in a separate directory pointed at the duplicate.
3. Symlink or copy the source over and deploy independently.

---

## Adding new features — patterns to follow

### Adding a new editable field on Resources

1. Define `SETTINGS.MY_FIELD` + `SETTINGS.MY_FIELD_UPDATE` (proxy) in `constants/settings.js`.
2. Register both in `frontend/index.js` (Resources block).
3. In `Dashboard.jsx`'s `allResources` loader, read it: `myField: getSafeCellValue(record, resolveFieldId(stableSettings[SETTINGS.MY_FIELD]))`.
4. Add a UI control in `ResourceProfileModal.jsx` that calls `onUpdate({ myField: value })`.
5. In `useDashboardHandlers.js` `handleUpdateResource` LIVE MODE, add a branch:
   ```js
   } else if (field === 'myField') {
       addPair(SETTINGS.MY_FIELD, SETTINGS.MY_FIELD_UPDATE, value, { numeric: true });  // or datelike, or default
   }
   ```
6. If the field affects capacity, pass it through `useCapacityData.js` to the worker payload + add it to the payload hash.

### Adding a new modal

1. Create `frontend/components/modals/MyModal.jsx`.
2. Export it from `frontend/components/modals/index.js`.
3. In `Dashboard.jsx`, add a `useState` flag + import + render block:
   ```jsx
   {showMyModal && <MyModal onClose={() => setShowMyModal(false)} ... />}
   ```
4. Add a toolbar button to open it.

### Adding a new worker computation

1. Edit `workerCodeSource.js` — add to the `case 'computeCapacity':` (or define a new case).
2. Pass any new inputs via the `payload` from `useCapacityData.js`.
3. Add new inputs to the payload hash.
4. Run `npm run build:worker` to re-encode.
5. Test in dev. Deploy.

### Adding a new chart variant

`CapacityChart.jsx` is the single source of truth. Recharts supports stacked bars, areas, lines, reference lines. Add a new toggle in the toolbar and conditionally render new chart elements within the `<ComposedChart>`.

---

## External dependencies (Airtable side)

### Tables expected in the base

- **Resources** — one row per person
- **Projects** — one row per project
- **Squads** — one row per squad
- **Programs** — one row per program (long-running container of projects)
- **Settings** — single-row JSON store for `storedSettings`
- **Slot Snapshots** (optional) — for AI optimizer, stores prior snapshots
- **(more, see `index.js` for full list)**

### Automations (Airtable-side)

The proxy-field pattern relies on automations that copy values from `*_UPDATE` fields back to canonical fields. If proxy writes succeed but canonical fields stay stale, **check those automations are enabled and not erroring** in Airtable's automation run history. With the direct-writes path active, these are belt-and-braces — but they're still the safety net.

### Sync configuration

Some fields on the Resources/Projects tables come from external syncs (HRIS, project tracker, etc). Synced fields are read-only by default. To allow direct writes:
- Open the sync source in Airtable
- Sync settings → "Allow updates to synced fields" → enable the specific fields you need writeable

The dual-write strategy means even if a sync rejects writes, the proxy automation persists changes — but ideally enable write-through so direct writes work cleanly.

---

## Glossary

| Term | Meaning |
|---|---|
| **Capacity** | Hours a person/team can deliver in a period (after utilisation) |
| **Demand** | Hours required by projects in a period |
| **Bucket** | A single week's worth of cap/dem for a single resource × project |
| **Working Hours** | Contracted hours per week (e.g. 40) |
| **Target Utilisation** | Productive % of working hours on present days (weekly view) |
| **Annual Utilisation** | Productive % of working hours across full year, after leave (annual view) |
| **Squad** | A team of resources (e.g. G1, G3, G5) |
| **Wave** | A grouping of projects under a customer |
| **Ramp Profile** | Phased onboarding curve (e.g. 25/50/75/100 over 4 weeks) |
| **Virtual Headcount** | Synthetic resources from initiatives, not real Airtable records |
| **Initiative** | An efficiency/hiring scenario applied as an overlay |
| **Scenario** | A draft set of changes that can be saved/committed/discarded |
| **Live mode** | Edits write directly to Airtable |
| **Draft mode** | Edits are queued in an active scenario |
| **Direct write** | SDK writes directly to a synced field (Airtable 2026 feature) |
| **Proxy field** | Editable local field; an automation copies value to canonical sync field |
| **Dual write** | Strategy of writing to both canonical + proxy as belt-and-braces |
| **Slot** | A resource × project assignment for the AI optimizer |
| **EAC** | Estimate at completion (forecast mode) |
| **Field-driven** | Capacity model that reads `effectiveHours` per resource (legacy) |
| **Presence / annualised** | Capacity model that uses days-present and annual-yield separately |

---

## Appendix: Quick reference of recent significant changes (2026)

| Change | Files | Notes |
|---|---|---|
| Direct field writes toggle | `defaults.js`, `useDashboardHandlers.js`, SettingsModal | Lets writes route to canonical synced fields directly |
| Dual-write resource updates | `useDashboardHandlers.js` | Writes both direct + proxy because SDK swallows 422 silently |
| Presence / annualised mode | `defaults.js`, `useCapacityData.js`, `workerCodeSource.js`, ResourceHoverCard, DetailModal | Two-lens capacity (weekly vs annual) |
| Pro-rata for dual-squad resources | `useGrouping.js`, `InnerGrid.jsx` | Prevents double-counting in squad totals |
| Leave range carve-out in annualised mode | `workerCodeSource.js` | Honours leaveStart/leaveEnd in flat-per-week mode |
| Chart PNG export | `chart-export.js`, `Dashboard.jsx`, `InnerGrid.jsx` | Composites date strip below chart for board reports |
| Ramp profile on virtual headcount | `InitiativesModal.jsx`, `useCapacityData.js`, `Dashboard.jsx` | Replaces hardcoded ramp with named profile dropdown |

---

**Last updated:** 2026-04-28 (Apr 2026)
**Current `APP_VERSION`:** see `frontend/constants/settings.js`
**Maintainer prior to handover:** Addy
