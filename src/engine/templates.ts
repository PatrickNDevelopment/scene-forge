/**
 * The eight templates (docs/spec/02-editor-and-qa.md). Layouts are fixed and varied per object by a
 * seeded offset of up to 24 px; continuity ids are fixed so regeneration keeps object identity.
 * All names are invented placeholders; no template depicts a real place or event.
 */
import { layoutRng, signed } from './random';
import {
  SCHEMA,
  STYLE_VERSION,
  VERSION,
  type Anim,
  type Arrow,
  type Faction,
  type Figure,
  type LabelSpec,
  type Point,
  type Pose,
  type Prop,
  type PropKind,
  type Region,
  type Scene,
  type SceneObject,
  type TemplateId,
  type TextObject,
} from './types';

export const DEFAULT_FACTIONS: Faction[] = [
  { id: 'faction-a', name: 'Faction A', color: '#b3261e' },
  { id: 'faction-b', name: 'Faction B', color: '#1d4ed8' },
  { id: 'faction-c', name: 'Faction C', color: '#15803d' },
];

export const TEMPLATE_INFO: Record<TemplateId, { title: string; summary: string }> = {
  encirclement: { title: 'Encirclement', summary: 'One side surrounds the other.' },
  retreat: { title: 'Retreat', summary: 'One side withdraws while the other follows.' },
  siege: { title: 'Siege', summary: 'A fortified position under siege.' },
  'trade-route': { title: 'Trade route', summary: 'Goods travel between two markets.' },
  'supply-line': { title: 'Supply line', summary: 'A depot supplies a distant front.' },
  'alliance-formation': { title: 'Alliance formation', summary: 'Two sides join together.' },
  'alliance-collapse': { title: 'Alliance collapse', summary: 'A joint group breaks apart.' },
  timeline: { title: 'Timeline', summary: 'Five stages in order.' },
};

const W = 1280;
const H = 720;
/** Eight compass directions, no trigonometry (0.70710678 = sqrt(2) / 2). */
const D8: readonly Point[] = [
  [1, 0],
  [0.70710678, 0.70710678],
  [0, 1],
  [-0.70710678, 0.70710678],
  [-1, 0],
  [-0.70710678, -0.70710678],
  [0, -1],
  [0.70710678, -0.70710678],
];

interface Ctx {
  seed: number;
  a: string;
  b: string;
  c: string;
  names: Record<string, string>;
}

function off(ctx: Ctx, id: string): Point {
  const rng = layoutRng(ctx.seed, id);
  return [Math.round(signed(rng) * 24), Math.round(signed(rng) * 24)];
}

const NONE: Anim = { kind: 'none' };
const lbl = (text: string, dx: number, dy: number, size = 22): LabelSpec => ({
  text,
  dx,
  dy,
  size,
});

function fig(
  ctx: Ctx,
  id: string,
  x: number,
  y: number,
  factionId: string | null,
  pose: Pose,
  facing: 1 | -1,
  extra: { label?: LabelSpec; anim?: Anim; scale?: number } = {},
): Figure {
  const [ox, oy] = off(ctx, id);
  const anim =
    extra.anim?.kind === 'move'
      ? { ...extra.anim, fromX: extra.anim.fromX + ox, fromY: extra.anim.fromY + oy }
      : (extra.anim ?? NONE);
  return {
    id,
    kind: 'figure',
    x: x + ox,
    y: y + oy,
    scale: extra.scale ?? 1,
    pose,
    facing,
    factionId,
    label: extra.label ?? null,
    anim,
  };
}

function prop(
  ctx: Ctx,
  id: string,
  x: number,
  y: number,
  kind: PropKind,
  factionId: string | null,
  extra: { label?: LabelSpec; anim?: Anim; scale?: number } = {},
): Prop {
  const [ox, oy] = off(ctx, id);
  const anim =
    extra.anim?.kind === 'move'
      ? { ...extra.anim, fromX: extra.anim.fromX + ox, fromY: extra.anim.fromY + oy }
      : (extra.anim ?? NONE);
  return {
    id,
    kind: 'prop',
    x: x + ox,
    y: y + oy,
    scale: extra.scale ?? 1,
    prop: kind,
    factionId,
    label: extra.label ?? null,
    anim,
  };
}

function arrow(
  ctx: Ctx,
  id: string,
  points: Point[],
  factionId: string | null,
  extra: { label?: LabelSpec; draw?: [number, number]; width?: number; dashed?: boolean } = {},
): Arrow {
  const [ox, oy] = off(ctx, id);
  return {
    id,
    kind: 'arrow',
    points: points.map(([x, y]) => [x + ox / 2, y + oy / 2]),
    width: extra.width ?? 4,
    dashed: extra.dashed ?? false,
    factionId,
    label: extra.label ?? null,
    anim: extra.draw ? { kind: 'draw', start: extra.draw[0], end: extra.draw[1] } : NONE,
  };
}

function region(
  ctx: Ctx,
  id: string,
  points: Point[],
  factionId: string | null,
  draw?: [number, number],
): Region {
  const [ox, oy] = off(ctx, id);
  return {
    id,
    kind: 'region',
    points: points.map(([x, y]) => [x + ox / 2, y + oy / 2]),
    factionId,
    label: null,
    anim: draw ? { kind: 'draw', start: draw[0], end: draw[1] } : NONE,
  };
}

function text(id: string, x: number, y: number, value: string, size = 40): TextObject {
  return { id, kind: 'text', x, y, text: value, size, factionId: null, label: null, anim: NONE };
}

function octagon(cx: number, cy: number, rx: number, ry: number): Point[] {
  return D8.map(([dx, dy]) => [cx + dx * rx, cy + dy * ry]);
}

const move = (fromX: number, fromY: number, start: number, end: number): Anim => ({
  kind: 'move',
  fromX,
  fromY,
  start,
  end,
});

type Builder = (ctx: Ctx) => SceneObject[];

const BUILDERS: Record<TemplateId, Builder> = {
  encirclement: (ctx) => {
    const cx = 640;
    const cy = 390;
    const out: SceneObject[] = [
      region(ctx, 'held-ground', octagon(cx, cy, 130, 95), ctx.b, [0, 0.3]),
    ];
    out.push(
      fig(ctx, 'defender-1', cx - 50, cy + 40, ctx.b, 'stand', 1),
      fig(ctx, 'defender-2', cx, cy + 20, ctx.b, 'point', 1, {
        label: lbl(ctx.names[ctx.b] ?? '', 0, -125),
      }),
      fig(ctx, 'defender-3', cx + 50, cy + 40, ctx.b, 'stand', -1),
      prop(ctx, 'defender-flag', cx + 92, cy + 30, 'flag', ctx.b),
    );
    D8.forEach(([dx, dy], i) => {
      const x = cx + dx * 420;
      const y = cy + dy * 215 + 40;
      out.push(
        fig(ctx, `attacker-${i + 1}`, x, y, ctx.a, 'walk', dx < 0 ? 1 : -1, {
          anim: move(cx + dx * 560, cy + dy * 300 + 40, 0, 0.55),
          ...(i === 0 ? { label: lbl(ctx.names[ctx.a] ?? '', 0, -120) } : {}),
        }),
      );
    });
    [1, 3, 5, 7].forEach((i, k) => {
      const [dx, dy] = D8[i] as Point;
      out.push(
        arrow(
          ctx,
          `push-${k + 1}`,
          [
            [cx + dx * 330, cy + dy * 200],
            [cx + dx * 190, cy + dy * 130],
          ],
          ctx.a,
          { draw: [0.45, 0.85] },
        ),
      );
    });
    out.push(text('title', cx, 92, 'Encirclement'));
    return out;
  },

  retreat: (ctx) => {
    const out: SceneObject[] = [];
    [0, 1, 2, 3].forEach((i) => {
      out.push(
        fig(ctx, `retreating-${i + 1}`, 300 + i * 70, 470 + (i % 2) * 30, ctx.b, 'walk', -1, {
          anim: move(560 + i * 70, 470 + (i % 2) * 30, 0.05 * i, 0.6 + 0.05 * i),
          ...(i === 1 ? { label: lbl(ctx.names[ctx.b] ?? '', 0, -120) } : {}),
        }),
      );
    });
    [0, 1, 2].forEach((i) => {
      out.push(
        fig(ctx, `pursuer-${i + 1}`, 820 + i * 80, 380 + i * 40, ctx.a, 'walk', -1, {
          anim: move(1020 + i * 80, 380 + i * 40, 0.2, 0.85),
          ...(i === 1 ? { label: lbl(ctx.names[ctx.a] ?? '', 0, -120) } : {}),
        }),
      );
    });
    out.push(
      arrow(
        ctx,
        'withdrawal',
        [
          [720, 560],
          [520, 590],
          [320, 580],
          [170, 540],
        ],
        ctx.b,
        { draw: [0.1, 0.7], dashed: true, label: lbl('withdrawal', 0, 50, 20) },
      ),
      arrow(
        ctx,
        'pursuit',
        [
          [1150, 300],
          [980, 300],
          [820, 320],
        ],
        ctx.a,
        { draw: [0.3, 0.9] },
      ),
      text('title', 640, 92, 'Retreat'),
    );
    return out;
  },

  siege: (ctx) => {
    const out: SceneObject[] = [
      prop(ctx, 'stronghold', 640, 560, 'castle', ctx.b, {
        scale: 2,
        label: lbl(ctx.names[ctx.b] ?? '', 0, 50),
      }),
      prop(ctx, 'wall-west', 440, 560, 'wall', ctx.b),
      prop(ctx, 'wall-east', 840, 560, 'wall', ctx.b),
      fig(ctx, 'defender-1', 590, 420, ctx.b, 'cheer', 1, { scale: 0.8 }),
      fig(ctx, 'defender-2', 690, 420, ctx.b, 'point', -1, { scale: 0.8 }),
      prop(ctx, 'camp-west', 170, 600, 'tent', ctx.a),
      prop(ctx, 'camp-east', 1110, 600, 'tent', ctx.a, {
        label: lbl(`${ctx.names[ctx.a] ?? ''} camp`, 0, 40, 20),
      }),
    ];
    [0, 1, 2, 3, 4].forEach((i) => {
      const left = i < 2;
      const x = left ? 230 + i * 70 : 920 + (i - 2) * 70;
      out.push(
        fig(
          ctx,
          `besieger-${i + 1}`,
          x,
          640,
          ctx.a,
          i % 2 === 0 ? 'walk' : 'point',
          left ? 1 : -1,
          {
            anim: move(left ? x - 160 : x + 160, 640, 0, 0.5),
          },
        ),
      );
    });
    out.push(
      arrow(
        ctx,
        'assault-west',
        [
          [300, 520],
          [380, 440],
          [500, 410],
        ],
        ctx.a,
        { draw: [0.4, 0.8] },
      ),
      arrow(
        ctx,
        'assault-east',
        [
          [980, 520],
          [900, 440],
          [780, 410],
        ],
        ctx.a,
        { draw: [0.45, 0.85] },
      ),
      text('title', 640, 92, 'Siege'),
    );
    return out;
  },

  'trade-route': (ctx) => [
    prop(ctx, 'market-west', 190, 430, 'castle', ctx.a, {
      label: lbl(`${ctx.names[ctx.a] ?? ''} market`, 0, 46),
    }),
    prop(ctx, 'market-east', 1090, 430, 'castle', ctx.b, {
      label: lbl(`${ctx.names[ctx.b] ?? ''} port`, 0, 46),
    }),
    arrow(
      ctx,
      'route',
      [
        [270, 380],
        [450, 280],
        [640, 320],
        [830, 270],
        [1010, 380],
      ],
      null,
      { draw: [0, 0.6], dashed: true, label: lbl('trade route', 0, -36, 20) },
    ),
    prop(ctx, 'cargo-ship', 760, 600, 'ship', null, { anim: move(420, 600, 0.3, 1) }),
    prop(ctx, 'goods-west', 290, 470, 'crate', ctx.a),
    prop(ctx, 'goods-east', 990, 470, 'crate', ctx.b),
    fig(ctx, 'trader-1', 330, 470, ctx.a, 'point', 1),
    fig(ctx, 'trader-2', 950, 470, ctx.b, 'cheer', -1),
    text('title', 640, 92, 'Trade route'),
  ],

  'supply-line': (ctx) => {
    const out: SceneObject[] = [
      prop(ctx, 'depot', 170, 520, 'crate', ctx.a, { scale: 1.6, label: lbl('Depot', 0, 44) }),
      prop(ctx, 'depot-tent', 250, 520, 'tent', ctx.a),
      prop(ctx, 'front-wall', 1080, 520, 'wall', ctx.a, { label: lbl('Front', 0, 44) }),
      fig(ctx, 'front-1', 1050, 470, ctx.a, 'point', 1, { scale: 0.9 }),
      fig(ctx, 'front-2', 1120, 470, ctx.a, 'stand', -1, { scale: 0.9 }),
    ];
    const legs: [Point, Point][] = [
      [
        [300, 470],
        [520, 430],
      ],
      [
        [540, 430],
        [760, 450],
      ],
      [
        [780, 450],
        [1000, 440],
      ],
    ];
    legs.forEach((leg, i) => {
      out.push(arrow(ctx, `leg-${i + 1}`, leg, ctx.a, { draw: [i * 0.25, i * 0.25 + 0.3] }));
      out.push(
        fig(ctx, `carrier-${i + 1}`, (leg[0][0] + leg[1][0]) / 2, 560, ctx.a, 'walk', 1, {
          anim: move(leg[0][0], 560, i * 0.2, i * 0.2 + 0.5),
          ...(i === 1 ? { label: lbl(ctx.names[ctx.a] ?? '', 0, -118) } : {}),
        }),
      );
    });
    out.push(text('title', 640, 92, 'Supply line'));
    return out;
  },

  'alliance-formation': (ctx) => {
    const out: SceneObject[] = [
      prop(ctx, 'alliance-flag', 640, 520, 'flag', ctx.c, {
        scale: 1.4,
        label: lbl('Alliance', 0, 44),
      }),
    ];
    [0, 1, 2].forEach((i) => {
      out.push(
        fig(ctx, `west-${i + 1}`, 470 + i * 40, 520 + (i % 2) * 24, ctx.a, 'walk', 1, {
          anim: move(170 + i * 40, 520 + (i % 2) * 24, 0, 0.7),
          ...(i === 0 ? { label: lbl(ctx.names[ctx.a] ?? '', 0, -118) } : {}),
        }),
        fig(ctx, `east-${i + 1}`, 810 - i * 40, 520 + (i % 2) * 24, ctx.b, 'walk', -1, {
          anim: move(1110 - i * 40, 520 + (i % 2) * 24, 0, 0.7),
          ...(i === 0 ? { label: lbl(ctx.names[ctx.b] ?? '', 0, -118) } : {}),
        }),
      );
    });
    out.push(
      arrow(
        ctx,
        'join-west',
        [
          [180, 360],
          [400, 330],
          [560, 380],
        ],
        ctx.a,
        { draw: [0.2, 0.7] },
      ),
      arrow(
        ctx,
        'join-east',
        [
          [1100, 360],
          [880, 330],
          [720, 380],
        ],
        ctx.b,
        { draw: [0.2, 0.7] },
      ),
      region(ctx, 'common-ground', octagon(640, 470, 230, 110), ctx.c, [0.7, 1]),
      text('title', 640, 92, 'Alliance formation'),
    );
    return out;
  },

  'alliance-collapse': (ctx) => {
    const out: SceneObject[] = [
      prop(ctx, 'broken-flag', 640, 540, 'flag', ctx.c),
      fig(ctx, 'fallen', 640, 580, null, 'fallen', 1, { label: lbl('Alliance collapses', 0, 50) }),
    ];
    [0, 1, 2].forEach((i) => {
      out.push(
        fig(ctx, `west-${i + 1}`, 250 + i * 50, 520 + (i % 2) * 24, ctx.a, 'walk', -1, {
          anim: move(560 - i * 20, 520 + (i % 2) * 24, 0.1, 0.8),
          ...(i === 1 ? { label: lbl(ctx.names[ctx.a] ?? '', 0, -118) } : {}),
        }),
        fig(ctx, `east-${i + 1}`, 1030 - i * 50, 520 + (i % 2) * 24, ctx.b, 'walk', 1, {
          anim: move(720 + i * 20, 520 + (i % 2) * 24, 0.1, 0.8),
          ...(i === 1 ? { label: lbl(ctx.names[ctx.b] ?? '', 0, -118) } : {}),
        }),
      );
    });
    out.push(
      arrow(
        ctx,
        'split-west',
        [
          [580, 380],
          [420, 340],
          [240, 360],
        ],
        ctx.a,
        { draw: [0.3, 0.8] },
      ),
      arrow(
        ctx,
        'split-east',
        [
          [700, 380],
          [860, 340],
          [1040, 360],
        ],
        ctx.b,
        { draw: [0.3, 0.8] },
      ),
      text('title', 640, 92, 'Alliance collapse'),
    );
    return out;
  },

  timeline: (ctx) => {
    const out: SceneObject[] = [
      arrow(
        ctx,
        'axis',
        [
          [120, 430],
          [1170, 430],
        ],
        null,
        { draw: [0, 0.5], width: 5 },
      ),
    ];
    const factions = [ctx.a, ctx.b, ctx.c, ctx.a, ctx.b];
    [0, 1, 2, 3, 4].forEach((i) => {
      const x = 220 + i * 210;
      out.push(
        prop(ctx, `stage-${i + 1}`, x, 420, 'flag', factions[i] ?? null, {
          label: lbl(`Stage ${i + 1}`, 0, 50, 20),
          anim: move(x, 300, 0.4 + i * 0.1, 0.5 + i * 0.1),
        }),
      );
    });
    out.push(
      fig(ctx, 'witness-1', 320, 650, ctx.a, 'point', 1, {
        label: lbl(ctx.names[ctx.a] ?? '', 0, -118),
      }),
      fig(ctx, 'witness-2', 960, 650, ctx.b, 'cheer', -1, {
        label: lbl(ctx.names[ctx.b] ?? '', 0, -118),
      }),
      text('title', 640, 92, 'Timeline'),
    );
    return out;
  },
};

export interface TemplateParams {
  factions?: Faction[];
  seed?: number;
  title?: string;
}

/** Builds a template scene. Missing factions fall back to the invented defaults. */
export function buildTemplate(id: TemplateId, params: TemplateParams = {}): Scene {
  const factions = (params.factions ?? DEFAULT_FACTIONS).slice(0, 8);
  const pick = (i: number): string =>
    (factions[i] ?? factions[0] ?? DEFAULT_FACTIONS[i] ?? DEFAULT_FACTIONS[0]!).id;
  const allFactions =
    factions.length >= 3 ? factions : [...factions, ...DEFAULT_FACTIONS.slice(factions.length)];
  const names: Record<string, string> = {};
  for (const f of allFactions) names[f.id] = f.name;
  const seed = params.seed ?? 1;
  const ctx: Ctx = { seed, a: pick(0), b: pick(1), c: pick(2), names };
  const objects = BUILDERS[id](ctx);
  const used = new Set(objects.map((o) => o.factionId).filter((f): f is string => f !== null));
  return {
    schema: SCHEMA,
    version: VERSION,
    title: params.title ?? TEMPLATE_INFO[id].title,
    seed,
    styleVersion: STYLE_VERSION,
    canvas: { width: W, height: H, paper: '#fbf8f1', ink: '#1f2328' },
    safeArea: { top: 40, right: 40, bottom: 40, left: 40 },
    factions: allFactions.filter((f) => used.has(f.id) || factions.includes(f)),
    objects,
    animation: { durationMs: 4000 },
    sample: true,
    template: id,
  };
}

/**
 * Regenerate (spec 02): rebuild from the template with a new seed, keeping factions, title and the
 * label text and position of every object whose id survives.
 */
export function regenerate(scene: Scene, seed: number): Scene | null {
  if (scene.template === null) return null;
  const fresh = buildTemplate(scene.template, {
    factions: scene.factions,
    seed,
    title: scene.title,
  });
  const labels = new Map(scene.objects.map((o) => [o.id, o.label]));
  return {
    ...fresh,
    canvas: scene.canvas,
    safeArea: scene.safeArea,
    animation: scene.animation,
    factions: scene.factions,
    objects: fresh.objects.map((o) => {
      const kept = labels.get(o.id);
      return kept === undefined ? o : { ...o, label: kept };
    }),
  };
}
