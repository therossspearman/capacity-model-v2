---
description: How to handle version updates when deploying changes
---

# Version Update Workflow

## Overview
This app displays a version number in the Settings modal. The version is defined in `frontend/constants/settings.js`.

## Version Format
`MAJOR.MINOR.PATCH` (e.g., `2.61.000`)

- **MAJOR**: Significant feature additions or breaking changes
- **MINOR**: New features, enhancements
- **PATCH**: Bug fixes, small improvements

## When to Update Version

**ALWAYS update the version when:**
1. Deploying to Airtable via `npx block release`
2. Adding new features
3. Fixing bugs
4. Making any user-visible changes

**How to increment:**
- Bug fix only → increment PATCH (2.61.000 → 2.61.001)
- New feature → increment MINOR, reset PATCH (2.61.001 → 2.62.000)
- Major change → increment MAJOR, reset others (2.62.xxx → 3.00.000)

## Steps

1. Open `frontend/constants/settings.js`
2. Find `export const APP_VERSION = 'X.XX.XXX';`
3. Increment appropriately
4. Run `npx block release`
5. Commit with message including version: `feat: Add feature X (v2.62.000)`

// turbo-all

## Example

```javascript
// Before
export const APP_VERSION = '2.61.000';

// After adding a new feature
export const APP_VERSION = '2.62.000';
```

## Important
- Version is displayed in Settings modal footer
- Training guide references version - update if major features added
- Version is also shown in the TRAINING_GUIDE.md header
