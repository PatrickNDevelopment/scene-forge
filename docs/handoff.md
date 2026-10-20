# Handoff

**State:** v0.1 built locally on branch `phase/04a-build`. Published 2026-10-19: https://github.com/PatrickNDevelopment/scene-forge (branch `main`), demo https://patrickndevelopment.github.io/scene-forge/; CI and Pages green on the first run.
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

- Hosted demo: https://patrickndevelopment.github.io/scene-forge/ (static build). CI and Pages ran green on the first push (2026-10-19).
- Point-level editing of arrows and regions (see docs/backlog.md).

## Publication

Published 2026-10-19 with the owner's approval (portfolio decision D-007): public repository
https://github.com/PatrickNDevelopment/scene-forge (MIT, branch `main`), GitHub Pages at https://patrickndevelopment.github.io/scene-forge/. The
first CI run (Linux, Chromium) and Pages deployment were green; a live check loaded the demo,
refreshed it and found no console errors and no requests to localhost.

## Gotchas

- `vite.config.ts` sets `base: '/scene-forge/'`; e2e runs the production build on port 4176.
- `npm run e2e` rewrites `docs/screenshots`; restore with `git checkout docs/screenshots` unless the
  UI changed. e2e test files go to `test-results/`; nothing is written to the system temp folder.
- The engine must stay free of `Math.random`, time and trigonometry (enforced by a test).
