# Dashboard.jsx — State Map & Refactor Roadmap

> Handover reference for review finding **#23**. `Dashboard.jsx` is a ~6,100-line
> "God component" with ~92 `useState`, ~42 `useMemo`, ~15 `useCallback`, ~11
> `useEffect`. It can't be split safely in one pass (and there are no component
> tests). This doc maps the state into cohesive slices and gives a **phased,
> low-risk extraction plan** so the split can happen incrementally.

## How to read this
- Line numbers are approximate (they drift as the file changes — grep the variable name).
- "Verdict": ✅ safe to lift into a hook now · ⚠️ coupled, needs care · ❌ leave in place.

## State groups

| Group | Key state (grep these) | Verdict | Notes |
|-------|------------------------|---------|-------|
| **UI toggles** | `menuCollapsed`, `forecastMode`, `cellDisplayMode`, `showTour`, `showShortcuts(Modal)`, `showRecentlyViewed`, `showFilterPresets` | ✅ | Pure toggles, no cross-deps |
| **Toasts** | `toasts` (+ `addToast`/`dismissToast`) | ✅ | Fully self-contained |
| **Recently viewed** | `recentlyViewed`, `showRecentlyViewed` | ✅ | localStorage QOL feature |
| **Filter presets** | `filterPresets`, `presetName`, save/load/delete | ✅ | Orchestrates save/load; reads filter state but doesn't own it |
| **Modal open/close** | the ~15 `show*` booleans + selected record (`activeCell`, `selectedBucketData`, `selectedResourceId`, `selectedProgram`) | ✅ | Uniform toggle pattern; no calc impact |
| **AI insights** | `aiLoading`, `aiInsightData` | ✅ | Independent lifecycle |
| **Filters & view** | `viewMode`, `timeRange`, `zoomLevel`, `squadViewFilter`, `statusViewFilter`, `resourceSearch`, `selectedCategory`, `sortBy`, `groupBy`, `demandCategory`, custom dates, `exceptionsOnly`, `showNotesOnly` (~19) | ⚠️ | Heavily read by memoised selectors (`useGrouping`, filtered data). Extract only via a FilterContext to avoid prop-drilling |
| **Scenario mgmt** | `scenarios`, `activeScenarioId`, conflict/merge/commit/discard/rename modal state (~15) | ⚠️ | Partly handled by `useScenarioSelection` + `useDashboardHandlers`; modal flags are safe, core lifecycle is coupled |
| **Slots & assignments** | `showSlots`, `pendingSlotAssignment`, `assignmentHistory`, `assignmentFuture` | ⚠️ | Toggles safe; undo/redo stacks coupled to handlers |
| **Batch selection** | `selectedProjects`, `lastSelectedId`, `showBatchModal`, `isBatchUpdating`, `companyFilter` | ⚠️ | Selection logic could be a hook; modal flags trivial |
| **Settings/finance** | `storedSettings`, `financialPeriod`, `revenueScope`, finance-forecast + BAU edit state | ⚠️ | `storedSettings` is global (keep); finance UI toggles + BAU state are extractable |
| **Optimistic updates** | `pendingUpdates`, `pendingResourceUpdates` | ❌ | Feed `rawEffectiveProjects`/`useCapacityData`; extracting risks a circular dep. Keep in Dashboard |

## Existing hooks (don't duplicate these)
- `useCapacityData` — derived data + the Web Worker bridge.
- `useDashboardHandlers` — the event-handler layer (large; the real bottleneck — see below).
- `useScenarioSelection` — derived active-scenario + merged projects/resources.
- `useGrouping` — grouped/sorted resource & project data.
- `useWhatIfMode` — what-if sandbox. **Note: currently NOT wired into Dashboard** (dead feature; decide keep-or-delete).

## Phased extraction plan (lowest risk first)

**Phase 1 — zero-refactor hooks (~80 lines out, no behaviour change):**
1. `useToastNotifications` → `toasts`, `addToast`, `dismissToast` (pass `addToast` into `useDashboardHandlers` as today).
2. `useRecentlyViewed` → `recentlyViewed` + its dropdown toggle.
3. `useFilterPresets` → presets + save/load/delete (accept filter setters as params).

**Phase 2 — UI grouping (low risk, no calc impact):**
4. `useModalState` → collapse the ~15 `show*` booleans into one `{isOpen, open, close}` API.
5. `useUIState` → `forecastMode`, `cellDisplayMode`, `zoomLevel`, `menuCollapsed`.
6. `useAIState`, `useBAUState` (finance/BAU UI slices).

**Phase 3 — structural (needs design + a test net first):**
7. Split `useDashboardHandlers` (it owns most logic) into scenario / resource / slot handler hooks. **This is the real unlock** — state extraction is limited until handlers are split.
8. Introduce a `FilterContext` so the ~19 filter vars can leave Dashboard without prop-drilling.
9. Leave `pendingUpdates`/`pendingResourceUpdates` until the data pipeline is restructured.

## Guardrails for whoever does this
- **Add tests first.** There are currently no component/hook tests; a Vitest + `@testing-library/react` harness (jsdom) should land before Phase 2/3.
- Extract **one hook per PR**, verify in the live iframe, then move on. Don't batch.
- Hooks must run unconditionally and in stable order (see the Rules-of-Hooks fixes already made in `Dashboard.jsx` / `ProgramsManagementModal.jsx`).
