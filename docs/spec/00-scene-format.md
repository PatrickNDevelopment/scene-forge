# Spec 00: scene format (schema `scene-forge.scene`, version 2)

A scene is a JSON document. The editor, the renderer, the exporter and the importer all use this one
model; there is no second representation.

## Scene

| Field          | Rule                                                                                 |
| -------------- | ------------------------------------------------------------------------------------ |
| `schema`       | the string `scene-forge.scene`                                                       |
| `version`      | integer 2 (version 1 is migrated, see below; anything newer is refused)              |
| `title`        | string, 1 to 120 characters                                                          |
| `seed`         | integer 0 to 4,294,967,295 (the style seed)                                          |
| `styleVersion` | integer 1 (the hand-drawn stroke algorithm; a different value is refused)            |
| `canvas`       | `{ width, height, paper, ink }`: integers 320 to 4096; colours `#rrggbb`             |
| `safeArea`     | `{ top, right, bottom, left }`: integers 0 to 400, inset from the canvas edges       |
| `factions`     | 0 to 8 `{ id, name, color }`: id per the id rule, name 1 to 40 characters, `#rrggbb` |
| `objects`      | 0 to 300 scene objects                                                               |
| `animation`    | `{ durationMs }`: integer 500 to 20,000                                              |
| `sample`       | boolean: true when the scene came from a template or the sample gallery              |
| `template`     | the template id the scene was built from, or `null`                                  |

**Id rule** (continuity ids): `^[a-z][a-z0-9-]{0,31}$`, unique among factions and among objects.
An object keeps its id across edits, undo/redo, regeneration of its template and save/reopen, and
the hand-drawn jitter of an object depends on its id, not on its position in the list. Editing one
object therefore never changes the strokes of another.

## Objects

Every object has `id`, `kind`, `factionId` (a faction id or `null`), `label` (`null` or a label
spec) and `anim`.

| `kind`   | Extra fields                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------- |
| `figure` | `x`, `y`, `scale` (0.25 to 4), `pose` (`stand`, `walk`, `point`, `cheer`, `fallen`), `facing` (1 or -1) |
| `prop`   | `x`, `y`, `scale` (0.25 to 4), `prop` (`castle`, `tent`, `flag`, `ship`, `crate`, `tree`, `wall`)       |
| `arrow`  | `points`: 2 to 12 `[x, y]` pairs; `width` (1 to 12); `dashed` (boolean)                                 |
| `region` | `points`: 3 to 24 `[x, y]` pairs (a closed outline)                                                     |
| `text`   | `x`, `y`, `text` (1 to 200 characters), `size` (10 to 96)                                               |

Coordinates are numbers between -4096 and 8192 (objects may sit off the canvas; visual QA flags
them). All numbers must be finite.

**Label spec**: `{ text, dx, dy, size }`: text 1 to 200 characters, `dx`/`dy` -2000 to 2000 (offset
from the object's anchor), size 10 to 64. Anchors: the figure's or prop's `(x, y)`, the arrow's
middle point (by index), the region's first point.

**Text rule**: every string (titles, names, labels, text) is a single line and must not contain a
control character (U+0000 to U+001F or U+007F to U+009F) or a lone surrogate. Such text cannot be
written into valid XML, so it is refused on import and removed from typed input.

**Animation** (`anim`): `{ "kind": "none" }`, or `{ "kind": "move", "fromX", "fromY", "start", "end" }`
(figure, prop, text), or `{ "kind": "draw", "start", "end" }` (arrow, region). `start` and `end` are
fractions of the scene duration with `0 <= start < end <= 1`.

## Version 1 and migration

Version 1 is the base format without animation: no `animation` field on the scene and no `anim` on
objects, and `safeArea` was a single number applied to all four sides. `migrate(v1)` adds
`animation: { durationMs: 4000 }`, `template: null`, `anim: { kind: "none" }` on every object and expands `safeArea`.
A migrated scene renders exactly as the version 1 scene did at `t = 1`. Unknown or newer versions are
refused with a clear message; nothing is guessed.

## Validation

Import validates with a strict schema (unknown keys are errors) and then the cross rules: unique
ids, `factionId` references an existing faction, colours, ranges, text rule, `anim` kind allowed for
the object kind. Errors are listed with their JSON path. A file larger than 2 MB is refused before
parsing.
