# Architecture and decisions

Specification first: [spec/00-scene-format.md](spec/00-scene-format.md),
[spec/01-rendering.md](spec/01-rendering.md), [spec/02-editor-and-qa.md](spec/02-editor-and-qa.md).

## Shape

Browser only (Vite, React, TypeScript, zod). No backend: nothing here needs a server.

```
scene JSON --validate/migrate--> Scene --renderScene(t)--> SvgNode tree --serializeSvg--> export
                                   ^                            |
             pure edit functions --+                            +--toReact--> canvas (same tree)
```

## Decisions

1. **One model, one renderer.** The canvas and the export are produced from the same SvgNode tree,
   so what you see is what you export. The canvas converts the tree to React elements (no
   `innerHTML`), so scene text can never become markup.
2. **Determinism by construction.** Seeded PRNG streams keyed by `seed:styleVersion:objectId:stroke`;
   no `Math.random`, no time; no trigonometry (constant tables, `sqrt` only, which IEEE 754 defines
   exactly); coordinates rounded to 2 decimals; fixed attribute order. A unit test forbids
   `Math.sin`/`cos`/`random` in the engine. Golden SVG files per template pin the output; they change
   only through `npm run golden:update`.
3. **Continuity ids.** Jitter depends on the object id, never on list position, so editing,
   reordering or deleting one object leaves every other stroke identical, and regenerating a template
   keeps object identity (and the labels you moved).
4. **Strict import.** zod schemas with unknown keys rejected, plus cross rules (unique ids, faction
   references, the text rule against control characters). Version 1 is migrated explicitly; newer
   versions are refused with a message.
5. **Edits are pure and clamped.** Every edit is `(scene) -> scene` and clamps to schema ranges; a
   randomized test applies thousands of edits and validates after each.
6. **History is a list of immutable scenes** with coalescing keys, so a drag is one undo step.
7. **Animation is a function of time.** `renderScene(scene, { t })` gives any frame; preview and
   tests use it. The animated export uses CSS keyframes guarded by `prefers-reduced-motion`.
8. **Visual QA is advisory** and deterministic; text extents are estimates because fonts differ.
9. **Static hosting**: hash routing and `base: /scene-forge/`.

## Ports

| Port | Use                      |
| ---- | ------------------------ |
| 5175 | Vite dev server          |
| 4176 | Production preview (e2e) |
