/** Seeded randomness (docs/spec/01-rendering.md). Never use Math.random in the engine. */

/** FNV-1a 32-bit hash of the UTF-16 code units of `text`. */
export function fnv1a32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32: a small, well-known 32-bit PRNG. Returns numbers in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stream for one stroke of one object. */
export function strokeRng(seed: number, styleVersion: number, objectId: string, stroke: number) {
  return mulberry32(fnv1a32(`${seed}:${styleVersion}:${objectId}:${stroke}`));
}

/** A stream for template layout variation of one object. */
export function layoutRng(seed: number, objectId: string) {
  return mulberry32(fnv1a32(`layout:${seed}:${objectId}`));
}

/** Uniform in [-1, 1). */
export function signed(rng: () => number): number {
  return rng() * 2 - 1;
}
