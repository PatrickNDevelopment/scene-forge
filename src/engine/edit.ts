/**
 * Pure editing operations: (scene, ...) -> scene. The input is never mutated. Values are clamped to
 * the schema ranges so an edit can never produce a scene that fails validation.
 */
import { cleanText } from './schema';
import {
  LIMITS,
  isPointObject,
  type Faction,
  type LabelSpec,
  type Point,
  type Pose,
  type PropKind,
  type Scene,
  type SceneObject,
} from './types';

const clamp = (v: number, lo: number, hi: number): number =>
  Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;
const coord = (v: number): number =>
  Math.round(clamp(v, LIMITS.coordMin, LIMITS.coordMax) * 100) / 100;

function mapObject(scene: Scene, id: string, fn: (o: SceneObject) => SceneObject): Scene {
  let found = false;
  const objects = scene.objects.map((o) => {
    if (o.id !== id) return o;
    found = true;
    return fn(o);
  });
  return found ? { ...scene, objects } : scene;
}

/** Moves an object by (dx, dy); for arrows and regions every point moves. Move-animation origins follow. */
export function moveBy(scene: Scene, id: string, dx: number, dy: number): Scene {
  return mapObject(scene, id, (o) => {
    if (isPointObject(o)) {
      const anim =
        o.anim.kind === 'move'
          ? { ...o.anim, fromX: coord(o.anim.fromX + dx), fromY: coord(o.anim.fromY + dy) }
          : o.anim;
      return { ...o, x: coord(o.x + dx), y: coord(o.y + dy), anim } as SceneObject;
    }
    return { ...o, points: o.points.map(([x, y]) => [coord(x + dx), coord(y + dy)] as Point) };
  });
}

export function moveTo(scene: Scene, id: string, x: number, y: number): Scene {
  const o = scene.objects.find((v) => v.id === id);
  if (!o) return scene;
  const [ax, ay] = isPointObject(o) ? [o.x, o.y] : (o.points[0] as Point);
  return moveBy(scene, id, x - ax, y - ay);
}

export function moveLabelBy(scene: Scene, id: string, dx: number, dy: number): Scene {
  return mapObject(scene, id, (o) =>
    o.label === null
      ? o
      : {
          ...o,
          label: {
            ...o.label,
            dx: clamp(Math.round(o.label.dx + dx), -2000, 2000),
            dy: clamp(Math.round(o.label.dy + dy), -2000, 2000),
          },
        },
  );
}

export function setLabel(scene: Scene, id: string, label: Partial<LabelSpec> | null): Scene {
  return mapObject(scene, id, (o) => {
    if (label === null) return { ...o, label: null };
    const cur: LabelSpec = o.label ?? { text: 'Label', dx: 0, dy: -110, size: 22 };
    const text = label.text === undefined ? cur.text : cleanText(label.text).slice(0, 400);
    const trimmed = Array.from(text).slice(0, LIMITS.textMax).join('');
    if (trimmed.trim() === '') return o; // an empty label is removed explicitly, never by typing
    return {
      ...o,
      label: {
        text: trimmed,
        dx: clamp(Math.round(label.dx ?? cur.dx), -2000, 2000),
        dy: clamp(Math.round(label.dy ?? cur.dy), -2000, 2000),
        size: clamp(Math.round(label.size ?? cur.size), 10, 64),
      },
    };
  });
}

export function setText(scene: Scene, id: string, value: string): Scene {
  const text = Array.from(cleanText(value)).slice(0, LIMITS.textMax).join('');
  if (text.trim() === '') return scene;
  return mapObject(scene, id, (o) => (o.kind === 'text' ? { ...o, text } : o));
}

export function setScale(scene: Scene, id: string, scale: number): Scene {
  return mapObject(scene, id, (o) =>
    o.kind === 'figure' || o.kind === 'prop'
      ? { ...o, scale: Math.round(clamp(scale, 0.25, 4) * 100) / 100 }
      : o,
  );
}

export function setSize(scene: Scene, id: string, size: number): Scene {
  return mapObject(scene, id, (o) =>
    o.kind === 'text' ? { ...o, size: Math.round(clamp(size, 10, 96)) } : o,
  );
}

export function setWidth(scene: Scene, id: string, width: number): Scene {
  return mapObject(scene, id, (o) =>
    o.kind === 'arrow' ? { ...o, width: Math.round(clamp(width, 1, 12)) } : o,
  );
}

export function setDashed(scene: Scene, id: string, dashed: boolean): Scene {
  return mapObject(scene, id, (o) => (o.kind === 'arrow' ? { ...o, dashed } : o));
}

export function setPose(scene: Scene, id: string, pose: Pose): Scene {
  return mapObject(scene, id, (o) => (o.kind === 'figure' ? { ...o, pose } : o));
}

export function flip(scene: Scene, id: string): Scene {
  return mapObject(scene, id, (o) =>
    o.kind === 'figure' ? { ...o, facing: o.facing === 1 ? -1 : 1 } : o,
  );
}

export function setProp(scene: Scene, id: string, prop: PropKind): Scene {
  return mapObject(scene, id, (o) => (o.kind === 'prop' ? { ...o, prop } : o));
}

export function setFaction(scene: Scene, id: string, factionId: string | null): Scene {
  if (factionId !== null && !scene.factions.some((f) => f.id === factionId)) return scene;
  return mapObject(scene, id, (o) => ({ ...o, factionId }));
}

export function setAnimNone(scene: Scene, id: string): Scene {
  return mapObject(scene, id, (o) => ({ ...o, anim: { kind: 'none' } }) as SceneObject);
}

/** Adds a default animation suitable for the object kind. */
export function setAnimDefault(scene: Scene, id: string): Scene {
  return mapObject(scene, id, (o) => {
    if (isPointObject(o))
      return {
        ...o,
        anim: { kind: 'move', fromX: coord(o.x - 200), fromY: o.y, start: 0, end: 0.6 },
      } as SceneObject;
    return { ...o, anim: { kind: 'draw', start: 0, end: 0.6 } } as SceneObject;
  });
}

export function setAnimTiming(scene: Scene, id: string, start: number, end: number): Scene {
  const s = Math.round(clamp(start, 0, 0.95) * 100) / 100;
  const e = Math.round(clamp(end, s + 0.05, 1) * 100) / 100;
  return mapObject(scene, id, (o) =>
    o.anim.kind === 'none' ? o : ({ ...o, anim: { ...o.anim, start: s, end: e } } as SceneObject),
  );
}

/** A fresh id with the given prefix, unique among objects (continuity ids are never reused). */
export function freshId(scene: Scene, prefix: string): string {
  const taken = new Set(scene.objects.map((o) => o.id));
  for (let n = 1; ; n += 1) {
    // Shorten the prefix, never the number: truncating the whole candidate made it repeat
    // forever for long ids (duplicating a 32-character id hung the page).
    const suffix = `-${n}`;
    const candidate = `${prefix.slice(0, 32 - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export type NewKind = 'figure' | 'prop' | 'arrow' | 'region' | 'text';

export function addObject(scene: Scene, kind: NewKind): { scene: Scene; id: string } | null {
  if (scene.objects.length >= LIMITS.objects) return null;
  const cx = Math.round(scene.canvas.width / 2);
  const cy = Math.round(scene.canvas.height / 2);
  const id = freshId(scene, kind);
  const base = { id, factionId: null, label: null, anim: { kind: 'none' as const } };
  const obj: SceneObject =
    kind === 'figure'
      ? { ...base, kind, x: cx, y: cy + 50, scale: 1, pose: 'stand', facing: 1 }
      : kind === 'prop'
        ? { ...base, kind, x: cx, y: cy + 40, scale: 1, prop: 'flag' }
        : kind === 'arrow'
          ? {
              ...base,
              kind,
              points: [
                [cx - 120, cy],
                [cx + 120, cy],
              ],
              width: 4,
              dashed: false,
            }
          : kind === 'region'
            ? {
                ...base,
                kind,
                points: [
                  [cx - 100, cy - 60],
                  [cx + 100, cy - 60],
                  [cx + 100, cy + 60],
                  [cx - 100, cy + 60],
                ],
              }
            : { ...base, kind, x: cx, y: cy, text: 'Text', size: 32 };
  return { scene: { ...scene, objects: [...scene.objects, obj] }, id };
}

export function removeObject(scene: Scene, id: string): Scene {
  return { ...scene, objects: scene.objects.filter((o) => o.id !== id) };
}

export function duplicateObject(scene: Scene, id: string): { scene: Scene; id: string } | null {
  const o = scene.objects.find((v) => v.id === id);
  if (!o || scene.objects.length >= LIMITS.objects) return null;
  const prefix = o.id.replace(/-\d+$/, '') || o.kind;
  const newId = freshId(scene, prefix);
  const copy = { ...structuredClone(o), id: newId };
  const moved = moveBy({ ...scene, objects: [...scene.objects, copy] }, newId, 30, 30);
  return { scene: moved, id: newId };
}

/** Moves an object one step forward (+1) or backward (-1) in drawing order. */
export function reorder(scene: Scene, id: string, dir: 1 | -1): Scene {
  const i = scene.objects.findIndex((o) => o.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= scene.objects.length) return scene;
  const objects = [...scene.objects];
  [objects[i], objects[j]] = [objects[j] as SceneObject, objects[i] as SceneObject];
  return { ...scene, objects };
}

/**
 * Renames a faction and updates every label or text that contained the old name.
 *
 * `base` is the scene as it was when the user started typing the name (defaults to `scene`). Label
 * and text replacements are computed from `base`, never from the intermediate names typed so far:
 * replacing per keystroke would otherwise replace every later occurrence of a short intermediate
 * name (typing "red" turned "trade route" into "tredade redoute").
 */
export function renameFaction(
  scene: Scene,
  factionId: string,
  rawName: string,
  base: Scene = scene,
): Scene {
  const cur = scene.factions.find((x) => x.id === factionId);
  const orig = base.factions.find((x) => x.id === factionId) ?? cur;
  const name = Array.from(cleanText(rawName)).slice(0, LIMITS.factionNameMax).join('');
  if (!cur || !orig || name.trim() === '' || name === cur.name) return scene;
  const old = orig.name;
  const swap = (t: string): string =>
    old !== '' && t.includes(old)
      ? Array.from(t.split(old).join(name)).slice(0, LIMITS.textMax).join('')
      : t;
  const from = new Map(base.objects.map((o) => [o.id, o]));
  return {
    ...scene,
    factions: scene.factions.map((x) => (x.id === factionId ? { ...x, name } : x)),
    objects: scene.objects.map((o) => {
      const b = from.get(o.id);
      if (b === undefined) return o;
      const label =
        o.label === null
          ? null
          : b.label !== null && b.label.text.includes(old)
            ? { ...o.label, text: swap(b.label.text) }
            : o.label;
      if (o.kind === 'text' && b.kind === 'text' && b.text.includes(old)) {
        return { ...o, label, text: swap(b.text) };
      }
      return { ...o, label };
    }),
  };
}

export function recolorFaction(scene: Scene, factionId: string, color: string): Scene {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return scene;
  return {
    ...scene,
    factions: scene.factions.map((x) =>
      x.id === factionId ? { ...x, color: color.toLowerCase() } : x,
    ),
  };
}

export function addFaction(scene: Scene): Scene {
  if (scene.factions.length >= LIMITS.factions) return scene;
  const taken = new Set(scene.factions.map((f) => f.id));
  let n = scene.factions.length + 1;
  while (taken.has(`faction-${n}`)) n += 1;
  const palette = [
    '#b3261e',
    '#1d4ed8',
    '#15803d',
    '#7e22ce',
    '#a16207',
    '#0f766e',
    '#be185d',
    '#374151',
  ];
  const f: Faction = {
    id: `faction-${n}`,
    name: `Faction ${n}`,
    color: palette[scene.factions.length % palette.length] ?? '#374151',
  };
  return { ...scene, factions: [...scene.factions, f] };
}

/** Removes a faction; its objects fall back to the ink colour (factionId null). */
export function removeFaction(scene: Scene, factionId: string): Scene {
  return {
    ...scene,
    factions: scene.factions.filter((f) => f.id !== factionId),
    objects: scene.objects.map((o) => (o.factionId === factionId ? { ...o, factionId: null } : o)),
  };
}

export function setTitle(scene: Scene, raw: string): Scene {
  const title = Array.from(cleanText(raw)).slice(0, LIMITS.titleMax).join('');
  return title.trim() === '' ? scene : { ...scene, title };
}

export function setSeed(scene: Scene, seed: number): Scene {
  if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) return scene;
  return { ...scene, seed };
}

export function setDuration(scene: Scene, ms: number): Scene {
  return { ...scene, animation: { durationMs: Math.round(clamp(ms, 500, 20000)) } };
}
