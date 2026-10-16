import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  TEMPLATE_IDS,
  buildTemplate,
  fnv1a32,
  fmt,
  mulberry32,
  parseSceneJson,
  progress,
  renderScene,
  serializeSvg,
  setLabel,
  moveBy,
  type Scene,
} from '../src/engine';
import { xmlProblem } from './xml';

const svg = (s: Scene, t?: number, animated?: boolean): string =>
  serializeSvg(
    renderScene(s, { ...(t === undefined ? {} : { t }), ...(animated ? { animated } : {}) }),
  );

const UPDATE = process.env['UPDATE_GOLDEN'] === '1';

describe('random and number format', () => {
  it('fnv1a32 and mulberry32 match known values', () => {
    // FNV-1a test vectors: "" -> 0x811c9dc5, "a" -> 0xe40c292c
    expect(fnv1a32('')).toBe(0x811c9dc5);
    expect(fnv1a32('a')).toBe(0xe40c292c);
    const r = mulberry32(1);
    const first = [r(), r(), r()];
    const r2 = mulberry32(1);
    expect([r2(), r2(), r2()]).toEqual(first);
    for (const v of first) expect(v >= 0 && v < 1).toBe(true);
  });
  it('fmt rounds to 2 decimals and never prints -0', () => {
    expect(fmt(1.005)).toBe('1');
    expect(fmt(-0.001)).toBe('0');
    expect(fmt(-0)).toBe('0');
    expect(fmt(12.3456)).toBe('12.35');
    expect(fmt(100)).toBe('100');
  });
});

describe('golden SVG per template (seed 7)', () => {
  for (const id of TEMPLATE_IDS) {
    it(`${id} matches tests/golden/${id}.svg`, () => {
      const out = svg(buildTemplate(id, { seed: 7 }));
      const file = new URL(`./golden/${id}.svg`, import.meta.url);
      if (UPDATE || !existsSync(file)) writeFileSync(file, out);
      expect(out).toBe(readFileSync(file, 'utf8'));
      expect(xmlProblem(out)).toBeNull();
    });
  }
});

describe('determinism and continuity', () => {
  it('same scene + seed gives the same SVG; another seed changes it', () => {
    const a = buildTemplate('siege', { seed: 42 });
    expect(svg(a)).toBe(svg(structuredClone(a)));
    expect(svg(a)).not.toBe(svg({ ...a, seed: 43 }));
  });
  it('JSON save and reopen gives identical geometry', () => {
    for (const id of TEMPLATE_IDS) {
      const s = buildTemplate(id, { seed: 99 });
      const reopened = parseSceneJson(JSON.stringify(s));
      expect(reopened.ok).toBe(true);
      if (reopened.ok) expect(svg(reopened.scene)).toBe(svg(s));
    }
  });
  it('editing one object never changes the strokes of another', () => {
    const s = buildTemplate('encirclement', { seed: 5 });
    const moved = moveBy(s, 'defender-1', 40, 0);
    const pathsOf = (scene: Scene, id: string) => {
      const m = new RegExp(
        `<g data-id="${id}"[^>]*>(.*?)</g></g>|<g data-id="${id}"[^>]*>(.*?)</g>`,
      ).exec(svg(scene));
      return m?.[0];
    };
    expect(pathsOf(moved, 'attacker-3')).toBe(pathsOf(s, 'attacker-3'));
    expect(pathsOf(moved, 'defender-1')).not.toBe(pathsOf(s, 'defender-1'));
  });
  it('the engine uses no trigonometry and no Math.random', () => {
    for (const f of [
      'render.ts',
      'shapes.ts',
      'templates.ts',
      'random.ts',
      'svg.ts',
      'qa.ts',
      'edit.ts',
    ]) {
      const raw = readFileSync(new URL(`../src/engine/${f}`, import.meta.url), 'utf8');
      const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(src).not.toMatch(/Math\.(sin|cos|tan|atan2?|random)\b/);
    }
  });
});

describe('export safety', () => {
  it('escapes markup, strips XML-invalid characters, and carries the not-a-map description', () => {
    let s = buildTemplate('timeline', { seed: 1 });
    s = setLabel(s, 'witness-1', { text: '<script>alert(1)</script> & "x" \'y\'' });
    s = { ...s, title: 'A <b>title</b>' };
    const out = svg(s);
    expect(out).not.toContain('<script>');
    expect(out).toContain(
      '&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot; &apos;y&apos;',
    );
    expect(out).toContain('Not a geographically accurate map.');
    expect(out).not.toMatch(/<(script|foreignObject|image|use)\b|\son[a-z]+=|href=/i);
    expect(xmlProblem(out)).toBeNull();
    const injected = {
      ...s,
      title: `bad${String.fromCharCode(0)}${String.fromCharCode(0xd800)}title`,
    };
    expect(xmlProblem(svg(injected))).toBeNull();
  });
  it('one-letter and 200-character labels render as valid XML', () => {
    let s = buildTemplate('retreat', { seed: 3 });
    s = setLabel(s, 'pursuer-1', { text: 'x' });
    s = setLabel(s, 'pursuer-2', { text: 'W'.repeat(200) });
    const out = svg(s);
    expect(out).toContain(`>${'W'.repeat(200)}<`);
    expect(xmlProblem(out)).toBeNull();
  });
});

describe('animation', () => {
  it('progress is 0 before start, 1 after end, eased between', () => {
    const a = { kind: 'move' as const, fromX: 0, fromY: 0, start: 0.2, end: 0.6 };
    expect(progress(a, 0)).toBe(0);
    expect(progress(a, 0.2)).toBe(0);
    expect(progress(a, 0.4)).toBeCloseTo(0.5);
    expect(progress(a, 1)).toBe(1);
    expect(progress({ kind: 'none' }, 0)).toBe(1);
  });
  it('t=1 equals the static render; t=0 differs for animated templates', () => {
    for (const id of TEMPLATE_IDS) {
      const s = buildTemplate(id, { seed: 2 });
      expect(svg(s, 1)).toBe(svg(s));
      expect(svg(s, 0)).not.toBe(svg(s));
    }
  });
  it('animated export wraps keyframes in prefers-reduced-motion: no-preference', () => {
    const out = svg(buildTemplate('retreat', { seed: 2 }), undefined, true);
    expect(out).toMatch(/<style>@media \(prefers-reduced-motion: no-preference\)\{@keyframes/);
    expect(out).toContain('class="sf-m-retreating-1"');
    expect(out).toContain('class="sf-d-withdrawal"');
    expect(xmlProblem(out)).toBeNull();
  });
});
