/**
 * Regression tests for defects found in the independent acceptance review (docs/test-report.md,
 * Part 1). Each test failed before its fix.
 */
import { describe, expect, it } from 'vitest';
import {
  buildTemplate,
  duplicateObject,
  regenerate,
  removeFaction,
  renameFaction,
  renderScene,
  serializeSvg,
  setDashed,
  validateScene,
  type Scene,
} from '../src/engine';
import { xmlProblem } from './xml';

const svg = (s: Scene, t?: number, animated = false): string =>
  serializeSvg(renderScene(s, { ...(t === undefined ? {} : { t }), animated }));
const group = (out: string, id: string): string =>
  new RegExp(`<g data-id="${id}".*?</g>`).exec(out)?.[0] ?? '';
const labelsOf = (s: Scene): string[] => s.objects.flatMap((o) => (o.label ? [o.label.text] : []));

describe('dashed arrows with a draw animation keep their dashes', () => {
  it('the final frame and the static export are dashed (they were solid)', () => {
    const s = buildTemplate('retreat', { seed: 7 });
    const g = group(svg(s), 'withdrawal');
    expect(g).toContain('stroke-dasharray="16 12"');
    expect(g).not.toContain('pathLength');
    // the Dashed toggle changes the drawing
    expect(svg(setDashed(s, 'withdrawal', false))).not.toBe(svg(s));
  });
  it('fades in during the animation instead of drawing on; the head fades with it', () => {
    const s = buildTemplate('retreat', { seed: 7 });
    // withdrawal: draw 0.1 to 0.7; at t = 0.4 progress is 0.5, eased 0.5
    const mid = group(svg(s, 0.4), 'withdrawal');
    expect(mid).toContain('stroke-opacity="0.5"');
    expect(mid).toContain('stroke-opacity="0.28"'); // second pass: 0.55 * 0.5, rounded
    expect(mid).toContain('stroke-dasharray="16 12"');
    expect(group(svg(s, 0), 'withdrawal')).toContain('stroke-opacity="0"');
  });
  it('the animated export fades dashed arrows and stays valid; reduced motion sees dashes', () => {
    const out = svg(buildTemplate('trade-route', { seed: 2 }), undefined, true);
    expect(out).toMatch(/@keyframes sf-f-[a-z0-9-]+\{from\{opacity:0\}to\{opacity:1\}\}/);
    expect(out).toContain('stroke-dasharray="16 12"');
    expect(xmlProblem(out)).toBeNull();
  });
  it('solid arrows still draw on', () => {
    const g = group(svg(buildTemplate('retreat', { seed: 7 }), 0.6), 'pursuit');
    expect(g).toContain('pathLength="100"');
  });
});

describe('renaming a faction while typing never corrupts labels', () => {
  it('typing r, re, red from the focused base gives clean labels (was "tredade redoute")', () => {
    const base = buildTemplate('trade-route', { seed: 1 });
    let s = base;
    for (const v of ['r', 're', 'red']) s = renameFaction(s, 'faction-a', v, base);
    expect(labelsOf(s)).toEqual(['red market', 'Faction B port', 'trade route']);
    expect(s.factions.find((f) => f.id === 'faction-a')?.name).toBe('red');
    // typing the old name back restores the labels exactly
    s = renameFaction(s, 'faction-a', 'Faction A', base);
    expect(labelsOf(s)).toEqual(labelsOf(base));
  });
});

describe('regenerate after removing every faction', () => {
  it('gives a valid scene (it referenced deleted factions)', () => {
    let s = buildTemplate('encirclement', { seed: 1 });
    for (const f of [...s.factions]) s = removeFaction(s, f.id);
    const r = regenerate(s, 5);
    expect(r).not.toBeNull();
    if (!r) return;
    expect(validateScene(r)).toMatchObject({ ok: true });
    expect(r.objects.every((o) => o.factionId === null)).toBe(true);
  });
});

describe('duplicating objects with long ids terminates', () => {
  it('a 32-character id duplicates to a fresh valid id (it looped forever)', () => {
    const base = buildTemplate('timeline', { seed: 1 });
    const long = 'a'.repeat(32);
    let s: Scene = {
      ...base,
      objects: base.objects.map((o, i) => (i === 0 ? { ...o, id: long } : o)),
    };
    for (let k = 0; k < 12; k += 1) {
      const r = duplicateObject(s, long);
      expect(r).not.toBeNull();
      if (!r) return;
      expect(r.id.length).toBeLessThanOrEqual(32);
      s = r.scene;
    }
    expect(validateScene(s).ok).toBe(true);
  });
});
