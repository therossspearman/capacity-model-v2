# Capacity Model v2 — Complete Training & Handover Guide

> **App version:** 2.99.019 · **Last updated:** June 2026
> **Audience:** Resource managers / planners (daily users) **and** the admin/engineer who installs and maintains the tool.
> This is the standalone "if no one is here to explain it" guide. For engineering/deploy detail see **`HANDOVER.md`**; for the calculation maths see **`docs/CALCULATION_ENGINES.md`**.

---

## Table of Contents

1. [What the tool is](#1-what-the-tool-is)
2. [Core concepts (read this first)](#2-core-concepts)
3. [5-minute quick start](#3-5-minute-quick-start)
4. [The three views: People / Projects / Slots](#4-the-three-views)
5. [Toolbar reference (every control)](#5-toolbar-reference)
6. [Reading the grid](#6-reading-the-grid)
7. [Forecast modes: Plan / EAC / Impact](#7-forecast-modes)
8. [Capacity model & utilisation model](#8-capacity--utilisation-models)
9. [Demand category & BAU planning](#9-demand-category--bau)
10. [Filtering, search, grouping, presets](#10-filtering-search-grouping-presets)
11. [The detail panel & inline editing](#11-detail-panel--editing)
12. [Scenarios (what-if planning)](#12-scenarios)
13. [Slots, Gantt & drag-drop assignment](#13-slots-gantt--assignment)
14. [Reorg / Portfolio Optimizer](#14-reorg--optimizer)
15. [Initiatives (efficiency)](#15-initiatives)
16. [Programs](#16-programs)
17. [Finance Forecast](#17-finance-forecast)
18. [Leave, availability & ramp-up](#18-leave-availability--ramp-up)
19. [Exports & snapshots](#19-exports--snapshots)
20. [Common workflows](#20-common-workflows)
21. [Keyboard shortcuts](#21-keyboard-shortcuts)
22. [Troubleshooting](#22-troubleshooting)
23. [ADMIN: install, tables, field mappings & settings](#23-admin-setup)
24. [For engineers (where the code lives)](#24-for-engineers)
25. [Glossary](#25-glossary)

---

## 1. What the tool is

The Capacity Model is an **Airtable Interface Extension** (a React app that runs inside an Airtable Interface). It answers one question, continuously and visually:

> **"Do we have enough people to deliver the work we've committed to — and where are the gaps?"**

It pulls live data from your Airtable base (Resources, Projects, Squads, …), runs the maths in a background engine, and shows **demand vs. capacity** over time. You can then **filter**, **plan changes safely in scenarios**, **assign work to delivery slots**, and **optimise** the portfolio.

Everything you see is read from Airtable; the edits you make (where allowed) write back to Airtable.

---

## 2. Core concepts

Learn these six words and the rest of the tool makes sense.

| Term | Plain-English meaning |
|------|----------------------|
| **Capacity** | How many hours a person/squad can actually deliver in a week (after utilisation, leave, ramp-up). |
| **Demand** | How many hours the projects need in a week (PM + SC + Build effort spread over the project's dates). |
| **Utilisation** | Demand ÷ Capacity. 100% = fully booked. >100% = overloaded (red). |
| **Squad / Pod** | A delivery team. People belong to squads; projects are delivered by squads. |
| **Resource** | A person. Has working hours, a target utilisation, a squad, start/leave dates. |
| **Scenario** | A safe sandbox. Make "what-if" changes without touching live data, then **commit** or **discard**. |

Two more that matter for planning:

- **Slot** — a standard, reusable unit of delivery capacity (default **12 weeks**, with a fixed PM/SC/Build hour budget). Think of slots as **parking spaces**: each squad has a limited number per period; your job is to park projects efficiently. Used in **Slots view**.
- **Initiative** — a planned efficiency improvement (tooling, automation, training…) that boosts capacity from a launch date.

---

## 3. 5-minute quick start

1. **Open the interface.** It loads live data and shows the grid (a "Calculating capacity model…" screen appears the first time).
2. **Pick a view** (top-left): **People**, **Projects**, or **Slots**. Start in **People**.
3. **Find the fires.** Switch the cell display to **%** and scan for **red** cells — those weeks are overloaded.
4. **Narrow down.** Use the **Squads**, **Statuses**, **Platforms** or **Entities** filters to focus.
5. **Inspect.** Click any **cell** to see which projects make up that week's demand, or click a **row name** to open the person/project detail.
6. **Plan safely.** Before changing anything important, create a **Scenario** (the "Live" selector near the top) so you can experiment and compare.
7. **Get help in-app.** The **?** (Help) button opens the documentation; the **▶ Tour** button gives a guided walkthrough; press **?** on the keyboard for shortcuts.

---

## 4. The three views

Switch with the **People / Projects / Slots** toggle (top-left of the toolbar).

### People view
Rows are **resources** (people), grouped by squad (or role). Each cell shows that person's **demand vs. capacity** for the week. This is the view for "**who is overloaded / who is free**".

- Diagonal **stripes** on a cell = the person is **unavailable** that week (before start date, after termination, or on leave).
- An **overload badge** (flame + count) appears in the toolbar when anyone is >100%.

### Projects view
Rows are **projects**, grouped by **Customer** (or Squad / Country). Each cell shows the project's **effort** that week. This is the view for "**what work is landing when**" and for **bulk editing** projects.

- A coloured left edge shows project **status**; a green tick = the project has a team; a notes icon = it has resourcing notes.
- **Select All** + per-row checkboxes enable **Batch Update**.
- At the bottom (in BAU mode) a collapsible **Virtual BAU Projects** grid appears.

### Slots view
Shows **available delivery slots** per squad over time, as a **Heatmap** or a **Gantt**. This is the view for **assigning unresourced projects to capacity** by drag-and-drop, and for running slot **optimisation**. See [§13](#13-slots-gantt--assignment).

---

## 5. Toolbar reference

The toolbar can be **collapsed/expanded** with the chevron at its bottom edge (or **⌘M**). Controls, left to right / top to bottom:

### Timeline & forecast
| Control | What it does |
|---|---|
| **◀ / ▶ arrows** | Scroll the timeline left/right. |
| **Today** | Jump to today's column (keyboard **T**). |
| **Date range** | Set a custom From/To window (or Clear to reset). |
| **Plan / EAC / Impact** | Forecast mode — see [§7](#7-forecast-modes). |
| **Std / Alt** | Capacity model — separate PM/SC/PD effort vs. a single Total Effort split by role mix. See [§8](#8-capacity--utilisation-models). |
| **Annualised / AGW** | Utilisation model — flat annual % vs. day-by-day "any given week". See [§8](#8-capacity--utilisation-models). |
| **All / Implementation / BAU** | Demand category — see [§9](#9-demand-category--bau). |

### Scenario & filters
| Control | What it does |
|---|---|
| **Live / scenario selector** | Shows the active scenario (or **Live**). Create, clone, rename, delete, revert, compare, manage. See [§12](#12-scenarios). |
| **Squads ▾** | Multi-select squad filter (search box; "Merge View" when 2+ selected; "None (Unassigned)"). |
| **Platforms ▾** | Multi-select platform filter (e.g. Benifex / FPS). Filters people by their squad's platform and projects by their platform. |
| **Statuses ▾** | Multi-select project status filter. |
| **Entities ▾** | Multi-select Selling-Entity filter. |
| **Company ▾** | (Only if 2+ companies exist) single-select company-of-origin filter. |
| **Presets** | Save / load named filter sets (stored locally per browser). |
| **Search** | Filter rows live; highlights matches (focus with **⌘F** or **/**). |

### Layout
| Control | What it does |
|---|---|
| **Squad / Role / Customer / Country** | Group-by. (Role is People-only; Customer/Country are Projects-only.) |
| **+ / −** | Expand all / collapse all groups. |
| **Sort ▾** | Name, Available (high→low / low→high), Overload, Customer A–Z, Country A–Z. |
| **⚠ Exceptions only** | Show only under-utilised (<50%) or over-utilised (>100%) rows (keyboard **E**). |
| **Notes filter** | (Projects) show only projects with resourcing notes. |
| **12h / % / heatmap** | Cell display mode: hours, utilisation %, or colour intensity. |
| **Density icons** | Compact / Comfortable / Spacious row+column sizing. |

### Actions (right side)
| Control | What it does |
|---|---|
| **⬇ Export** | Export capacity data to CSV. |
| **🖼 PNG** | Download the capacity chart as a board-ready image (2× resolution). |
| **💡 Initiatives** | Configure efficiency initiatives; the **+X%** checkbox toggles their effect on the graph. See [§15](#15-initiatives). |
| **$ Finance Forecast** | Model ARR → capacity demand; **FTE Impact** panel appears when active. See [§17](#17-finance-forecast). |
| **📦 Programs** | Open Programs management. See [§16](#16-programs). |
| **Reorg** | Portfolio reprioritisation / optimiser. See [§14](#14-reorg--optimizer). |
| **🕐 Recently viewed** | Quick links to the last 10 items you opened. |
| **? Help** | Documentation modal. |
| **▶ Tour** | Interactive guided tour. |
| **⚙ Settings** | All configuration (keyboard **⌘.**). See [§23](#23-admin-setup). |

---

## 6. Reading the grid

**Cells.** Each cell is one resource/project × one week (or month, depending on zoom). The number shown depends on the display toggle:
- **12h** → hours of demand that week.
- **%** → utilisation (demand ÷ capacity).
- **heatmap** → a coloured bar whose height/colour encodes utilisation.

**Colour ladder (utilisation):**

| Colour | Utilisation | Meaning |
|---|---|---|
| Light → deep **green** | up to 100% | Healthy. Deeper green = busier. |
| **Amber** | 100–110% | Slight overload. |
| **Orange** | 110–120% | Significant overload. |
| **Red** | >120% | Severe overload — act now. |
| Grey "0" | capacity but no demand | Free. |
| Diagonal **stripes** | n/a | Unavailable (not started / terminated / on leave). |

> The exact green/amber/red thresholds are configurable in **Settings → General → Capacity Thresholds**.

**Clicking:**
- **A cell** → opens the **detail panel** for that week, listing the projects (and people) that make up the demand.
- **A row name** → opens the **person** or **project** detail (full info, team, notes, inline edits).
- **Star/pin** → pins a row to the top.

---

## 7. Forecast modes

The **Plan / EAC / Impact** toggle changes which demand numbers the grid shows:

| Mode | Shows | Use it for |
|---|---|---|
| **Plan** | The baseline plan (planned effort over planned dates). | Normal day-to-day planning. |
| **EAC** | *Estimate at Completion* — re-forecast using actuals + % complete (remaining work re-spread over remaining time). | "Given progress so far, what's left and when?" |
| **Impact** | The **difference** between EAC and Plan (+ = more than planned, − = less). | Spotting projects drifting over/under plan. |

(Keyboard **P** cycles the modes.)

---

## 8. Capacity & utilisation models

Two independent toggles. They change **how capacity and demand are computed** — important to understand, easy to get confused by.

### Std vs. Alt (where project **effort** comes from)
- **Std (Standard):** reads three separate fields per project — **PM Effort, SC Effort, PD/Build Effort**.
- **Alt (Alternative):** reads a single **Total Effort** field and splits it into PM/SC/Build using a **role-mix %** (set in Settings, optionally overridden per project-type/platform). Use this when projects only carry one total number. (The toggle warns you if the Total Effort field isn't mapped.)

### Annualised vs. AGW (how a person's weekly **capacity** is computed)
| Model | Formula (per week) | Behaviour | Best for |
|---|---|---|---|
| **Annualised** | `working hours × Annual Utilisation %` | Flat each week. Vacation/holidays/sick are *already baked into* the annual % (e.g. 67%), so leave weeks are **not** separately removed. | Executive reporting, hiring plans, annual deal capacity. |
| **AGW** (Any Given Week) | `days present × (working hours ÷ 5) × productivity %` | Varies week to week; **removes leave day-by-day**. Productivity % comes from each person's Target Utilisation (default 80%). | Live staffing, sprint/weekly planning, "who's actually here". |

> Rule of thumb: **Annualised** for the boardroom, **AGW** for this week's staffing. If the Annual Utilisation field isn't mapped, Annualised falls back to Target Utilisation (80%).

---

## 9. Demand category & BAU

> **Deep dive:** for the full BAU playbook (sizing conventions, pod ownership, renewals vs. ad-hoc change, qualification rules, workflows) see **`docs/BAU_RESOURCE_MANAGER_GUIDE.md`**.

The **All / Implementation / BAU** toggle splits the world into delivery work vs. ongoing support.

- **Implementation** — new project delivery (the default kind of demand).
- **BAU** (Business As Usual) — ongoing support load generated from **launched** sites, plus Renewals / Change Requests.
- **All** — both together.

### How BAU demand is generated
Each implementation project carries a **BAU T-Shirt size** (XXS … XXL). After launch, the model creates a **virtual BAU project** that generates a steady weekly support load derived from that size. The hours-per-size mapping lives in **Settings** (defaults: XXS 25 / XS 50 / S 100 / M 200 / L 400 / XL 800 / XXL 1600 hours per year — your base may be customised).

### Editing BAU on the fly
Open a virtual BAU project (Projects view, BAU mode → the Virtual BAU grid, or click the row) to get the **BAU Project Details** modal:
- **T-Shirt size** — click a chip to change it; the annual hours update live and the change saves to the source project.
- **BAU POD** — a dropdown to assign which pod owns that project's ongoing support (this is a linked record on the project). The BAU grid groups by pod.
- Name / country / launch are read-only (they come from the source project).

---

## 10. Filtering, search, grouping, presets

- **Filters stack.** Squads, Platforms, Statuses, Entities and Company all apply together (AND). Each chip turns coloured when active; use **Clear** inside a dropdown to reset just that filter.
- **Merge View** (Squads dropdown, 2+ squads) collapses several squads into one combined set of rows — useful for "team of teams" capacity.
- **Search** filters rows live and highlights matching projects. **Esc** clears it.
- **Group by** Squad / Role / Customer / Country; **+ / −** expand/collapse all groups.
- **Sort** by name, availability, or overload.
- **Exceptions only** (⚠ / **E**) hides everything that's comfortably loaded so you see only the problems.
- **Presets** save the *entire* filter+view state under a name (view mode, group-by, sort, all filters). Stored in the browser, so they're per-person, per-device.

---

## 11. Detail panel & editing

Clicking a **cell** or **row name** opens a detail panel.

- **Demand cell detail** lists every project contributing to that week, with hours and, where relevant, the team.
- **Project detail** shows kick-off/launch, scope (platform, type, transactional benefits), **budget performance** (Planned / Actuals / EAC / Variance), and the **team** (PM / SC / PD with "+ Add"). You can **Edit** or **Clone** the project, and assign/adjust team members and their allocation %.
- **Resource (person) detail** shows working hours, target utilisation, start date, **Termination Date**, **leave period(s)**, ramp-up profile, and current allocations.

Edits made here write to Airtable (directly or, in a scenario, to the draft). Single-select and linked fields are written in the correct Airtable format automatically.

---

## 12. Scenarios

Scenarios are the safe way to plan. The selector near the top shows **Live** (real data) or the active scenario name.

**Lifecycle:**
1. **Create** a scenario (give it a meaningful name — "Q2 Rebalance — delay Customer X", not "Test 1").
2. You're now in **draft mode** — a banner appears. Make changes (move dates, reassign squads, drag projects to slots…). Nothing touches live data yet.
3. **View Changes** to see a diff vs. live; add **Notes**.
4. **Commit** to write the changes to Airtable, or **Discard** to throw them away.
5. **Compare** two scenarios side by side before deciding.

**Good habits:** one scenario per planning question; compare before committing; name things so a colleague understands them.

**Conflict handling:** if live data changed underneath your draft, a merge-conflict modal helps you resolve it on commit.

---

## 13. Slots, Gantt & assignment

In **Slots view** you place unresourced projects into standard capacity slots.

- **Heatmap** sub-view: a grid of how many slots each squad has free per period (green = plenty, amber = one, red = none).
- **Gantt** sub-view: a timeline with **open slots** and **assigned projects**; red markers flag staffing gaps.
- **Unresourced sidebar:** projects needing staffing — **Partial** (some roles) or **Unstaffed** (none).

**Drag-and-drop:**
1. Drag a project from the sidebar onto a slot.
2. A large project lights up **several consecutive slots** (green = available; **red dashed** = shortfall / not enough capacity).
3. Drop to open the **Slot Assignment** modal:
   - **Date alignment** — how the project's dates shift to fit the slot. Lock **Kick-off** or **Launch** only for externally committed milestones.
   - **Slot fit** — weeks needed vs. weeks available, and PM/SC/Build utilisation bars (>100% = overallocation, <50% = waste).
   - **Optimiser suggestions** — Compress, Extend, Use multi-slot, or Shift launch.
   - **Create Draft** (recommended) or **Apply directly**.

The **slot size** (PM/SC/Build hours, duration weeks, max assignees) is set in **Settings → Delivery Slots**.

---

## 14. Reorg / Optimizer

The **Reorg** button opens the **Portfolio Reprioritisation** engine. It scores and ranks projects (by ARR, efficiency, risk, compelling-event dates, locks) and proposes how to schedule/sequence them to relieve bottlenecks — including a Monte-Carlo robustness view (P10/P50/P90 completion) and AI insights (if the optimisation table + AI fields are configured).

It **respects locks**: projects marked Fixed launch / Fixed squad / high priority won't be moved. Output can be saved as a **draft scenario** so you review before committing. (Deep detail: `docs/optimizer-decision-guide.md`.)

---

## 15. Initiatives

**Initiatives** model efficiency gains (tooling, automation, process, training, hiring). Each has a launch date, a ramp, an efficiency % and a scope:
- **Target platforms** (Benifex / FPS / both) and **target project types** (Implementation / Renewal / …) — the boost only applies to matching work.
- Stacking is **multiplicative** across active initiatives.

Toggle the **+X%** checkbox in the toolbar to show/hide their effect on the capacity graph. Use this to answer "if we ship this automation in September, how much capacity do we free up?"

---

## 16. Programs

For large multi-project customers, **Programs** let you carve a percentage of project effort into a shared **program budget** split across workstreams (Governance, Integrations, Payroll, Consulting, Best Practice, Comms, Home). Projects flagged **Resourced within Program** transfer the configured **Program Discount %** (default 15%) into the program. Manage programs and their workstream resourcing from the **Programs** modal; the program rows appear in the grid with their own budget burn-down.

---

## 17. Finance Forecast

The **Finance Forecast** ($) tool models **ARR → capacity demand**: enter expected ARR by quarter/region and modelling parameters, and the tool converts that pipeline into the FTE/hours it would require, overlaying it on capacity. The **FTE Impact** panel summarises the headcount implication. Forecasts are saved as records and can be toggled active to show on the chart. Use it for "can we deliver next year's number with the team we have?"

---

## 18. Leave, availability & ramp-up

A person's capacity automatically drops to zero when they're unavailable. Three cases, all shown as diagonal **stripes** in People view and honoured by the maths:

1. **Before their Start Date** (not yet hired).
2. **After their Termination Date** (the field formerly labelled "Leave Date").
3. **During temporary leave** — sabbatical, parental, long-term sick, etc.

**Multiple leave periods are supported.** The HR sync can feed several leave windows per person (e.g. `6 Jun → 28 Jun` *and* `27 Jul → 1 Sep`). The tool reads **all** of them and removes capacity during **each** window:
- In **AGW**, leave is removed day-by-day within each week.
- In **Annualised**, capacity is emitted only in the **gaps between** leave windows.
- The person's profile lists every period.

**Ramp-up:** new joiners (or initiative headcount) can follow a **ramp profile** (e.g. `0, 25, 50, 75, 100%` over the first weeks) so they don't show full capacity from day one. Profiles are defined in Settings.

---

## 19. Exports & snapshots

- **CSV export** (⬇) — capacity/demand data for spreadsheets.
- **PNG export** (🖼) — the capacity chart as a high-resolution image for decks.
- **Slot snapshots** (📸 in Slots view) — save a named snapshot ("Leadership review — June") so you can show a before/after of your slot plan.

---

## 20. Common workflows

**Weekly staffing check**
1. People view, **AGW** model, cell display **%**.
2. **Exceptions only** (E) → focus on >100% and <50%.
3. Click red cells to see the offending projects; rebalance in a scenario.

**Quarterly portfolio plan**
1. Projects view, group by **Customer**; or Slots view.
2. Look for **clustering** (too much in one period) and **gaps** (wasted capacity).
3. Create a **scenario**, move flexible projects, **Compare**, then commit.

**"A customer pulled their launch forward"**
1. Slots view → find the project in the unresourced sidebar.
2. Drag to an earlier slot; if red dashed shortfall appears, use the optimiser's Compress/Multi-slot/Shift.
3. Save as draft, review, commit.

**"We're overcommitted in March"**
1. People view, filter to March, **Exceptions only**.
2. Identify movable projects (not locked), create a scenario, shift them.
3. **View Changes** / **Compare**, then commit.

**"Show leadership the plan"**
1. Build it in a scenario (or slot snapshot).
2. Export **PNG** / show the **Compare** diff.

---

## 21. Keyboard shortcuts

Verified global shortcuts (press **?** in-app for the live list):

| Key | Action |
|---|---|
| **?** | Open the keyboard-shortcuts panel |
| **Esc** | Close any open modal / menu / selection |
| **⌘F** or **/** | Focus the search box |
| **1 / 2 / 3 / 4** | Jump to fiscal-year Q1 / Q2 / Q3 / Q4 |
| **← / →** | Scroll the timeline left / right |
| **T** | Jump to Today |
| **⌘M** | Collapse / expand the toolbar |
| **E** | Toggle "Exceptions only" |
| **P** | Cycle Plan / EAC / Impact |

(Scenario undo/redo and other context actions may also be available — check the in-app **?** panel.)

---

## 22. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Grid is empty / "No Data Found" | Tables/fields not mapped, or filters hiding everything | Check **Settings** field mappings; clear active filters. |
| A control/feature is missing | Required field not mapped (e.g. Total Effort for **Alt**, Annual Utilisation for **Annualised**, BAU POD dropdown empty) | Map the field in Settings; toggles warn when a field is missing. |
| Numbers look huge (e.g. millions of "hours") | Showing seconds instead of hours | Effort/duration fields must be mapped as the correct type; this is handled automatically when mapped right. |
| Hours don't match between two people's views | Different **Annualised vs. AGW** or **Plan vs. EAC** toggles, or different filters | Confirm both are on the same modes/filters. |
| Clicking a duplicate-named project opens the wrong one | (Fixed) projects are now resolved by unique id | Ensure you're on the latest version; ideally give projects unique names. |
| An edit "does nothing" | A write was rejected (permission, or a synced/read-only field) | Watch for an error toast; check the field is editable and mapped. |
| A change didn't appear | You're in a **scenario** (draft) — it won't touch live until you **Commit**; or the page is on a cached bundle | Commit the scenario; hard-reload to confirm the version number. |
| Stale after deploy | Cached bundle | Hard-reload (Cmd-Shift-R) and confirm the in-app version number ticked up. |

---

## 23. ADMIN: setup

This section is for whoever installs/maintains the extension in Airtable.

### 23.1 Tables to connect
Map these in the extension's settings (some are optional but unlock features):

| Table | Required? | Powers |
|---|---|---|
| **Resources** | ✅ | People / capacity |
| **Projects** | ✅ | Demand, BAU, slots, finance |
| **Squads / Pods** | ✅ (for squads, platforms, BAU pods) | Grouping, platform filter, BAU POD options |
| **Settings** | Recommended | Persisting configuration between sessions |
| **Scenarios** | For scenarios | What-if planning |
| **Programs** | For programs | Program budgets |
| **Optimization Runs** | For optimiser history/AI | Reorg results, AI insights |
| **Finance Forecasts** | For finance | ARR→capacity modelling |

### 23.2 Key field mappings
Map these in **Settings**. (Proxy "Update_*" fields are legacy and generally not needed — direct writes are used now.)

**Resources**
| Maps to | Purpose |
|---|---|
| Working Hours | Weekly hours base for capacity |
| Target Utilisation | Per-person productivity % (AGW) / fallback |
| Annual Utilisation | Flat annual % for **Annualised** model |
| Start Date | Availability start |
| **Termination Date** (key: `LEAVE_DATE`) | Availability end |
| Leave Start / Leave End | Temporary-leave windows — **may be multi-value** (HR sync); all periods are honoured |
| Squad | Squad membership |
| Function / AD Job Title | Role mapping |
| Country, Headshot, Ramp Profile, Ramp Start | Display / ramp-up |

**Projects**
| Maps to | Purpose |
|---|---|
| Kick-off, Launch, UAT Start | Timeline (demand spread) |
| Status | Status filter & colour |
| PM / SC / PD Effort | Effort (**Std** model) |
| Total Effort | Effort (**Alt** model) |
| PM / SC / PD Allocation, Team Allocations | Team & allocation % |
| Project Squad | Delivery squad |
| Customer, Platform, Project Type, Country | Grouping/filters/scope |
| % Complete, Actuals | EAC re-forecast |
| Wave, Effort Profile | Sequencing / effort curve |
| ARR, Implementation Fee, Contract ARR, Deal Efficiency | Finance & optimiser scoring |
| Customer Risk, Compelling Event Date | Optimiser scoring |
| **BAU T-Shirt**, **BAU POD** | BAU support sizing & pod ownership |
| Resourced within Program | Program effort transfer |
| Slot Multiplier / Priority / Region / Locks | Slot optimiser behaviour |
| Resourcing Notes, Resourced | Resourcing workflow |
| Selling Entity | Entity filter |

**Squads / Pods**
| Maps to | Purpose |
|---|---|
| Squad Category | Implementation / BAU / Both (demand category) |
| Squad Platform | Platform filter (Benifex / FPS / …) |

### 23.3 Settings modal — tab by tab
| Tab | What you configure |
|---|---|
| **General** | Capacity thresholds (warning/overload %), capacity buffer, fiscal-year start month. |
| **Utilisation Model** | Annualised vs. AGW; default weekly productivity (AGW). |
| **Alternative Capacity Model** | Standard vs. Alternative; the role-mix % (default 30/30/40) and per-type/platform overrides. |
| **Role Mapping / Role Config** | Map job titles → PM/SC/Build; secondary roles & constraints (used by slot optimiser). |
| **Squads** | Which squads contribute capacity. |
| **Model Logic** | Global capacity multiplier; effort/ramp profiles. |
| **Win Rates** | Pipeline weighting (best-case / commit). |
| **Ramp Up** | Named ramp profiles (`0,25,50,75,100`). |
| **Delivery Slots** | Standard slot: PM/SC/Build hours, duration weeks, max assignees; optimiser knobs (priority dial, reserves, compression/expansion, cross-squad, swaps). |
| **Programs** | Program discount %, efficiency factor, workstream allocation template. |
| **AI Intelligence** | Slot-intelligence table + AI sync (optional). |
| **BAU hours mapping** | Hours-per-year for each T-shirt size. |

Settings persist to the **Settings** table, so they survive reloads and are shared across users of that interface.

---

## 24. For engineers

If you're maintaining the code rather than using the tool:

- **Start with `HANDOVER.md`** (architecture, build, deploy, recent changes) and **`CLAUDE.md`** (critical rules).
- **Stack:** React in an Airtable iframe; heavy maths in a **Web Worker**; Recharts for charts; **inline styles only** (Tailwind doesn't run in the iframe).
- **The worker is generated.** Edit `frontend/worker/workerCodeSource.js`, then run `npm run build:worker`. **Never** edit `workerCode_v4.js` by hand.
- **Bump `APP_VERSION`** in `frontend/constants/settings.js` before every deploy (it's how users confirm they're on a fresh bundle).
- **Deploy:** `npm run release` (its prerelease rebuilds the worker). CI also auto-deploys on push to `main`.
- **Data flow:** Airtable → `Dashboard.jsx` → `hooks/useCapacityData.js` → Worker → processed data → charts/grid.
- **Calculation reference:** `docs/CALCULATION_ENGINES.md`; **state map:** `docs/DASHBOARD_STATE_MAP.md`; **optimiser:** `docs/optimizer-decision-guide.md`.

---

## 25. Glossary

| Term | Definition |
|---|---|
| **Capacity** | Deliverable hours per week after utilisation/leave/ramp. |
| **Demand** | Project effort hours per week. |
| **Utilisation** | Demand ÷ capacity (100% = full). |
| **Squad / Pod** | Delivery team. |
| **Slot** | Standard unit of delivery capacity (time × role hours). |
| **Scenario** | Sandboxed set of changes; commit or discard. |
| **Draft mode** | Editing inside a scenario (not yet live). |
| **EAC** | Estimate at Completion (re-forecast from actuals + % complete). |
| **Impact** | EAC minus Plan. |
| **Annualised / AGW** | Flat annual-% capacity vs. day-by-day weekly capacity. |
| **Std / Alt** | Separate PM/SC/PD effort vs. single total effort split by role mix. |
| **BAU** | Business-As-Usual ongoing support demand. |
| **BAU POD** | The pod that owns a project's ongoing BAU support. |
| **Initiative** | A planned efficiency gain that boosts capacity from a date. |
| **Program** | A shared budget across workstreams for a big customer. |
| **Shortfall / Overflow** | Not enough capacity for a slot / project longer than its slot. |
| **Termination Date** | A resource's employment end date (availability ends after it). |

---

*Maintained alongside the Capacity Model codebase. When you add or change a feature, update this guide and bump the version line at the top.*
