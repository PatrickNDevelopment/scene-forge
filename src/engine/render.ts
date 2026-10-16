/**
 * Scene to SVG node tree (docs/spec/01-rendering.md). Pure and deterministic: the same scene, style
 * version and seed always give the same tree, and serializeSvg gives the same string.
 */
import { signed, strokeRng } from './random';
import { FIGURE_BOX, HEAD_RADIUS, POSE_TABLE, PROP_BOX, PROP_STROKES, circle } from './shapes';
import { el, pathData, type SvgNode } from './svg';
import type { Anim, Point, Scene, SceneObject } from './types';

export const FONT_FAMILY = "'Segoe Print', 'Comic Sans MS', 'Comic Neue', cursive";
export const DESC = 'Illustrative diagram made with SceneForge. Not a geographically accurate map.';

export interface RenderOptions {
  /** Time 0..1; 1 (default) is the final, static scene. */
  t?: number;
  /** Write CSS keyframes for an animated SVG (wrapped in prefers-reduced-motion: no-preference). */
  animated?: boolean;
  /** Mark the selected object (editor only; never used for export). */
  selectedId?: string;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (p: number): number => p * p * (3 - 2 * p);

/** Animation progress of an object at time t (0 before start, 1 after end), eased. */
export function progress(anim: Anim, t: number): number {
  if (anim.kind === 'none') return 1;
  const p = clamp01((t - anim.start) / (anim.end - anim.start));
  return smooth(p);
}

/** The anchor of a point object at time t (moves interpolate from `from`). */
export function anchorAt(o: SceneObject, t: number): Point {
  const base = anchor(o);
  if (o.anim.kind !== 'move') return base;
  const e = progress(o.anim, t);
  return [o.anim.fromX + (base[0] - o.anim.fromX) * e, o.anim.fromY + (base[1] - o.anim.fromY) * e];
}

/** Label anchor (docs/spec/00-scene-format.md). */
export function anchor(o: SceneObject): Point {
  switch (o.kind) {
    case 'figure':
    case 'prop':
    case 'text':
      return [o.x, o.y];
    case 'arrow':
      return o.points[Math.floor((o.points.length - 1) / 2)] as Point;
    case 'region':
      return o.points[0] as Point;
  }
}

/** One hand-drawn pass through `pts`: jittered points joined by quadratic curves. */
function sketchPass(
  pts: readonly Point[],
  width: number,
  rng: () => number,
  closed: boolean,
): string {
  const j = 1.6 * width;
  const jitter = (p: Point): Point => [p[0] + signed(rng) * j, p[1] + signed(rng) * j];
  const moved = pts.map(jitter);
  if (closed && moved.length > 1) moved[moved.length - 1] = moved[0] as Point;
  const first = moved[0] as Point;
  const parts: (string | number)[] = ['M', first[0], first[1]];
  for (let i = 1; i < moved.length; i += 1) {
    const a = moved[i - 1] as Point;
    const b = moved[i] as Point;
    const cx = (a[0] + b[0]) / 2 + signed(rng) * j;
    const cy = (a[1] + b[1]) / 2 + signed(rng) * j;
    parts.push('Q', cx, cy, b[0], b[1]);
  }
  return pathData(parts);
}

interface StrokeStyle {
  color: string;
  width: number;
  dashed?: boolean;
  draw?: number; // 0..1 draw-on progress; undefined = fully drawn, no dash attributes
  cls?: string;
}

function sketch(
  scene: Scene,
  id: string,
  index: number,
  pts: readonly Point[],
  style: StrokeStyle,
  closed = false,
): SvgNode[] {
  const out: SvgNode[] = [];
  for (let pass = 0; pass < 2; pass += 1) {
    const rng = strokeRng(scene.seed, scene.styleVersion, id, index * 2 + pass);
    const attrs: [string, string | number][] = [
      ['d', sketchPass(pts, style.width, rng, closed)],
      ['fill', 'none'],
      ['stroke', style.color],
      ['stroke-width', pass === 0 ? style.width : style.width * 0.6],
      ['stroke-linecap', 'round'],
      ['stroke-linejoin', 'round'],
    ];
    if (pass === 1) attrs.push(['stroke-opacity', '0.55']);
    if (style.draw !== undefined || style.cls !== undefined) {
      attrs.push(['pathLength', '100']);
      attrs.push(['stroke-dasharray', '100']);
      attrs.push(['stroke-dashoffset', 100 * (1 - (style.draw ?? 1))]);
    } else if (style.dashed) {
      attrs.push(['stroke-dasharray', `${style.width * 4} ${style.width * 3}`]);
    }
    if (style.cls) attrs.push(['class', style.cls]);
    out.push(el('path', attrs));
  }
  return out;
}

function colorOf(scene: Scene, o: SceneObject): string {
  const f = o.factionId === null ? undefined : scene.factions.find((x) => x.id === o.factionId);
  return f?.color ?? scene.canvas.ink;
}

function labelNode(
  scene: Scene,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  role?: 'label',
): SvgNode {
  return el(
    'text',
    [
      ...(role ? ([['data-role', role]] as [string, string][]) : []),
      ['x', x],
      ['y', y],
      ['font-size', size],
      ['font-family', FONT_FAMILY],
      ['text-anchor', 'middle'],
      ['fill', color],
      ['stroke', scene.canvas.paper],
      ['stroke-width', Math.max(2, size / 6)],
      ['paint-order', 'stroke'],
    ],
    [text],
  );
}

function drawObject(scene: Scene, o: SceneObject, t: number, animated: boolean): SvgNode[] {
  const color = colorOf(scene, o);
  const nodes: SvgNode[] = [];
  const drawP = o.anim.kind === 'draw' ? progress(o.anim, animated ? 1 : t) : undefined;
  const drawCls = animated && o.anim.kind === 'draw' ? `sf-d-${o.id}` : undefined;
  const [ax, ay] = animated ? anchor(o) : anchorAt(o, t);

  if (o.kind === 'figure') {
    const s = o.scale;
    const w = 3;
    const J = POSE_TABLE[o.pose];
    const strokes: Point[][] = [
      [J.neck, J.hip],
      [J.handL, J.shoulder, J.handR],
      [J.footL, J.hip, J.footR],
      circle(J.head[0], J.head[1], HEAD_RADIUS),
    ];
    const inner: SvgNode[] = [];
    strokes.forEach((pts, i) =>
      inner.push(...sketch(scene, o.id, i, pts, { color, width: w }, i === 3)),
    );
    nodes.push(
      el(
        'g',
        [['transform', `translate(${fmtPair(ax, ay)}) scale(${fmtPair(s * o.facing, s)})`]],
        inner,
      ),
    );
  } else if (o.kind === 'prop') {
    const s = o.scale;
    const inner: SvgNode[] = [];
    PROP_STROKES[o.prop].forEach((pts, i) =>
      inner.push(...sketch(scene, o.id, i, pts, { color, width: 3 })),
    );
    nodes.push(
      el('g', [['transform', `translate(${fmtPair(ax, ay)}) scale(${fmtPair(s, s)})`]], inner),
    );
  } else if (o.kind === 'arrow') {
    const style: StrokeStyle = { color, width: o.width, dashed: o.dashed };
    if (drawP !== undefined) style.draw = drawP;
    if (drawCls !== undefined) style.cls = drawCls;
    nodes.push(...sketch(scene, o.id, 0, o.points, style));
    const head = arrowHead(o.points, o.width);
    if (head !== null) {
      const headStyle: StrokeStyle = { color, width: o.width };
      if (drawP !== undefined) headStyle.draw = drawP < 1 ? 0 : 1;
      if (drawCls !== undefined) headStyle.cls = drawCls;
      nodes.push(...sketch(scene, o.id, 1, head, headStyle));
    }
  } else if (o.kind === 'region') {
    const closedPts: Point[] = [...o.points, o.points[0] as Point];
    const fillAttrs: [string, string | number][] = [
      ['d', pathData(['M', ...closedPts.flatMap((p) => [p[0], p[1]]), 'Z'])],
      ['fill', color],
      ['fill-opacity', drawP === undefined ? 0.18 : 0.18 * drawP],
      ['stroke', 'none'],
    ];
    nodes.push(el('path', fillAttrs));
    const style: StrokeStyle = { color, width: 2.5 };
    if (drawP !== undefined) style.draw = drawP;
    if (drawCls !== undefined) style.cls = drawCls;
    nodes.push(...sketch(scene, o.id, 0, closedPts, style, true));
  } else {
    nodes.push(labelNode(scene, o.text, ax, ay, o.size, color));
  }

  if (o.label !== null) {
    const L = o.label;
    const [lx, ly] = o.kind === 'arrow' || o.kind === 'region' ? anchor(o) : [ax, ay];
    nodes.push(labelNode(scene, L.text, lx + L.dx, ly + L.dy, L.size, color, 'label'));
  }
  return nodes;
}

function fmtPair(a: number, b: number): string {
  return `${pathData([a])} ${pathData([b])}`;
}

/** Two strokes forming an arrow head at the last point, or null for a zero-length last segment. */
export function arrowHead(points: readonly Point[], width: number): Point[] | null {
  const tip = points[points.length - 1] as Point;
  const prev = points[points.length - 2] as Point;
  const dx = tip[0] - prev[0];
  const dy = tip[1] - prev[1];
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return null;
  const ux = dx / len;
  const uy = dy / len;
  const h = 10 + width * 3;
  return [
    [tip[0] - ux * h - uy * h * 0.6, tip[1] - uy * h + ux * h * 0.6],
    tip,
    [tip[0] - ux * h + uy * h * 0.6, tip[1] - uy * h - ux * h * 0.6],
  ];
}

function keyframes(scene: Scene): string {
  const d = scene.animation.durationMs;
  const rules: string[] = [];
  for (const o of scene.objects) {
    if (o.anim.kind === 'none') continue;
    const delay = Math.round(o.anim.start * d);
    const dur = Math.round((o.anim.end - o.anim.start) * d);
    if (o.anim.kind === 'move') {
      const [x, y] = anchor(o);
      rules.push(
        `@keyframes sf-m-${o.id}{from{transform:translate(${pathData([o.anim.fromX - x])}px,${pathData([o.anim.fromY - y])}px)}to{transform:translate(0px,0px)}}`,
        `.sf-m-${o.id}{animation:sf-m-${o.id} ${dur}ms ease-in-out ${delay}ms both}`,
      );
    } else {
      rules.push(
        `@keyframes sf-d-${o.id}{from{stroke-dashoffset:100}to{stroke-dashoffset:0}}`,
        `.sf-d-${o.id}{animation:sf-d-${o.id} ${dur}ms ease-in-out ${delay}ms both}`,
      );
    }
  }
  return rules.length === 0
    ? ''
    : `@media (prefers-reduced-motion: no-preference){${rules.join('')}}`;
}

export function renderScene(scene: Scene, opts: RenderOptions = {}): SvgNode {
  const t = opts.t ?? 1;
  const animated = opts.animated === true;
  const { width, height, paper } = scene.canvas;
  const children: (SvgNode | string)[] = [el('title', [], [scene.title]), el('desc', [], [DESC])];
  if (animated) {
    const css = keyframes(scene);
    if (css) children.push(el('style', [], [css]));
  }
  children.push(
    el('rect', [
      ['x', 0],
      ['y', 0],
      ['width', width],
      ['height', height],
      ['fill', paper],
    ]),
  );
  for (const o of scene.objects) {
    const attrs: [string, string][] = [
      ['data-id', o.id],
      ['data-kind', o.kind],
    ];
    if (animated && o.anim.kind === 'move') attrs.push(['class', `sf-m-${o.id}`]);
    if (opts.selectedId === o.id) attrs.push(['data-selected', 'true']);
    children.push(el('g', attrs, drawObject(scene, o, t, animated)));
  }
  return el(
    'svg',
    [
      ['xmlns', 'http://www.w3.org/2000/svg'],
      ['viewBox', `0 0 ${width} ${height}`],
      ['width', width],
      ['height', height],
    ],
    children,
  );
}

/** Bounding box [minX, minY, maxX, maxY] of an object's drawing at t = 1 (labels excluded). */
export function objectBox(o: SceneObject): [number, number, number, number] {
  if (o.kind === 'figure' || o.kind === 'prop') {
    const b = o.kind === 'figure' ? FIGURE_BOX[o.pose] : PROP_BOX[o.prop];
    const sx = o.kind === 'figure' ? o.scale * o.facing : o.scale;
    const xs = [b[0] * sx, b[2] * sx];
    return [
      o.x + Math.min(...xs),
      o.y + b[1] * o.scale,
      o.x + Math.max(...xs),
      o.y + b[3] * o.scale,
    ];
  }
  if (o.kind === 'text') return textBox(o.text, o.size, o.x, o.y);
  const xs = o.points.map((p) => p[0]);
  const ys = o.points.map((p) => p[1]);
  const pad = o.kind === 'arrow' ? 10 + o.width * 3 : 3;
  return [
    Math.min(...xs) - pad,
    Math.min(...ys) - pad,
    Math.max(...xs) + pad,
    Math.max(...ys) + pad,
  ];
}

/** Estimated text box (no font metrics): width = characters * size * 0.56. */
export function textBox(
  text: string,
  size: number,
  x: number,
  y: number,
): [number, number, number, number] {
  const w = Array.from(text).length * size * 0.56;
  return [x - w / 2, y - size * 0.9, x + w / 2, y + size * 0.3];
}

export function labelBox(o: SceneObject): [number, number, number, number] | null {
  if (o.label === null) return null;
  const [x, y] = anchor(o);
  return textBox(o.label.text, o.label.size, x + o.label.dx, y + o.label.dy);
}
