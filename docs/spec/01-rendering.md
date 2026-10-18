# Spec 01: deterministic rendering and export

## Contract

`renderScene(scene, t = 1)` returns an SVG node tree; `serializeSvg(tree)` returns a string.
For the same scene JSON, the same `styleVersion` and the same `seed`, the string is identical on every
run, browser and machine. The editor canvas is drawn from the same tree, so what you see is what you
export. Nothing is rasterized.

How determinism is achieved:

1. **Seeded randomness only.** No `Math.random`, no time, no locale. Every stroke uses
   `mulberry32(fnv1a32(seed + ":" + styleVersion + ":" + objectId + ":" + strokeIndex))`.
2. **No trigonometry.** Poses, the head circle and directions are constant tables or come from
   `+ - * /` and `Math.sqrt`, which IEEE 754 defines exactly. (`Math.sin` and friends are not exactly
   specified and could differ between engines.)
3. **Fixed number format.** Every coordinate is rounded to 2 decimals (`Math.round(v * 100) / 100`),
   `-0` is written `0`, and numbers are printed with JavaScript's shortest round-trip form.
4. **Fixed attribute order** and no whitespace variation.

## Hand-drawn style (styleVersion 1)

A stroke through points `p0 ... pn` is drawn twice (two passes with different jitter streams). Each
point is displaced by up to `j = 1.6 * w` pixels in x and y (w = stroke width), and each segment is a
quadratic curve whose control point is the segment middle displaced by up to `j`. The second pass has
opacity 0.55. Figures have a 12-point head outline from a constant unit-circle table.

## Figures

Joint tables per pose (head centre, neck, hip, hands, feet) in a 100-unit tall frame, mirrored by
`facing`, scaled by `scale`, anchored at the feet midpoint `(x, y)`. Colour: the faction colour, or the
canvas ink when the figure has no faction.

## Arrows and regions

Arrows: the hand-drawn polyline plus a head (two strokes) at the last point, the head direction
computed from the last segment with `sqrt` normalisation. Dashed arrows use `stroke-dasharray`.
Regions: a closed hand-drawn outline filled with the faction colour at opacity 0.18.

## Labels and text

Rendered as SVG `<text>` with the text content XML-escaped (`& < > " '`). A label is placed at its
anchor plus `(dx, dy)`, centred, with a paper-coloured halo (`paint-order: stroke`) so it stays legible
on strokes.

## Animation

At time `t` (0 to 1): for `move`, progress `p = clamp((t - start) / (end - start))`, eased with
`p * p * (3 - 2 * p)`, and the object is drawn at `from + (to - from) * eased`. For `draw`, the path
carries `pathLength="100"`, `stroke-dasharray="100"` and `stroke-dashoffset = 100 * (1 - eased)`, so no
path length has to be measured (the arrow head appears when the shaft is complete). A **dashed**
arrow cannot also use the dash array for drawing on, so a dashed arrow with a `draw` animation fades
in instead: its strokes (shaft and head) carry `stroke-opacity = eased` (the second pass
`0.55 * eased`) and keep their dash pattern; when complete the attribute is omitted. Before its
start an animated object is drawn at its starting state. `t = 1` is the final scene, which is also
the static export.

**Animated export** (optional) writes CSS `@keyframes` inside the SVG `<style>` and wraps them in
`@media (prefers-reduced-motion: no-preference)`, so a viewer that asks for reduced motion sees the
final state. Draw-on uses `sf-d-<id>` (dash offset), dashed arrows `sf-f-<id>` (opacity) and moves
`sf-m-<id>` (transform).

## Export

`<svg xmlns viewBox width height>` with `<title>`, a `<desc>` saying "Illustrative diagram made with
SceneForge. Not a geographically accurate map.", a paper rectangle and one `<g>` per object with
`data-id` (the continuity id). No scripts, no event attributes, no external references, no
`foreignObject`. The export is valid XML.
