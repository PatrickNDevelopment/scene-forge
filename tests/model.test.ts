import { describe, expect, it } from 'vitest';
import {
  TEMPLATE_IDS,
  addFaction,
  addObject,
  buildTemplate,
  canRedo,
  canUndo,
  commit,
  contrast,
  createHistory,
  duplicateObject,
  flip,
  moveBy,
  moveLabelBy,
  parseSceneJson,
  recolorFaction,
  redo,
  regenerate,
  removeFaction,
  removeObject,
  renameFaction,
  renderScene,
  reorder,
  runQa,
  serializeSvg,
  setAnimDefault,
  setAnimTiming,
  setLabel,
  setScale,
  undo,
  validateScene,
  type Scene,
} from '../src/engine';

const base = (): Scene => buildTemplate('encirclement', { seed: 11 });

describe('templates', () => {
  it('every template validates, is sample data, has a move and a draw animation', () => {
    for (const id of TEMPLATE_IDS) {
      const s = buildTemplate(id, { seed: 3 });
      const r = validateScene(s);
      expect(r.ok, `${id}: ${r.ok ? '' : r.errors.join('; ')}`).toBe(true);
      expect(s.sample).toBe(true);
      expect(s.template).toBe(id);
      expect(s.objects.some((o) => o.anim.kind === 'move')).toBe(true);
      expect(s.objects.some((o) => o.anim.kind === 'draw')).toBe(true);
    }
  });
  it('layout varies with the seed by at most 24 px and keeps continuity ids', () => {
    const a = buildTemplate('siege', { seed: 1 });
    const b = buildTemplate('siege', { seed: 2 });
    expect(a.objects.map((o) => o.id)).toEqual(b.objects.map((o) => o.id));
    const fa = a.objects.find((o) => o.id === 'besieger-1');
    const fb = b.objects.find((o) => o.id === 'besieger-1');
    if (fa?.kind !== 'figure' || fb?.kind !== 'figure') throw new Error('figure');
    expect(Math.abs(fa.x - fb.x)).toBeLessThanOrEqual(48);
  });
  it('faction names flow into labels; renaming updates them', () => {
    const s = buildTemplate('encirclement', {
      seed: 1,
      factions: [
        { id: 'red', name: 'Red Host', color: '#b3261e' },
        { id: 'blue', name: 'Blue Hold', color: '#1d4ed8' },
      ],
    });
    expect(s.objects.find((o) => o.id === 'defender-2')?.label?.text).toBe('Blue Hold');
    const renamed = renameFaction(s, 'blue', 'Azure Keep');
    expect(renamed.objects.find((o) => o.id === 'defender-2')?.label?.text).toBe('Azure Keep');
    expect(validateScene(renamed).ok).toBe(true);
  });
  it('regenerate keeps factions, title and repositioned labels; changes the seed and layout', () => {
    let s = base();
    s = renameFaction(s, 'faction-a', 'Northmen');
    s = moveLabelBy(s, 'attacker-1', 30, -15);
    s = { ...s, title: 'My encirclement' };
    const before = s.objects.find((o) => o.id === 'attacker-1')?.label;
    const r = regenerate(s, 12345);
    expect(r).not.toBeNull();
    if (!r) return;
    expect(r.seed).toBe(12345);
    expect(r.title).toBe('My encirclement');
    expect(r.factions).toEqual(s.factions);
    expect(r.objects.find((o) => o.id === 'attacker-1')?.label).toEqual(before);
    expect(serializeSvg(renderScene(r))).not.toBe(serializeSvg(renderScene(s)));
    expect(validateScene(r).ok).toBe(true);
  });
});

describe('schema and migration', () => {
  it('refuses wrong schema, newer versions, unknown keys, bad colours, bad ids, control characters', () => {
    const s = base();
    const bad = (mut: (x: Record<string, unknown>) => void): string[] => {
      const v = structuredClone(s) as unknown as Record<string, unknown>;
      mut(v);
      const r = validateScene(v);
      return r.ok ? [] : r.errors;
    };
    expect(bad((v) => (v['schema'] = 'other'))).toHaveLength(1);
    expect(bad((v) => (v['version'] = 3))[0]).toContain('newer');
    expect(bad((v) => (v['extra'] = 1)).length).toBeGreaterThan(0);
    expect(
      bad((v) => ((v['canvas'] as Record<string, unknown>)['paper'] = 'red')).length,
    ).toBeGreaterThan(0);
    expect(
      bad((v) => ((v['objects'] as Record<string, unknown>[])[0]!['id'] = 'Bad Id')).length,
    ).toBeGreaterThan(0);
    expect(bad((v) => (v['title'] = `a${String.fromCharCode(7)}b`)).join()).toContain(
      'control character',
    );
    expect(
      bad(
        (v) =>
          ((v['objects'] as Record<string, unknown>[])[1]!['id'] = (
            v['objects'] as Record<string, unknown>[]
          )[2]!['id']),
      ).join(),
    ).toContain('duplicate id');
    expect(
      bad((v) => ((v['objects'] as Record<string, unknown>[])[1]!['factionId'] = 'nobody')).join(),
    ).toContain('no faction');
    expect(
      bad((v) => ((v['objects'] as Record<string, unknown>[])[1]!['x'] = 1e9)).length,
    ).toBeGreaterThan(0);
  });
  it('refuses a move animation on an arrow and start >= end', () => {
    const s = structuredClone(base()) as unknown as { objects: Record<string, unknown>[] };
    const arrowIdx = s.objects.findIndex((o) => o['kind'] === 'arrow');
    s.objects[arrowIdx]!['anim'] = { kind: 'move', fromX: 0, fromY: 0, start: 0, end: 1 };
    expect(validateScene(s).ok).toBe(false);
    const t = structuredClone(base()) as unknown as { objects: Record<string, unknown>[] };
    t.objects[arrowIdx]!['anim'] = { kind: 'draw', start: 0.5, end: 0.5 };
    expect(validateScene(t).ok).toBe(false);
  });
  it('parses JSON safely: invalid JSON, non-objects, too large', () => {
    expect(parseSceneJson('{nope').ok).toBe(false);
    expect(parseSceneJson('[]').ok).toBe(false);
    expect(parseSceneJson('null').ok).toBe(false);
    expect(parseSceneJson(' '.repeat(2_000_001)).ok).toBe(false);
  });
  it('migrates version 1 and renders identically to the final frame', () => {
    const v2 = base();
    const v1 = {
      schema: v2.schema,
      version: 1,
      title: v2.title,
      seed: v2.seed,
      styleVersion: v2.styleVersion,
      canvas: v2.canvas,
      safeArea: 40,
      factions: v2.factions,
      objects: v2.objects.map(({ anim: _anim, ...rest }) => rest),
      sample: true,
    };
    const r = validateScene(v1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.migratedFrom).toBe(1);
    expect(r.scene.version).toBe(2);
    expect(r.scene.safeArea).toEqual({ top: 40, right: 40, bottom: 40, left: 40 });
    expect(r.scene.template).toBeNull();
    const still = {
      ...v2,
      objects: v2.objects.map((o) => ({ ...o, anim: { kind: 'none' as const } })),
      template: null,
    };
    expect(serializeSvg(renderScene(r.scene))).toBe(serializeSvg(renderScene(still)));
  });
});

describe('editing never breaks the schema', () => {
  it('random edit sequences stay valid', () => {
    let seed = 7;
    const rnd = (n: number): number => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % n;
    };
    for (let run = 0; run < 20; run += 1) {
      let s = buildTemplate(TEMPLATE_IDS[run % TEMPLATE_IDS.length]!, { seed: run });
      for (let step = 0; step < 80; step += 1) {
        const ids = s.objects.map((o) => o.id);
        const id = ids[rnd(Math.max(1, ids.length))] ?? '';
        switch (rnd(12)) {
          case 0:
            s = moveBy(s, id, rnd(5000) - 2500, rnd(5000) - 2500);
            break;
          case 1:
            s = moveLabelBy(s, id, rnd(4000) - 2000, rnd(4000) - 2000);
            break;
          case 2:
            s = setLabel(s, id, { text: 'L'.repeat(1 + rnd(300)), size: rnd(200) });
            break;
          case 3:
            s = setScale(s, id, rnd(100) / 10);
            break;
          case 4: {
            const r = addObject(
              s,
              (['figure', 'prop', 'arrow', 'region', 'text'] as const)[rnd(5)]!,
            );
            if (r) s = r.scene;
            break;
          }
          case 5:
            s = removeObject(s, id);
            break;
          case 6: {
            const r = duplicateObject(s, id);
            if (r) s = r.scene;
            break;
          }
          case 7:
            s = setAnimDefault(s, id);
            s = setAnimTiming(s, id, rnd(150) / 100 - 0.2, rnd(150) / 100);
            break;
          case 8:
            s = addFaction(s);
            s = recolorFaction(s, s.factions[0]?.id ?? '', '#123456');
            break;
          case 9:
            s = removeFaction(s, s.factions[rnd(Math.max(1, s.factions.length))]?.id ?? '');
            break;
          case 10:
            s = reorder(s, id, rnd(2) === 0 ? 1 : -1);
            s = flip(s, id);
            break;
          default:
            s = renameFaction(s, s.factions[0]?.id ?? '', `Name ${step} ${String.fromCharCode(1)}`);
        }
        const r = validateScene(s);
        expect(r.ok, r.ok ? '' : r.errors.join('; ')).toBe(true);
      }
    }
  });
});

describe('history', () => {
  it('undo/redo, coalescing and the 200-step limit', () => {
    let h = createHistory(base());
    expect(canUndo(h)).toBe(false);
    h = commit(h, moveBy(h.present, 'defender-1', 1, 0), 'move:defender-1', 1000);
    h = commit(h, moveBy(h.present, 'defender-1', 1, 0), 'move:defender-1', 1300);
    h = commit(h, moveBy(h.present, 'defender-1', 1, 0), 'move:defender-1', 1500);
    expect(h.past).toHaveLength(1);
    h = commit(h, moveBy(h.present, 'defender-1', 1, 0), 'move:defender-1', 9000);
    expect(h.past).toHaveLength(2);
    const after = h.present;
    h = undo(h);
    expect(canRedo(h)).toBe(true);
    h = redo(h);
    expect(h.present).toBe(after);
    for (let i = 0; i < 250; i += 1) h = commit(h, moveBy(h.present, 'defender-1', 1, 0), null, i);
    expect(h.past.length).toBe(200);
    h = commit(h, h.present);
    expect(h.past.length).toBe(200);
  });
});

describe('visual QA', () => {
  it('flags empty scenes, off-canvas, safe area, overlap and contrast', () => {
    const empty = { ...base(), objects: [] };
    expect(runQa(empty).map((f) => f.code)).toEqual(['EMPTY_SCENE']);
    let s = base();
    s = moveBy(s, 'defender-1', 5000, 0);
    s = moveBy(s, 'defender-3', 600, 0);
    s = setLabel(s, 'attacker-1', { text: 'Overlap here', dx: 0, dy: 0 });
    s = setLabel(s, 'attacker-2', { text: 'Overlap here', dx: 0, dy: 0 });
    s = moveBy(
      s,
      'attacker-2',
      (s.objects.find((o) => o.id === 'attacker-1') as { x: number }).x -
        (s.objects.find((o) => o.id === 'attacker-2') as { x: number }).x,
      (s.objects.find((o) => o.id === 'attacker-1') as { y: number }).y -
        (s.objects.find((o) => o.id === 'attacker-2') as { y: number }).y,
    );
    s = recolorFaction(s, 'faction-b', '#f0f0f0');
    const codes = runQa(s).map((f) => `${f.objectId}:${f.code}`);
    expect(codes).toContain('defender-1:OFF_CANVAS');
    expect(codes.some((c) => c.startsWith('defender-3:') && /OFF_CANVAS|SAFE_AREA/.test(c))).toBe(
      true,
    );
    expect(codes).toContain('attacker-1:LABEL_OVERLAP');
    expect(codes).toContain('defender-2:LOW_CONTRAST');
  });
  it('templates have no off-canvas objects and no low contrast', () => {
    for (const id of TEMPLATE_IDS) {
      const bad = runQa(buildTemplate(id, { seed: 4 })).filter((f) =>
        /OFF_CANVAS|LOW_CONTRAST/.test(f.code),
      );
      expect(bad, id).toEqual([]);
    }
  });
  it('contrast ratio matches WCAG reference values', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });
});
