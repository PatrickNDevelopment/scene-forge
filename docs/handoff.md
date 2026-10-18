# Handoff

**State:** v0.1 built locally on branch `phase/04a-build`. Not pushed, not deployed, no remote.
An independent acceptance review (docs/test-report.md, Part 1) fixed four defects with regression
tests (dashed arrows drawn solid, faction-name typing corrupting labels, regenerate after removing
every faction, duplicate of a 32-character id looping forever) plus keyboard undo on checkboxes.
Its evidence supports `ready_for_publication_review`; the lead engineer updates the registry.

## Run

```powershell
npm ci
npm run dev          # http://localhost:5175/scene-forge/
npm run verify       # full gate (or scripts\verify.ps1 / scripts/verify.sh)
npm run golden:update   # only after an intended rendering change; review tests/golden diffs
```

## What works (covered by tests, see docs/test-report.md)

- Eight templates with invented factions; regenerate with a seed keeping factions, title and moved
  labels.
- Deterministic hand-drawn rendering; golden SVG per template; JSON round trip gives identical SVG.
- Editor: object list, canvas drag (objects and labels), inspector, keyboard control, add, duplicate,
  reorder, delete, factions editor.
- Movement and draw-on animation with a time slider and Play; reduced motion respected; animated SVG
  export.
- Undo/redo with coalescing (200 steps); presets gallery; localStorage autosave with corruption
  recovery; strict JSON import with version 1 migration.
- Visual QA: off canvas, partly off canvas, outside safe area, label overlap, contrast, empty scene.

## What is absent

- No hosted demo; CI and Pages workflows have never run (no remote).
- Point-level editing of arrows and regions (see docs/backlog.md).

## Release blockers before publication

1. Independent acceptance review: done (docs/test-report.md, Part 1).
2. Owner review and explicit approval to publish.
3. First CI run on Linux (golden SVGs must match there).

## Gotchas

- `vite.config.ts` sets `base: '/scene-forge/'`; e2e runs the production build on port 4176.
- `npm run e2e` rewrites `docs/screenshots`; restore with `git checkout docs/screenshots` unless the
  UI changed. e2e test files go to `test-results/`; nothing is written to the system temp folder.
- The engine must stay free of `Math.random`, time and trigonometry (enforced by a test).
