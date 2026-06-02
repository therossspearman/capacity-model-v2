# Working Style & Agent Collaboration Guide

> **Living Document** — Update this file as you learn new preferences, patterns, or corrections. Keep it accurate and current.

## Addy's Preferences

### Communication Style
- **Concise requests** — Often uses shorthand, bullet points, or ticket-style descriptions
- **Direct feedback** — Prefers quick iterations over lengthy explanations
- **Context-aware** — Expects continuity across conversations and sessions

### Code Quality Standards
- **A+ Polish** — UX refinements matter; typography, spacing, and visual consistency are priorities
- **Design system adherence** — Use established tokens (`BRAND`, `TOKENS`, `colors`) over hardcoded values
- **Dark mode support** — Theme bindings required, no hardcoded colors
- **Inter typography** — Default font stack across the application
- **Premium Enterprise UI** — Use glassmorphism footers, gradient buttons, and rich visual feedback for all modals

### Development Patterns
- **Airtable Extensions** — Primary platform; respect bundle constraints and React/SDK patterns
- **Inline styles** — JSX style objects preferred over Tailwind for this codebase
- **Component extraction** — Modular, reusable components with clear responsibilities
- **Web Workers** — Performance-critical calculations offloaded to workers

### Workflow Preferences
- **Proactive execution** — Make changes directly, don't ask for permission on obvious tasks
- **Show results** — Summarize what was done with specific metrics (e.g., padding values changed)
- **Batch related changes** — Group related updates in single sessions
- **Version updates** — Follow `/version-update` workflow for deployments

---

## Best Practices for Agents

### Do
- Jump straight into implementation for clear requests
- Use design system constants (`INTER`, `MONO`, `BRAND.benifexPurple`)
- Apply theme colors consistently (`colors.text`, `colors.border`, etc.)
- Verify syntax/builds where possible before finalizing
- Reference past conversations and KIs for context

### Don't
- Over-explain or repeat what the code does
- Use placeholder values — generate real assets if needed
- Create overly verbose plans for simple tasks
- Hardcode colors or font stacks — use constants

### Density Guidelines
- **Padding**: 8-16px typical range, tighter for compact UIs
- **Gaps**: 6-12px for related items
- **Font sizes**: 10-16px range, use semantic scaling
- **Border radius**: 6-10px for modern feel

### Premium Modal Standards
- **Footer**: Glassmorphism effect (`backdropFilter: 'blur(20px)'`), distinct border, rounded bottom corners (24px)
- **Buttons**:
  - Primary: Gradient backgrounds (e.g., `linear-gradient(135deg, #22c55e 0%, #16a34a 100%)`)
  - Secondary/Cancel: Transparent with subtle borders
  - Hover: Use transform scales (translateY(-1px)) and shadow expanses
- **Stats**: Use color-coded pills/indicators for capacity gains and financial impact


---

## Project Context

| Aspect | Details |
|--------|---------|
| Platform | Airtable Interface Extensions |
| Stack | React, vanilla CSS, Web Workers |
| Design System | Custom tokens in `/frontend/design-system` |
| Theme | Light + Dark mode via `useTheme()` |
| Font | Inter (text), JetBrains Mono (numbers) |
