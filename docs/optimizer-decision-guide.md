# How the Benifex Portfolio Optimizer Makes Decisions

> A comprehensive guide for internal use, explaining the logic behind automated project prioritization, scheduling, and resource assignment.

---

## Table of Contents

1. [Overview — What Does the Optimizer Do?](#1-overview)
2. [Phase 1: Scoring Every Project](#2-phase-1-scoring)
3. [Phase 2: Scheduling & Date Shifting](#3-phase-2-scheduling)
4. [Phase 3: Resource Assignment](#4-phase-3-resources)
5. [Phase 4: Rebalancing & Micro-Moves](#5-phase-4-rebalancing)
6. [Constraints & Guardrails](#6-constraints)
7. [What-If Overrides](#7-what-if)
8. [How to Read the Results](#8-reading-results)
9. [Frequently Asked Questions](#9-faq)

---

## 1. Overview — What Does the Optimizer Do? {#1-overview}

The Portfolio Optimizer takes every project in the pipeline depending on the applied filters and answers three questions:

1. **What order should we deliver these projects in?** (Prioritization)
2. **When should each project start and finish?** (Scheduling)
3. **Who should work on each project?** (Resource Assignment)

It does this automatically by running a multi-pass pipeline that scores, schedules, and assigns resources in under 2 seconds. The output is a *proposed plan* — you always review and decide whether to accept it before any changes are made.

### The Pipeline at a Glance

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Score All   │───▶│  Schedule    │───▶│  Assign      │───▶│  Rebalance   │───▶│  Present     │
│  Projects    │    │  by Priority │    │  Resources   │    │  & Optimize  │    │  Results     │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
    Phase 1            Phase 2            Phase 3            Phase 4           Your Review
```

The optimizer **never writes changes directly** — it produces a proposal that you can review in the results page, inspect in the Gantt chart, and then choose to "Create Draft" if you're happy.

---

## 2. Phase 1: Scoring Every Project {#2-phase-1-scoring}

### The Tier System

Every project receives a **score out of 100** and is placed into one of five tiers. The tier determines the project's fundamental priority — higher-tier projects are scheduled first and get first pick of resources.

| Tier | Score Range | Label | What Qualifies |
|------|-------------|-------|----------------|
| **1** | 90–100 | **Cornerstone** | Projects for customers designated as "Cornerstone" accounts in the optimizer settings |
| **2** | 65–89 | **Strategic / At-Risk** | High-risk customers, partner deals, verbal churn signals, medium-risk customers, and existing customers with compelling events |
| **3** | 55–69 | **Compelling Event** | New customers with a hard deadline (e.g. regulatory go-live) |
| **4** | 30–54 | **Standard / Net New** | Projects above the minimum cARR threshold without special priority signals |
| **5** | 0–29 | **Below Threshold** | Projects below the minimum cARR threshold — candidates for deferral |
| **-1** | — | **Excluded** | Customers who have served notice — automatically removed from scope |

### How the Score Is Calculated Within Each Tier

Within each tier, the score is **scaled by revenue**. Specifically, the optimizer uses a "blended ARR" formula:

```
Blended ARR = (Project cARR × 70%) + (Contract cARR × 30%)
```

This means both the individual project's revenue *and* the total contract value influence priority. A £50k project on a £2M contract scores higher than a £50k project on a £100k contract.

The blended ARR is then normalized against the maximum in the portfolio to produce a score within the tier's range. For example, within Tier 4 (30–54), the highest-ARR project gets ~54 and the lowest gets ~30.

### Compelling Events & Urgency

Projects with a **compelling event date** (e.g. regulatory deadline) are scored differently. Instead of ARR, the scoring is based on **urgency** — how close the event is:

- Event in 1 year → low urgency → lower score within the tier
- Event in 1 month → high urgency → higher score within the tier

If the customer already has other projects (existing relationship), the compelling event places them in Tier 2 (65–84). New customers with compelling events land in Tier 3 (55–69).

### Risk-Based Elevation

Customer risk level directly determines tier placement:

| Risk Level | Effect |
|------------|--------|
| **Served Notice** | Excluded entirely (tier -1) |
| **High** | Tier 2, scored 80–88 |
| **Verbal** | Tier 2, scored 70–79 |
| **Medium** | Tier 2, scored 65–74 |
| **Low** | Stays in Tier 4 but labelled accordingly |

### In-Flight Bonus

Projects that are already underway (status: "In Progress", "Build", "UAT", "Kick Off", etc.) receive a **score bonus** (configurable, typically +5–10 points). This makes it harder for the optimizer to displace work already started.

### Lock Fields

Projects can have individual **lock controls** set:

- **🔒 Launch Locked**: Dates cannot be moved at all (0 weeks shift allowed)
- **🔒 Squad Locked**: The project stays in its current squad assignment
- **🔒 Resources Locked**: Current resource allocations are preserved

Fully-locked projects are effectively "frozen" — the optimizer schedules them exactly where they are before optimizing around them.

---

## 3. Phase 2: Scheduling & Date Shifting {#3-phase-2-scheduling}

### How Projects Are Ordered

After scoring, all projects are sorted highest-score-first. The optimizer then schedules them in this order, meaning Tier 1 (Cornerstone) projects always get placed first, followed by Tier 2, and so on.

### The Scheduling Algorithm

For each project (in priority order), the optimizer:

1. **Looks at the project's current start and end dates**
2. **Checks if there's a concurrency conflict** — too many countries for the same customer running simultaneously
3. **If there's a conflict, shifts the project forward** in 1-week increments until it fits
4. **Respects the maximum shift limit** — each project has a cap on how far it can be moved

```
For each project (highest priority first):
  ├── Is it a Cornerstone customer?  →  Schedule at original dates (no concurrency limit)
  ├── Try at original dates  →  Does it fit within concurrency limits?
  │   ├── Yes  →  Schedule here ✓
  │   └── No   →  Try +1 week, +2 weeks, +3 weeks...
  │       ├── Found a fit within max shift  →  Schedule here ✓
  │       └── Exceeded max shift  →  Schedule at max shift anyway (with a warning)
  └── Record the project's proposed dates
```

### Concurrency Limits

The optimizer enforces **country-level concurrency** per customer. This means:

- If a customer has projects in 3 different countries, and the max concurrency is set to 2, the optimizer will stagger the third country's projects so only 2 countries run simultaneously.
- Countries are the unit of concurrency, not projects. Two projects in the same country at the same time count as 1 concurrent slot.
- **Cornerstone customers are exempt** from concurrency limits.
- Each customer can have custom concurrency overrides (min/max) set in the optimizer config.

### Maximum Shift Limits

How far a project can be moved depends on its tier and lock status:

| Condition | Max Shift |
|-----------|-----------|
| **Launch locked** | 0 weeks (cannot move) |
| **Cornerstone** | Configurable (typically 2–4 weeks), waived for projects launching after the exclusion date |
| **In-flight** | Configurable (typically 2 weeks) |
| **Standard** | Configurable default (typically 8–12 weeks), waived after the exclusion date |

### Minimum Allocation Guarantee

Before the main scheduling loop runs, a **round-robin pass** ensures every customer gets at least their minimum number of concurrent countries scheduled. This prevents large customers from being starved by a strict priority-only ordering.

### New Business Reserve

A configurable percentage of total capacity can be **reserved for new business**. This works by reducing the available capacity across all squads by the reserve percentage before scheduling begins. For example, if set to 10%, only 90% of each squad's capacity is available for the optimizer to schedule into.

---

## 4. Phase 3: Resource Assignment {#4-phase-3-resources}

### Role Gap Detection

For each scheduled project, the optimizer identifies which roles still need to be filled:

- **PM** (Project Manager)
- **SC** (Solution Consultant)
- **PD** (Product Developer)

If a role is already assigned (via existing data or seeded assignments), it's preserved. The optimizer only fills gaps.

### How Resources Are Matched

Each candidate resource is scored against each project needing a role. The scoring considers **10+ factors**:

| Factor | Points | Description |
|--------|--------|-------------|
| **Squad affinity** | +50 | Resource is in the same squad as the project |
| **Cross-squad** | -20 | Resource is in a different squad |
| **Utilization fit** | 0 to +40 | How close the resource is to their target utilization (typically 80%) |
| **Customer cohesion** | +30 | Resource already works with this customer |
| **Squad specialization** | +40 | Resource's squad specializes in this country/region |
| **Platform match** | +35 | Resource's squad supports this platform |
| **Platform mismatch** | **Hard block** | If a squad lists specific platforms and none match, the resource is ineligible |
| **Priority weighting** | 0 to +25 | Higher-priority projects attract better resources |
| **Revenue weight** | 0 to +20 | Higher-ARR projects get a log-scaled bonus |
| **Staggered timeline** | 0 to +25 | Resource is finishing another project within 4 weeks of this one starting (natural handoff) |
| **Effort profile fit** | +30% bonus | FPS (front-loaded) projects get extra stagger credit |
| **Team continuity** | +15 | Another team member on this project is from the same squad |
| **Workload smoothing** | 0 to -15 | Penalty for resources with spiky/uneven utilization |
| **Leave overlap** | 0 to -60 | Penalty if the resource's leave date means they can only cover part of the project |
| **Ramping up** | -25 | Resource is still onboarding |
| **Excluded squad** | -60 | Resource's squad has been excluded from the optimization scope (soft penalty) |
| **Country-squad affinity** | +20 / -20 | Another resource from the same squad is already serving this customer/country |

### Hard Blocks

Some conditions make a resource **completely ineligible** (not just penalized):

- Resource has already left (leave date in past)
- Leave overlap is less than 25% of the project duration
- Resource would exceed 120% utilization
- Resource's squad has platform constraints that don't match the project

### Assignment Priority

Resources are assigned to projects in **priority order** (highest-scoring project first). This means Tier 1 and Tier 2 projects get first pick of the resource pool. By the time Tier 4 and 5 projects are assigned, they may have fewer options.

### Program Specialist Handling

Resources designated as "Program Specialists" receive special treatment:

- **On program projects**: +60 pts (strong preference)
- **On non-program projects**: -40 pts (reserved for program work)
- Program specialists are **exempt from cross-squad penalties** when working on program projects

### Seeded Assignments

When projects already have existing resource assignments, these are "seeded" into the solution. The optimizer tries to preserve them (each preserved seeded assignment earns +25 in the objective function). However, seeded assignments **can be swapped** if a much higher-priority project needs the resource.

---

## 5. Phase 4: Rebalancing & Micro-Moves {#5-phase-4-rebalancing}

After the initial scheduling and assignment passes, the optimizer runs two additional optimization passes:

### Pass 1: Customer-to-Squad Balancing ("Big Rocks")

Before individual resource assignment, the optimizer looks at the big picture: which squad should serve which customer? It considers:

- Squad capacity vs. customer demand
- Squad specializations (country/platform fit)
- Cross-squad minimization — keeping each customer in as few squads as possible

### Pass 2.5: Customer Micro-Moves ("Small Rocks")

After resource assignment, the optimizer checks:

> "Are there customers with unfilled roles that *could* be fully resourced if moved to a different squad?"

For example, if Customer A is in Squad 1 but Squad 1's PMs are fully booked, and Squad 2 has a free PM with availability — the optimizer will propose moving Customer A's projects to Squad 2. This only happens when it results in **more roles being filled** without disrupting Squad 2's existing commitments.

### Pass 3: Resource Rebalancing

The optimizer performs up to **5 iterative passes** of resource rebalancing:

1. Identify unfilled roles on high-priority projects
2. Look for filled roles on low-priority projects (at least 2 tiers lower)
3. If found, **swap the resource** from the low-priority to the high-priority project
4. Repeat until no more beneficial swaps exist

This ensures that the most important projects are fully staffed, even if it means leaving lower-priority projects with gaps. Resources are **never stolen from in-flight, launch-locked, or resource-locked projects**.

---

## 6. Constraints & Guardrails {#6-constraints}

The optimizer operates within a strict set of constraints to prevent unrealistic or disruptive proposals:

| Constraint | Type | Description |
|------------|------|-------------|
| **Lock fields** | Hard | Launch-locked projects cannot be moved. Squad-locked projects stay in their squad. Resource-locked projects keep their people. |
| **Max date shift** | Hard | Each project has a maximum number of weeks it can be shifted (varies by tier). |
| **Concurrency limits** | Soft | Per-customer country concurrency caps are respected where possible, but projects are never deferred — they're shifted instead. |
| **Compelling event** | Advisory | If a shifted project would end after its compelling event date, a warning is raised. |
| **Utilization cap** | Hard | No resource can be booked above 120% of their weekly hours. |
| **Leave dates** | Hard | Resources who have left are excluded. Resources leaving mid-project are penalized or excluded. |
| **Platform constraints** | Hard | If a squad has explicit platform requirements, resources can only work on matching projects. |
| **New business reserve** | Applied | Capacity is reduced by the reserve percentage before scheduling. |

### What the Optimizer Will NOT Do

- **Defer projects arbitrarily** — all scored projects are scheduled; they are never dropped without user action
- **Break in-flight projects** — currently active projects receive bonus scoring and shift protection
- **Override lock fields** — if you've locked a project's dates, squad, or resources, those decisions are final
- **Change real data** — everything is proposal-only until you explicitly create a draft

---

## 7. What-If Overrides {#7-what-if}

The optimizer supports **per-project overrides** that let you model scenarios:

| Override | Effect |
|----------|--------|
| **Force Defer** | Pull a project out of the schedule entirely |
| **Force Include** | Add a previously excluded project back into the pool |
| **Pin Tier** | Override a project's tier (e.g. make a Tier 4 project behave as Tier 1) |
| **Lock Date** | Prevent the optimizer from shifting this project's dates |

These overrides let you ask "what if?" questions without changing real data:

- *"What if we defer Project X — does Team A free up?"*
- *"What if we treat this new customer as Cornerstone — where do they land?"*
- *"What if we lock this project's dates — how does the rest of the schedule adjust?"*

---

## 8. How to Read the Results {#8-reading-results}

### Summary Statistics

| Metric | Meaning |
|--------|---------|
| **Projects Scheduled** | Number of projects placed in the plan |
| **Projects Deferred** | Number of projects not included (only via force-defer or exclusion) |
| **ARR Protected** | Total annual recurring revenue of scheduled projects |

### The Project Timeline (Gantt Chart)

The Gantt chart on the results page shows:

- **Grey dashed bars** = original timeline (where the project is today)
- **Green solid bars** = unchanged projects (no movement needed)
- **Blue solid bars** = shifted projects (moved forward to resolve conflicts)
- **Purple solid bars** = compressed projects (timeline shortened)
- **Amber solid bars** = nudged projects (small date adjustments)
- **Red hatched bars** = deferred projects

You can group the Gantt by:
- **Chronological** — sorted by start date
- **By Squad** — grouped by assigned squad
- **By Customer** — grouped by customer name

### View Changes Panel

This collapsible panel lists every proposed change:

- **Date shifts**: Which projects would move, by how many weeks
- **Team changes**: Which resource assignments would change
- **Deferred**: Which projects have been removed from the plan

### Financial Impact

Shows the revenue impact broken down by financial year, comparing the original plan to the optimized proposal.

---

## 9. Frequently Asked Questions {#9-faq}

### "Why was my project shifted?"

The most common reason is **customer concurrency**. If the customer already has the maximum number of countries running simultaneously, your project gets pushed back until a slot opens. Check the scheduling note on the project card — it will say something like "Shifted +4w to avoid concurrency conflict."

### "Why didn't my project get a PM/SC/PD assigned?"

Resources are assigned in priority order. If your project is Tier 4 and all available PMs were assigned to Tier 1-2 projects, your project may have gaps. The optimizer will try rebalancing, but it won't steal resources from projects 1 tier higher — it needs a 2-tier gap to justify a swap.

### "Can I change the priority of a project?"

Yes, using the **What-If overrides**. You can pin a project to any tier, which changes where it sits in the scheduling queue. You can also lock its dates or force-defer it.

### "What happens to Cornerstone customers?"

Cornerstone customers receive the highest priority (Tier 1, scores 90–100). They are:
- **Exempt from concurrency limits** — all their projects schedule at original dates
- **Protected from large shifts** — limited to 2–4 weeks of movement
- **First in line for resource assignment** — they get the best resource matches

### "How accurate is the utilization calculation?"

The optimizer calculates utilization in **hours per week** based on real capacity data. It factors in:
- Weekly available hours (accounting for part-time, holidays, etc.)
- Existing bookings from other projects
- The effort profile of each project (front-loaded, back-loaded, bell curve, etc.)
- The specific role demand in hours, not just percentage

### "What's the difference between the Optimizer and a Draft?"

The **Optimizer** is a read-only proposal engine — it shows you what an optimized schedule *could* look like. A **Draft** is a saved set of changes that can be reviewed, compared, and committed to the live plan. The "Create Draft" button converts the optimizer's proposal into a Draft that you can then refine.

### "Does the optimizer learn from previous runs?"

No. Each optimization run is independent — it starts fresh from the current state of the portfolio. This means you always get a consistent result based on today's data, not influenced by previous decisions.

### "How long does it take?"

Typically **1–3 seconds** for a portfolio of 500+ projects. The optimizer yields to the browser every few milliseconds to keep the UI responsive, and has a hard time limit of 2 seconds on any single optimization pass.

---

*This guide reflects the optimizer as of February 2026. Settings such as tier boundaries, shift limits, concurrency caps, and scoring weights are configurable via the AI Settings panel. The underlying logic is implemented in `PortfolioReprioritizer.js`, `OptimizationSolver.js`, and `PeopleOptimizer.js`.*
