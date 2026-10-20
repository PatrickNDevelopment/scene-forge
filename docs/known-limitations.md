# Known limitations

- **Published 2026-10-19.** CI (Linux, Chromium) and the Pages deploy were green on the first run.
- **Illustrations, not maps.** Templates and scenes are diagrams with invented names. Nothing is
  geographically accurate, and SceneForge never claims otherwise.
- **Fonts vary.** Text uses the viewer's hand-writing font (Segoe Print, Comic Sans MS, Comic Neue,
  then any cursive font). Geometry is identical everywhere; text width and therefore the look of
  labels differ between machines. Visual QA estimates label boxes (characters x size x 0.56).
- **No arbitrary point editing** for arrows and regions in v0.1: they move as a whole. New arrows and
  regions start from a default shape.
- **Renaming a faction** replaces its old name wherever it appears in label and text objects, also
  inside longer words (renaming "A" would touch "Alliance"). Undo restores the previous text.
- **Animations** are limited to movement and draw-on with an ease-in-out curve; a dashed arrow
  with a draw animation fades in instead of drawing on (a dash pattern and a draw-on offset cannot
  share one dash array). The animated export
  uses CSS keyframes; some SVG editors ignore CSS animation and show the final frame.
- **Storage**: the current scene and up to 20 presets live in this browser's `localStorage` (about
  5 MB). A full store shows a banner; save the scene as JSON.
- **Accessibility**: keyboard control, labelled controls, focus outlines, reduced motion and a
  320 px layout are tested. There has been no screen-reader session and no 200% zoom audit. The
  canvas drawing itself is an image with a text alternative (the scene title); the object list is the
  accessible way to reach objects.
- **Browsers**: tested in Microsoft Edge (Chromium) locally and Chromium in CI. Firefox and Safari are
  untested.
- **Platforms**: developed and verified on Windows 10 with Node 24. CI targets Linux (not run on a
  remote yet); the golden SVGs are expected to match there because the engine uses no
  platform-dependent maths.
