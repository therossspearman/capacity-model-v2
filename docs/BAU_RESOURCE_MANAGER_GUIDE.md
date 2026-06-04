# BAU Capacity — Resource Manager Guide

> **App version:** 2.99.019 · Part of the Capacity Model docs set (see also `TRAINING_GUIDE.md`).
> Verified against the calculation engine (`frontend/worker/workerCodeSource.js`) — June 2026.

A practical guide to using the **BAU (Business‑As‑Usual)** function in the Capacity Model.
BAU lets you plan the **ongoing support / "customer change" effort** for live customer
portals, alongside (or instead of) implementation delivery work.

---

## 1. What the BAU function does

Every live customer portal generates a steady stream of ongoing change requests and
support work after it goes live. Rather than create a project for each of these, the
model **synthesises that ongoing demand automatically** from one input: the project's
**BAU T‑Shirt size**.

For every **launched** Implementation project that has a BAU T‑Shirt size, the model:

1. Reads the T‑shirt size and converts it to **annual support hours**.
2. Spreads those hours **evenly across the year** (annual hours ÷ 52 per week, flat).
3. Generates that demand **from the launch date to the end of the visible model window**
   (i.e. it keeps running for the whole forecast horizon, not just one period).
4. Shows it as a virtual **"&lt;Project&gt; (Customer Change)"** demand line.

You do **not** create these BAU demand lines by hand — they are derived from the T‑shirt
size. Change the size and the demand recalculates immediately.

> Precise rule (from the engine): the synthetic line starts at `max(launch date, start of
> the view)` and runs to the **end of the model's date range**. If a project's launch date is
> beyond the visible window, no BAU line is shown yet.

### Real projects vs. virtual BAU demand

This is the key mental model:

- **Renewals and change requests (CRs) are *real* projects.** They are created and tracked as
  actual delivery projects, with their own effort, dates and resourcing. They are **not** part
  of the synthetic BAU line. **The engine enforces this**: virtual BAU is only generated for
  projects whose type is *Implementation* (or blank) — a project typed `Renewal` or
  `Change Request` never produces a "Customer Change" line.
- **Every implementation project *also* generates virtual BAU demand after launch** to
  *simulate the expected, ad‑hoc ongoing change* for that live portal (sized by its T‑shirt).
  Think of it as a placeholder for the "stuff that will come up" that hasn't been booked as a
  project yet.
- **Renewals are the deliberate exception.** Renewals are predictable, scheduled work, so the
  virtual BAU estimate is meant to represent expected change **excluding** renewals. Add each
  upcoming renewal as a **real, future‑dated project** so its effort lands in the right month —
  don't rely on the BAU line to cover it.

In other words: **virtual BAU demand ≈ unplanned/ad‑hoc change**, while **renewals and named
CRs are explicit projects**. Size the T‑shirt for the ad‑hoc tail, and add renewals (and any
sizeable known CRs) as real projects on top so future peaks are visible.

---

## 2. The T‑shirt sizes (annual support hours)

| Size | Annual hours | Typical meaning |
|------|--------------|-----------------|
| **XXS** | 25  | Essential portal only; rarely changes |
| **XS**  | 50  | Very light ongoing change |
| **S**   | 100 | Light, steady BAU |
| **M**   | 200 | Moderate ongoing change |
| **L**   | 400 | Heavy / frequent change |
| **XL**  | 800 | Major programme, constant change |
| **XXL** | 1,600 | Largest, highest‑intensity accounts |

> These are the default hours, defined in the engine. The mapping is **configurable** under
> **Settings → BAU hours mapping** if your team calibrates the numbers differently — the BAU
> view always shows the configured numbers, not these defaults.
> Weekly demand = annual hours ÷ 52 (e.g. an **M** portal ≈ 3.8 hrs/week of BAU).

---

## 3. Setting a portal's BAU size and pod

The **BAU T‑Shirt** lives on the project (the customer‑country portal). You can change it in
**two** places:

1. **On the BAU card itself (quickest).** In the BAU view, open a virtual BAU project to get
   the **BAU Project Details** panel and **click a T‑shirt chip** to change the size. The
   annual hours update instantly and the change is **saved back to the source project**.
2. **On the project record.** Edit the project (its detail panel **Edit**, or directly in the
   Projects table) and pick the T‑shirt size.

> Older versions of this guide said the BAU cards were read‑only — that is **no longer true**.
> Name, country and launch are still read‑only on the card (they come from the source
> project), but the **T‑shirt size and BAU POD are editable** there.

### BAU POD (who owns the ongoing support)

Each project also has a **BAU POD** — the pod responsible for that portal's ongoing support.
It's a linked record on the project, separate from the implementation squad that built it.

- Set it from the same **BAU Project Details** panel via the **BAU POD** dropdown (saved to the
  source project), or on the project record.
- The compact BAU grid **groups virtual BAU projects by their BAU POD**, so you can read each
  pod's total ongoing commitment at a glance.

### Sizing conventions used in this model

- **Size the portal by expected ongoing change volume**, not by how big the original build was.
- **Per‑country customers** (e.g. CCEP, Halliburton): size each country's portal individually.
- **Account‑level / global customers** (e.g. BCG, Medtronic, ExxonMobil, Microsoft, Kantar):
  put the headline size on **one** representative project for the account, and leave the
  other countries at **XXS** so they still appear in the model without double‑counting the
  account's effort.
- A portal that is live but effectively dormant should be **XXS**, not blank — that keeps it
  visible in the BAU view.

---

## 4. Viewing BAU demand

Use the demand toggle at the top of the dashboard:

| Toggle | Shows |
|--------|-------|
| **Implementation** | Project delivery work only (builds, go‑lives). Renewals/CRs and virtual BAU are hidden. |
| **BAU** | Ongoing support: the synthetic **"Customer Change"** lines **plus** real Renewal/CR projects (listed in their own "Renewals & Change Requests" section). |
| **All** | Implementation **+** BAU combined (the true total load). |

When **BAU** (or **All**) is selected:

- The model adds the synthetic **"&lt;Project&gt; (Customer Change)"** demand lines.
- A compact **BAU grid** lists these virtual projects, **grouped by BAU POD**, each card showing
  the country flag, launch date and T‑shirt size badge. Cards are **interactive** — open one to
  change its T‑shirt size or BAU POD.
- The capacity chart includes a **BAU** demand series so you can see ongoing load against
  team capacity.

**Tip:** Plan with **All** to see whether a pod/squad has enough headroom once both new builds
*and* the ongoing BAU tail are taken into account. Implementation alone understates the load.

---

## 5. How a portal qualifies for BAU demand

A project produces a synthetic BAU line only when **all** of these are true (enforced by the
engine):

1. Its **Project Type** is **Implementation** (or blank). Projects typed `Renewal`,
   `Change Request`, or any other BAU type do **not** generate a synthetic line — they're
   handled as real projects instead.
2. It has a **BAU T‑Shirt size** set (and that size exists in the hours mapping).
3. It has a **Launch date**. BAU demand begins at launch (or the start of the view window if it
   launched in the past) and runs to the end of the view.

If a live portal isn't showing BAU demand, check those three things first — almost always
it's a **missing launch date** or a **missing T‑shirt size**.

---

## 6. Filters & combining with other views

The standard dashboard filters all apply to BAU, because the synthetic lines inherit the
source project's attributes:

- **Squad / Platform / Country / Entity / Status** filters narrow the BAU demand the same way
  they narrow implementation demand.
- **Platform** (Benifex / FPS) lets you look at BAU load for one platform at a time.
- Combine the **BAU** toggle with a **Squad/Pod** filter to see a single team's ongoing support
  commitment, then switch to **All** to add their build pipeline on top.

---

## 7. Typical workflows

**A. Check a pod's true workload**
1. Filter to the pod/squad.
2. Toggle **All**.
3. Read the chart: implementation peaks + the flat BAU tail = the real demand line to staff against.

**B. Re‑plan after a go‑live**
1. When a build launches, make sure its project has a **launch date** and a **BAU T‑shirt size**.
2. Switch to **BAU** — the new "(Customer Change)" line should appear from the launch month.
3. Assign its **BAU POD** so the ongoing support sits with the right team.

**C. Re‑calibrate an account**
1. If an account's support load has grown, bump the headline portal's T‑shirt size (e.g. L → XL)
   — either directly on the BAU card or on the project.
2. The weekly BAU demand and the chart update immediately.

---

## 8. Quick reference

- **Input that drives everything:** the **BAU T‑Shirt** size on each launched Implementation portal.
- **Sizes → annual hours:** XXS 25 · XS 50 · S 100 · M 200 · L 400 · XL 800 · XXL 1600 (configurable in Settings).
- **Weekly demand:** annual hours ÷ 52, spread flat.
- **Demand window:** from the project's **launch date** to the end of the model's date range.
- **Where to see it:** the **BAU** / **All** toggle + the compact BAU grid (grouped by BAU POD) and the capacity chart.
- **To change demand:** change the **T‑shirt size** — editable on the BAU card *or* the project record (the change saves to the project).
- **Ownership:** set the **BAU POD** on the card or project to attribute ongoing support to a team.
- **No demand showing?** Check: Implementation type ✔, T‑shirt size set ✔, launch date set ✔.
- **Virtual BAU = ad‑hoc expected change.** Renewals and CRs are **real projects** (the engine
  excludes their types from the synthetic line); add renewals as **future‑dated projects**
  rather than leaning on the BAU estimate.
