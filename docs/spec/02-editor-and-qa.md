# Spec 02: templates, editing, history, visual QA

## Templates

`buildTemplate(id, { factions, seed })` returns a version 2 scene with `sample: true`. Template ids:
`encirclement`, `retreat`, `siege`, `trade-route`, `supply-line`, `alliance-formation`,
`alliance-collapse`, `timeline`. Each template places its objects from fixed layouts, varied by up to
24 px per object with a layout stream `mulberry32(fnv1a32("layout:" + seed + ":" + objectId))`, and
uses fixed continuity ids. Every template includes at least one moving object and one drawn arrow.
Faction names and colours come from the caller (defaults are invented: "Faction A", "Faction B",
"Faction C").

**Regenerate** rebuilds the scene from its template with a new seed but keeps the current factions,
title and every label the user repositioned (label `dx`/`dy` and text of objects whose id still
exists).

## Editing

Every change is a pure function `(scene) -> scene`. Keyboard: with an object selected on the canvas,
arrows move it 1 px (Shift: 10 px), Alt+arrows move its label, `Delete` removes it, `Ctrl+Z` /
`Ctrl+Y` (or `Ctrl+Shift+Z`) undo and redo, `Escape` clears the selection. Every value is also
editable in the inspector with labelled inputs.

## History

Up to 200 undo steps. A drag or a run of arrow-key nudges on the same object within 600 ms is one
step. Undo never crosses a load: opening a file or a template starts a new history.

## Visual QA

`runQa(scene)` returns findings sorted by object id then code:

| Code                | Rule                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| `OFF_CANVAS`        | the object's bounding box lies entirely outside the canvas                                               |
| `PARTLY_OFF_CANVAS` | the bounding box crosses a canvas edge                                                                   |
| `OUTSIDE_SAFE_AREA` | the bounding box crosses the safe area (and is not already off canvas)                                   |
| `LABEL_OVERLAP`     | two label boxes intersect (label box: width = characters * size * 0.56, height = size * 1.2, centred)    |
| `LOW_CONTRAST`      | a label or text colour against the paper has a WCAG contrast ratio below 4.5, or a stroke colour below 3 |
| `EMPTY_SCENE`       | the scene has no objects                                                                                 |

Label widths are estimates (no font metrics are available deterministically); QA says so.

## Persistence

The current scene is saved in `localStorage` after every change (key `scene-forge.scene.v2`), with
corruption recovery (the unreadable copy is kept and can be downloaded) and a visible message when
the browser refuses to store it. User presets are a separate list (`scene-forge.presets.v1`, at most
20).
