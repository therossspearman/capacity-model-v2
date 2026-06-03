# Calculation Engines — Map & Authoritativeness

> Handover reference for review finding **#21**. The documented architecture is a
> single Web Worker (`Airtable → Dashboard → useCapacityData → Worker → Charts/Grid`),
> but in practice there are **10 distinct calculation engines**. This doc maps each
> one, which UI surface relies on it, and where logic is duplicated — so a new
> engineer knows which engine is authoritative before changing any maths.

## The engines

| # | File | Runs in | Computes | Called by |
|---|------|---------|----------|-----------|
| 1 | `worker/workerCodeSource.js` → `workerCode_v4.js` | **Web Worker** | The capacity pipeline: utilisation (annualised/presence), demand + effort profiles, weekly buckets, allocations, BAU demand, program resourcing, revenue recognition, ramp/win-rate/initiative effects | `Dashboard.jsx` via `useCapacityData` |
| 2 | `worker/BulkAllocationWorker.js` | Web Worker (inline Blob) | Greedy slot allocation vs squad/week availability (cross-squad, overstaffing) | `OptimizationModal.jsx` (`runBulkAllocationAsync`) |
| 3 | `worker/MonteCarloWorker.js` | Web Worker (inline Blob) | Robustness scoring (simulations, fit-rate percentiles, risk breakdown) | `OptimizationModal.jsx` (`runMonteCarloAsync`) |
| 4 | `utils/SlotOptimizer.js` | Main thread | Slot recommendations + dependency-aware bulk allocation plan + local search | `OptimizationModal.jsx`, `SlotHeatmap.jsx` |
| 5 | `utils/PeopleOptimizer.js` | Main thread | Resource→person assignment recommendations (role/squad/util fit) | `OptimizationModal.jsx` |
| 6 | `utils/AllocationRecommender.js` | Main thread | Bottleneck detection + allocation-% reductions | `OptimizationModal.jsx`, `AllocationsTab.jsx` |
| 7 | `utils/PortfolioReprioritizer.js` | Main thread (async) | Tiered scoring, concurrency constraints, cascade scheduling, weekly demand | `ReprioritizationTab.jsx` |
| 8 | `utils/OptimizationSolver.js` | Main thread (async) | Simulated-annealing refinement of a reprioritisation plan | `ReprioritizationTab.jsx` |
| 9 | `utils/ParetoOptimizer.js` | Main thread | Multi-objective frontier (5 presets); calls SlotOptimizer under the hood | `OptimizationModal.jsx` |
| 10 | `utils/revenueRecognition.js` | Main thread | FY window + per-project revenue recognition (extracted for scenario compare) | `ScenarioCompareModal.jsx` |

## Authoritative engine per surface

| Surface | Authoritative engine |
|---------|----------------------|
| Capacity grid / heatmap (weeks × squads × roles) | **#1 workerCodeSource** |
| Slot optimisation recommendations | #4 SlotOptimizer |
| Bulk allocation (Optimization modal) | #2 BulkAllocationWorker (async) / #4 SlotOptimizer (sync fallback) |
| Robustness / Monte Carlo | #3 MonteCarloWorker |
| People assignment suggestions | #5 PeopleOptimizer |
| Allocation-% adjustments | #6 AllocationRecommender |
| Portfolio reprioritisation | #7 PortfolioReprioritizer → #8 OptimizationSolver |
| Pareto / multi-objective | #9 ParetoOptimizer |
| Scenario-comparison revenue | #10 revenueRecognition (mirrors #1) |

## Duplication hotspots (keep in sync!)

1. **Revenue recognition** — `workerCodeSource.js` (~L1089‑1173, **canonical**) and `utils/revenueRecognition.js` (main-thread copy for scenario compare). Now centralised on the main side + unit-tested (`utils/__tests__/revenueRecognition.test.js`). Change both if the rules change.
2. **Bulk allocation** — `SlotOptimizer.generateBulkAllocationPlan` (main) vs `BulkAllocationWorker.js` (worker). Same greedy+local-search strategy, two implementations.
3. **Weekly demand / effort-profile factors** — `PortfolioReprioritizer.calculateWeeklyDemandHours` / `getPeakProfileFactor` vs `workerCodeSource.processDateRange`. Same curve maths in two places.
4. **Bottleneck / slot scoring** — `SlotOptimizer.generateRecommendations` vs `AllocationRecommender.detectBottlenecks`.

## Why this matters / next steps
- A change to "how demand or revenue is computed" must be replicated across the duplicated engines above, or surfaces will silently disagree.
- **Medium-term consolidation** (full finding #21): extract the shared primitives (effort-profile factors, weekly demand, role resolution, revenue recognition) into plain modules imported by both the worker source and the main-thread engines. Note: the worker is a **bundled Base64 string** (`buildWorker.js`), so a shared module must be inlined at build time, not imported at runtime in the worker — plan the build step accordingly. This is a multi-step refactor; the duplication map above is the starting point.
