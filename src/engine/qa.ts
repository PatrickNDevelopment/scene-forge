/** Visual QA (docs/spec/02-editor-and-qa.md). Deterministic, advisory, never blocking. */
import { labelBox, objectBox } from './render';
import type { Scene, SceneObject } from './types';

export type QaCode =
  | 'EMPTY_SCENE'
  | 'LABEL_OVERLAP'
  | 'LOW_CONTRAST'
  | 'OFF_CANVAS'
  | 'OUTSIDE_SAFE_AREA'
  | 'PARTLY_OFF_CANVAS';

export interface QaFinding {
  code: QaCode;
  objectId: string | null;
  otherId?: string;
  message: string;
}

type Box = [number, number, number, number];

function intersects(a: Box, b: Box): boolean {
  return a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
}

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

/** WCAG 2 contrast ratio between two #rrggbb colours (1 to 21). */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function colorOf(scene: Scene, o: SceneObject): string {
  const f = o.factionId === null ? undefined : scene.factions.find((x) => x.id === o.factionId);
  return f?.color ?? scene.canvas.ink;
}

function name(o: SceneObject): string {
  return o.label?.text ?? (o.kind === 'text' ? o.text : o.id);
}

export function runQa(scene: Scene): QaFinding[] {
  const out: QaFinding[] = [];
  if (scene.objects.length === 0) {
    return [{ code: 'EMPTY_SCENE', objectId: null, message: 'The scene has no objects yet.' }];
  }
  const { width, height, paper } = scene.canvas;
  const canvas: Box = [0, 0, width, height];
  const s = scene.safeArea;
  const safe: Box = [s.left, s.top, width - s.right, height - s.bottom];
  const inside = (b: Box, area: Box): boolean =>
    b[0] >= area[0] && b[1] >= area[1] && b[2] <= area[2] && b[3] <= area[3];

  const labels: { id: string; box: Box }[] = [];
  for (const o of scene.objects) {
    const boxes: Box[] = [objectBox(o)];
    const lb = labelBox(o);
    if (lb !== null) {
      boxes.push(lb);
      labels.push({ id: o.id, box: lb });
    }
    if (o.kind === 'text') labels.push({ id: o.id, box: objectBox(o) });
    const all: Box = [
      Math.min(...boxes.map((b) => b[0])),
      Math.min(...boxes.map((b) => b[1])),
      Math.max(...boxes.map((b) => b[2])),
      Math.max(...boxes.map((b) => b[3])),
    ];
    if (!intersects(all, canvas)) {
      out.push({
        code: 'OFF_CANVAS',
        objectId: o.id,
        message: `"${name(o)}" is entirely outside the canvas.`,
      });
    } else if (!inside(all, canvas)) {
      out.push({
        code: 'PARTLY_OFF_CANVAS',
        objectId: o.id,
        message: `"${name(o)}" crosses the canvas edge.`,
      });
    } else if (!inside(all, safe)) {
      out.push({
        code: 'OUTSIDE_SAFE_AREA',
        objectId: o.id,
        message: `"${name(o)}" reaches outside the safe area.`,
      });
    }
    const c = colorOf(scene, o);
    const ratio = contrast(c, paper);
    const hasText = o.kind === 'text' || o.label !== null;
    if ((hasText && ratio < 4.5) || ratio < 3) {
      out.push({
        code: 'LOW_CONTRAST',
        objectId: o.id,
        message: `"${name(o)}" colour has contrast ${ratio.toFixed(2)}:1 against the paper (needs ${hasText ? '4.5' : '3'}:1).`,
      });
    }
  }
  for (let i = 0; i < labels.length; i += 1) {
    for (let j = i + 1; j < labels.length; j += 1) {
      const a = labels[i] as { id: string; box: Box };
      const b = labels[j] as { id: string; box: Box };
      if (intersects(a.box, b.box)) {
        out.push({
          code: 'LABEL_OVERLAP',
          objectId: a.id < b.id ? a.id : b.id,
          otherId: a.id < b.id ? b.id : a.id,
          message: `Labels of "${a.id}" and "${b.id}" overlap (estimated text size).`,
        });
      }
    }
  }
  return out.sort(
    (x, y) =>
      (x.objectId ?? '').localeCompare(y.objectId ?? '') ||
      x.code.localeCompare(y.code) ||
      (x.otherId ?? '').localeCompare(y.otherId ?? ''),
  );
}
