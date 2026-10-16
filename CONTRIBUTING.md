# Contributing

1. Read `docs/spec` first; behaviour is defined there.
2. `npm ci`, then `npm run verify` before you push. It runs format, lint, strict types, unit and
   golden tests, the production build, the secret scan and the Playwright suite.
3. Rendering is deterministic on purpose. Never use `Math.random`, time, locale or trigonometry in
   `src/engine` (a test enforces this). If you change how anything is drawn, run
   `npm run golden:update`, review the SVG diffs in `tests/golden`, and say why in the commit.
4. Keep continuity ids stable in templates; saved scenes and regeneration depend on them.
5. Add a regression test for every bug you fix.
6. No third-party art, fonts or franchise characters; every shape is drawn by code. Templates use
   invented names and must never be described as accurate maps.
