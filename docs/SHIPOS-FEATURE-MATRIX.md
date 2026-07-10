# ShipOS Feature Matrix

## Routes
| Route | Feature | Status |
|-------|---------|--------|
| /mission | Mission Control — daily intention, Top-3, stats | ✅ |
| /tasks | Task Board — CRUD, pipeline, priorities, tags, filter | ✅ |
| /focus | Focus Cockpit — presets, custom, start/pause/reset, task link | ✅ |
| /blockers | Blocker Radar — CRUD, severity, age, resolve | ✅ |
| /vault | Prompt Vault — CRUD, tags, search, favorite, copy | ✅ |
| /decisions | Decision Log — CRUD, search | ✅ |
| /ship-log | Ship Log Generator — today/week, copy, download | ✅ |
| /stats | Stats / Ship Score — streak, chart, formula | ✅ |
| /settings | Settings — export, import, reset, install info | ✅ |

## Data
- localStorage v3 with v1/v2 backward migration
- Export/import JSON backup
- Demo data loader
- No backend required (local-first)

## Navigation
- Desktop: top nav with all routes
- Mobile: bottom nav (Mission / Tasks / Focus / More)
- More sheet: Blockers, Vault, Decisions, Ship Log, Stats, Settings
- Old hash links redirect to real routes

## PWA
- `manifest.webmanifest` with standalone display
- VERSE-themed colors

## QA
- 81/81 viewport checks pass (9 routes × 9 viewports)
- Zero horizontal overflow
- Zero console errors
