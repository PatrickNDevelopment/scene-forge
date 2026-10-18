# Test report

## Part 1: independent acceptance (2026-10-18)

Reviewer: an independent Claude Code session that did not write this code, following
`portfolio-control/CLAUDE_RULES.md` and `RELEASE_GATES.md`. Environment: Windows 10, Node.js 24.20,
npm 11.19, Playwright 1.64 driving the installed Microsoft Edge. Started from a clean tree at
`57f19b9` on `phase/04a-build`. Every result below is from a command that was run and whose output
was read. Nothing was pushed, published or deployed.

### Commands and exit codes

| #   | Command                                                                       | Exit | Result                                                                 |
| --- | ----------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------- |
| 1   | `git status` at `57f19b9`                                                     | 0    | clean tree                                                             |
| 2   | `scripts\verify.ps1` at `57f19b9` (baseline)                                  | 0    | `ALL CHECKS PASSED`: 33 unit tests, build, no secrets, 14 e2e          |
| 3   | `scripts\verify.ps1` with output redirected (`*>&1`) at `57f19b9`             | 1    | aborted at e2e on an npm stderr warning (PowerShell 5.1 quirk), fixed  |
| 4   | scratch Vitest probe (engine; not committed)                                  | 0    | findings A to D below; hand-derived scenarios all matched              |
| 5   | scratch Playwright probe (7 scenarios; not committed)                         | 1    | findings A to C, E below; the rest matched                             |
| 6   | `npx vitest run tests/acceptance-regressions.test.ts` on the unfixed `src/`   | 1    | 5 of 6 new tests fail (the sixth guards unchanged behaviour)           |
| 7   | `npm run golden:update`, then diff of `tests/golden`                          | 0    | only retreat and trade-route change; every path `d` identical          |
| 8   | `npx playwright test` (all journeys, incl. the new regression scenario)       | 0    | 15 passed; probes for A, B, C, E now pass                              |
| 9   | fresh `git clone` of `b362844` into a scratch folder, `scripts\verify.ps1`    | 0    | `npm ci` (0 vulnerabilities), 40 unit tests, build, no secrets, 15 e2e |
| 10  | in that clone: one byte appended to `tests/golden/siege.svg`, `verify.ps1`    | 1    | `FAILED: unit tests (exit 1)`, output redirected, no later step ran    |
| 11  | in that clone: an `any` added to `src/lib/files.ts`, `sh scripts/verify.sh`   | 1    | stopped at lint (`no-explicit-any`); clone deleted afterwards          |
| 12  | `git log --all -p` grep for key/token patterns; list of every file in history | 0    | no secrets; only source, docs, tests, goldens and four screenshots     |

The final full gate on the committed result is recorded at the end of this part.

### Defects found and fixed (each with a regression test)

| Id  | Defect (observed)                                                                                                                                                                                                                                                   | Fix                                                                                                                                                                               | Regression test                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| A   | Dashed arrows with a draw animation were drawn **solid** everywhere (canvas, static and animated export): the draw-on `stroke-dasharray="100"` replaced the dash pattern. The templates' "withdrawal" and "trade route" arrows and the Dashed checkbox did nothing. | Such arrows keep their dash pattern and fade in (`stroke-opacity` = eased progress; `sf-f-<id>` opacity keyframes in the animated export). Spec 01 and known limitations updated. | `tests/acceptance-regressions.test.ts`; e2e "acceptance regressions" |
| B   | Typing a faction name replaced every intermediate name inside labels: typing "red" over "Faction A" in trade-route gave `red maredket`, `Faction B poredt`, `tredade redoute` (journey 1 corrupts labels).                                                          | `renameFaction` takes the scene as it was when the name field got focus and computes label replacements from it.                                                                  | both                                                                 |
| C   | Regenerate after removing every faction produced objects pointing at deleted factions: invalid scene, banner "Internal error: refused to save an invalid scene", autosave lost.                                                                                     | Regenerated objects whose faction no longer exists use the ink colour (`factionId: null`).                                                                                        | both                                                                 |
| D   | Duplicating an object whose id has 31 or 32 characters (possible through import) looped forever in `freshId`, because truncating the candidate cut the number off (probe: candidate equals the original id).                                                        | The prefix is shortened, never the number.                                                                                                                                        | unit (12 duplicates of a 32-character id)                            |
| E   | Ctrl+Z / Ctrl+Y did nothing while a checkbox, slider or colour input had focus (all inputs were treated as text fields).                                                                                                                                            | Only text-entry fields keep their own undo.                                                                                                                                       | e2e                                                                  |
| F   | `verify.ps1` aborted on npm's stderr warnings when its output was redirected (PowerShell 5.1 with `ErrorActionPreference = Stop`).                                                                                                                                  | Steps run with `Continue` and are judged by exit code; command 10 shows a real failure still stops it.                                                                            | command 10                                                           |

Goldens: `tests/golden/retreat.svg` and `trade-route.svg` were regenerated deliberately for A; the
diff only replaces the draw attributes of the two dashed arrows with `stroke-dasharray="16 12"`.

### Journeys exercised (production build under `/scene-forge/`, Edge)

1. Encirclement from the gallery, factions renamed (typed key by key and by `fill`) and recoloured,
   regenerate with seed 777 (geometry changes, factions kept), labels moved by Alt+arrows, drag and
   inspector, Export SVG: valid XML, edits present, nothing executable. PASS after fix B.
2. Save JSON, reload (autosave gives a byte-identical export), clear storage, reopen the file:
   byte-identical export and the same object positions. PASS.

### Adversarial checks (what was tried and what happened)

- **Spec-derived scenarios (hand computed, compared with the engine):** v1 migration (safe area 30
  expanded to four sides, `durationMs` 4000, `template` null, `anim` none; a v1 object carrying
  `anim` is refused); move at t = 0.3 with start 0.2, end 0.6 from x 0 to 100: p = 0.25, eased
  0.15625, x = 15.625 (engine 15.624999...); QA on an 800 x 450 canvas with 20 px safe area: stand
  figure with its top at y 10 gives OUTSIDE_SAFE_AREA, right edge exactly 800 gives
  OUTSIDE_SAFE_AREA, 801 gives PARTLY_OFF_CANVAS, left edge 801 gives OFF_CANVAS; contrast #777777
  on white 4.478 and #767676 4.542 (WCAG reference values); a label moved by (33, -7) keeps
  `dx 33, dy -127` across regenerate while the figure moves; history coalescing at 600 ms joins and
  at 601 ms splits; redo is cleared by a new edit. All matched.
- **Determinism:** for all eight templates (seed 7) the browser's Export SVG equals the Node golden
  byte for byte, in a context with locale `de-DE` and time zone `Asia/Kathmandu`; the canvas path
  data equals the export path data; a reload gives the same export. The engine source has no
  `Math.random`, time or trigonometry (unit test). PASS.
- **Sanitization:** typed labels with markup, quotes, ampersands, a BEL and a U+0085 control
  character, a lone surrogate, emoji with skin tone, Hebrew and Arabic text, `]]><!--` and 250
  characters: controls removed, length capped at 200, every export parses with the browser's XML
  parser and the parsed text equals the canvas text; a title with `<b>` and NUL is escaped and
  stripped. PASS.
- **Crafted JSON (via the Open JSON button):** `__proto__` and `constructor` keys, `1e400`, versions
  0, 3 and "2", 3000-deep nesting, duplicate ids, missing factions, an empty file, a control
  character or lone surrogate in a label: each refused with its JSON path, no crash, no prototype
  pollution. A label `<script>…` is accepted as text and stays text. 300 objects open in about 0.5 s
  and 10 nudges take about 1.5 s; 301 objects are refused. PASS.
- **Undo/redo:** none after load; after regenerate it restores the previous layout; delete then
  Ctrl+Z restores; five quick nudges are one step, two nudges 700 ms apart are two; Ctrl+Z inside the
  title field undoes the typing, not the scene. PASS (checkbox case fixed, E).
- **Animation:** scrubbing to 0 and back to 1 restores the final transform; Pause holds the frame;
  duration input clamps 100 to 500 and 999999 to 20000; with reduced motion Play is disabled; the
  animated export, inserted into a page, computes `transform: none` under reduced motion and an
  offset transform without it. PASS.
- **Layout and access:** no horizontal overflow on Editor, Gallery and About at 320, 375, 768 and
  1440 px; keyboard only: Tab reaches the object list, Enter selects, the canvas shows a 3 px focus
  outline, arrows move, Alt+arrow moves the label, Escape clears. Screenshots read: the committed
  `docs/screenshots/*.png` (desktop, mobile, dark) and the reviewer's own 320 px gallery, 375 px dark
  editor and keyboard-focus shots. No unusable screen found. PASS.
- **Static build:** e2e serves `dist` with `vite preview` under `/scene-forge/`; deep link
  `#/gallery` survives a hard reload; the page made 3 requests in total (HTML, JS, CSS), all to its
  own origin under `/scene-forge/`. No backend exists, so there are no offline states to test.
- **Claims and ethics:** README feature list matches behaviour (after A, dashed arrows really are
  dashed). Every surface says the scenes are illustrations and not geographically accurate maps
  (header chip, footer, About, gallery text, SVG `<desc>`); nothing calls a scene verified or real.
  No third-party art, fonts or images: all shapes are drawn by code, the only binaries are the four
  screenshots. MIT licence present; history has one author identity and no secrets.

### Remaining issues (not fixed)

- Renaming a faction replaces its old name inside any label text, also within longer words
  (documented in known limitations).
- Keyboard Ctrl+Z/Ctrl+Y does not reset a scrubbed time to the final frame, unlike the buttons
  (cosmetic: the next edit does).
- U+FFFE / U+FFFF in an imported title passes the text rule and is removed only in the export (valid XML either
  way).
- Not tested: Linux and CI (no remote), Firefox, Safari, screen readers, 200% zoom.

## Part 2: builder's report

Kept unchanged below.

## Builder's report (2026-10-16)

Environment: Windows 10, Node.js 24.20, npm 11.19, Playwright 1.64 with the installed Microsoft Edge.
Every result below comes from a command that was run and whose output was read.

### Full gate

`scripts\verify.ps1` (= `npm run verify`), exit 0, `ALL CHECKS PASSED`:

| Step        | Command                | Result                                        |
| ----------- | ---------------------- | --------------------------------------------- |
| install     | `npm ci`               | ok                                            |
| format      | `npm run format:check` | ok                                            |
| lint        | `npm run lint`         | ok                                            |
| types       | `npm run typecheck`    | ok (strict)                                   |
| unit/golden | `npm test`             | 3 files, 33 tests passed                      |
| build       | `npm run build`        | ok                                            |
| secrets     | `npm run secrets`      | no findings                                   |
| e2e         | `npm run e2e`          | 14 passed (production build, `/scene-forge/`) |

**Fresh clone**: `git clone` of `6d8af42` into a temporary folder, `scripts\verify.ps1`: exit 0,
33 unit tests, 14 e2e. Folder deleted afterwards.

**The verify scripts fail loudly** (in a scratch clone): with a deliberately broken file,
`scripts\verify.ps1` stopped with `FAILED: format check (exit 1)` and `scripts/verify.sh` exited 1 at
the format check.

### What the unit tests cover

FNV-1a and mulberry32 known values; number formatting; **golden SVG per template** (seed 7, exact
string match, valid XML); same scene and seed give identical SVG, another seed differs; JSON save and
reopen gives identical SVG for every template; editing one object leaves other objects' strokes
identical; the engine source contains no `Math.random` or trigonometry; export escaping (markup,
quotes, control characters, lone surrogates) and the "not a map" description; 1- and 200-character
labels; animation progress and easing; `t = 1` equals the static render and `t = 0` differs; animated
export wrapped in `prefers-reduced-motion: no-preference`; every template validates, is marked sample,
has a move and a draw animation; layout variation keeps ids; faction rename flows into labels;
regenerate keeps factions, title and moved labels; schema refusals (wrong schema, newer version,
unknown keys, colours, ids, control characters, duplicate ids, missing faction, out-of-range
numbers, wrong animation kind, start >= end, invalid JSON, non-objects, files over 2 MB); version 1
migration renders like the final frame; 20 x 80 random edits always validate; undo/redo, coalescing
and the 200-step limit; visual QA codes; WCAG contrast reference values; **every template is free of
QA findings for seeds 0 to 40**.

### Defects found while building (fixed)

1. Every template title and, for some seeds, the bottom encirclement attacker and one
   alliance-collapse label sat outside the safe area (found by the template QA test across 41 seeds);
   the layouts were adjusted and the test now guards them.
2. On phones the canvas appeared after the object list and QA panel; it now comes first.

### Playwright journeys (production build under `/scene-forge/`)

Journey 1 (encirclement, rename and recolour factions, regenerate with seed 777, move labels with
Alt+arrows and the inspector, export: valid XML, edits present, nothing executable); journey 2 (edit,
Save JSON, refresh gives the identical export, clear storage, reopen the file: identical export and
preserved positions); undo/redo by buttons and Ctrl+Z / Ctrl+Y, Delete and undo; mouse drag of an
object (one undo step); mouse drag of a label (object stays put); animation scrubbing, Play, reduced
motion disables Play, animated export guarded; one-letter and 200-character labels with markup stay
text, QA flags overlap; empty scene, off canvas, partly off canvas, outside safe area; bad files
refused with reasons, version 1 upgraded; corrupt storage recovery with download; presets save, open,
delete; deep link and refresh under the prefix; accessible names and no overflow at 320 px on every
view; screenshots.

Screenshots (inspected): `docs/screenshots/desktop-editor.png`, `desktop-gallery.png`,
`mobile-editor.png`, `desktop-editor-dark.png`.

### Not tested

Linux (CI not run yet), Firefox, Safari, screen readers, 200% zoom.
