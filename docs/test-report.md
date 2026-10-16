# Test report

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
