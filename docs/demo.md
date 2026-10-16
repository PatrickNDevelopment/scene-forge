# Demo walkthroughs

Run `npm run dev` and open http://localhost:5175/scene-forge/.

## Journey 1: template, factions, seed, labels, export

1. Gallery: "Use Encirclement".
2. With nothing selected, the inspector shows the scene: rename the factions and change a colour.
   Labels that showed the old name follow.
3. "Regenerate layout": enter a seed, press Regenerate. Positions and strokes change; factions and the
   title stay.
4. Pick `attacker-1` in the object list, focus the canvas (Tab) and press Alt+arrows to move its label,
   or drag the label with the mouse, or type the offsets in the inspector.
5. "Export SVG": a vector file that opens in any SVG editor, with one group per object (`data-id`).

## Journey 2: save, refresh, reopen

1. "Save JSON".
2. Refresh the page: the scene is restored from this browser.
3. Open a fresh browser profile (or clear site data), "Open JSON", choose the file: the export is
   byte-for-byte identical to the one before.

## Things to try

- Drag the time slider, or press Play (disabled when your system asks for reduced motion).
- Move an object off the canvas and watch Visual QA.
- Ctrl+Z / Ctrl+Y.
- Save as preset, then reopen it from the Gallery.
