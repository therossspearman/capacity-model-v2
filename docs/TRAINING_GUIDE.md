# Capacity Model - Resource Manager Training Guide

> **Version**: 2.99.011 | **Last Updated**: June 2026
> This is an end-user (Resource Manager) guide and may lag the latest release. Keep it updated as features evolve.

---

## Part 1: Understanding the Tool

### What This Tool Does
The Capacity Model helps you:
- **Visualize** demand vs. capacity across squads and time
- **Plan** project assignments to delivery slots
- **Simulate** "what-if" scenarios without affecting live data
- **Optimize** resource allocation with AI-powered recommendations

### The Core Concept: Slots
A **slot** represents a fixed unit of delivery capacity:
- Default: 12 weeks duration
- Contains: PM hours, SC hours, Build hours (configurable in Settings)
- Filled by: Projects with matching effort profiles

**Key Insight**: Think of slots like parking spaces. Each squad has a limited number of parking spaces per time period. Your job is to ensure projects "park" efficiently.

---

## Part 2: Views & When to Use Them

### Heatmap View (Default)
**Best for**: Quick capacity health check

| Color | Meaning | Action |
|-------|---------|--------|
| 🟢 Dark Green | 3+ slots available | Safe zone |
| 🟢 Light Green | 2 slots available | Monitor |
| 🟠 Amber | 1 slot available | Needs attention |
| 🔴 Red | 0 slots / Overcommitted | Immediate action |

**How to think**: Scan for red zones first. These are your fires.

### Gantt View (New)
**Best for**: Timeline planning and drag-drop assignment

| Element | What It Represents |
|---------|-------------------|
| Green bars | Open delivery slots |
| Blue bars | Assigned projects |
| Red dots on blue bars | Staffing gaps |

**How to think**: Use Gantt when you need to see the *sequence* of work, not just the summary.

---

## Part 3: The Unresourced Projects Sidebar

### Understanding the List
Projects appear here when they lack full staffing:
- **Partial** = Some roles assigned, some missing
- **Unstaffed** = No roles assigned yet

### Filtering Strategy
| Filter | When to Use |
|--------|-------------|
| Year | Focus on FY planning cycles |
| Customer | When a specific customer needs attention |
| Squad | When planning within a single team |

**Pro tip**: Filter by customer during stakeholder meetings to show their portfolio view.

---

## Part 4: Drag-and-Drop Assignment

### Basic Flow
1. Drag a project from the sidebar
2. Drop onto a slot bar in Gantt view
3. Review the **SlotAssignmentModal**
4. Choose: Create Draft or Apply Directly

### Multi-Slot Projects
When you drag a large project (e.g., requiring 4 slots worth of effort):
- **Green borders** highlight all consecutive slots needed
- **Red dashed outlines** = Not enough capacity (shortfall)

**How to think**: If you see red phantom slots, you're overcommitting. Either:
1. Move the project to a different time period
2. Split the scope
3. Use the optimizer recommendations

---

## Part 5: The SlotAssignmentModal

### Date Alignment Section
Shows how the project dates will shift to match the slot.

| Lock | Effect |
|------|--------|
| 🔒 Lock Kick-Off | Project starts on original date (may overflow slot) |
| 🔒 Lock Launch | Project ends on original date (may underutilize slot) |

**How to think**: Lock dates only for externally committed milestones. Otherwise, let the slot dates guide you.

### Slot Fit Analysis
- **PROJECT**: How many weeks the project needs
- **SLOT**: How many weeks the slot provides
- **Utilization bars**: PM/SC/Build capacity usage

**Warning signs**:
- Bars > 100% = Overallocation risk
- Bars < 50% = Underutilization (wasted capacity)

### Optimizer Recommendations
| Recommendation | When It Appears | What It Does |
|----------------|-----------------|--------------|
| ⏱️ Compress Timeline | Project > slot | Reduces duration, increases weekly effort |
| 📈 Extend Timeline | Project < slot | Extends to use full slot capacity |
| 📦 Use Multi-Slot | Large overflow | Reserves consecutive slots |
| 📅 Shift Launch | Overflow | Moves launch date, keeps kick-off |

### Draft vs. Direct Update
| Mode | When to Use |
|------|-------------|
| **Create Draft** | Planning sessions, "what-if" analysis |
| **Update Directly** | Quick fixes, confident changes |

**How to think**: Default to Draft. You can always commit later.

---

## Part 6: Scenario Management

### Understanding Scenarios
- **Live Data**: Actual Airtable records
- **Draft Scenarios**: Sandboxed changes for exploration
- **Committed Scenarios**: Applied changes (in commit history)

### Best Practices
1. **Name scenarios meaningfully**: "Q2 Rebalance Option A" not "Test 1"
2. **Compare before committing**: Use the scenario diff view
3. **One scenario per planning question**: "What if we delay Customer X?" should be its own scenario

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `⌘ + Z` | Undo last change |
| `⌘ + Shift + Z` | Redo |
| `A` | Toggle Audit Drawer |

---

## Part 7: Strategic Thinking

### Weekly Planning Ritual
1. Open Heatmap → Scan for red zones
2. Filter to next 8 weeks
3. Address any critical shortfalls
4. Review unresourced projects → Set priorities
5. Run optimizer → Review recommendations

### Quarterly Planning Ritual
1. Switch to Gantt view
2. Expand all squads
3. Look for clustering (too many projects in one period)
4. Look for gaps (wasted capacity)
5. Create draft scenario for rebalancing

### When to NOT Move a Project
Projects flagged as `immovable` or `priorityLock`:
- Customer-committed dates
- Go-live tied to external events
- Dependencies on other projects

**The tool respects these** – recommendations won't suggest moving locked projects.

---

## Part 8: Common Scenarios & Solutions

### "A customer just accelerated their launch"
1. Find the project in sidebar
2. Drag to earlier slot
3. Check for shortfall (red phantom slots)
4. If shortfall: Use optimizer to compress or multi-slot

### "We're overcommitted in March"
1. Heatmap → Filter to March
2. Identify which projects can move
3. Create draft scenario
4. Move flexible projects to adjacent slots
5. Compare before/after in scenario diff

### "I need to show leadership the plan"
1. Save a snapshot (📸 in Slot view)
2. Name it: "Leadership Review - [Date]"
3. Make your changes
4. Click snapshot to show before/after comparison

---

## Part 9: Settings Reference

### Slot Profile
| Setting | Default | Impact |
|---------|---------|--------|
| PM Hours | 40 | Defines PM capacity per slot |
| SC Hours | 120 | Defines SC capacity per slot |
| Build Hours | 80 | Defines build capacity per slot |
| Duration Weeks | 12 | Default slot length |

**How to think**: These should match your organization's actual delivery cadence. If your sprints are 8 weeks, use 8.

### Role Mapping
Maps your Airtable role names to the three core roles (PM, SC, Build).

**Common mapping**:
- Digital Project Manager → PM
- Consultant, Developer → SC
- Senior Developer, Designer → Build

---

## Part 10: Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Projects not showing in sidebar | Already fully staffed | Check staffing status filter |
| Slots showing wrong capacity | slotProfile not set | Configure in Settings |
| Drag-drop not working | Collapsed squad | Expand squad first |
| Hours look wrong (huge numbers) | Showing seconds not hours | Already fixed in v2.60+ |

---

## Appendix: Glossary

| Term | Definition |
|------|------------|
| **Slot** | A unit of delivery capacity (time × roles) |
| **Squad** | A team that delivers projects |
| **Shortfall** | When project demand exceeds slot capacity |
| **Draft Scenario** | A sandboxed set of changes |
| **Proxy Fields** | Temporary fields for optimistic updates |
| **Overflow** | Project runs longer than slot duration |
| **Underflow** | Project uses less than slot duration |

---

*This guide is maintained alongside the Capacity Model codebase. As features are added, update this document.*
