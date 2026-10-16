/** Scene model, schema `scene-forge.scene` version 2 (docs/spec/00-scene-format.md). */

export const SCHEMA = 'scene-forge.scene';
export const VERSION = 2;
export const STYLE_VERSION = 1;

export const POSES = ['stand', 'walk', 'point', 'cheer', 'fallen'] as const;
export type Pose = (typeof POSES)[number];

export const PROPS = ['castle', 'tent', 'flag', 'ship', 'crate', 'tree', 'wall'] as const;
export type PropKind = (typeof PROPS)[number];

export const KINDS = ['figure', 'prop', 'arrow', 'region', 'text'] as const;
export type ObjectKind = (typeof KINDS)[number];

export type Point = [number, number];

export interface LabelSpec {
  text: string;
  dx: number;
  dy: number;
  size: number;
}

export type Anim =
  | { kind: 'none' }
  | { kind: 'move'; fromX: number; fromY: number; start: number; end: number }
  | { kind: 'draw'; start: number; end: number };

interface Base {
  id: string;
  factionId: string | null;
  label: LabelSpec | null;
  anim: Anim;
}

export interface Figure extends Base {
  kind: 'figure';
  x: number;
  y: number;
  scale: number;
  pose: Pose;
  facing: 1 | -1;
}

export interface Prop extends Base {
  kind: 'prop';
  x: number;
  y: number;
  scale: number;
  prop: PropKind;
}

export interface Arrow extends Base {
  kind: 'arrow';
  points: Point[];
  width: number;
  dashed: boolean;
}

export interface Region extends Base {
  kind: 'region';
  points: Point[];
}

export interface TextObject extends Base {
  kind: 'text';
  x: number;
  y: number;
  text: string;
  size: number;
}

export type SceneObject = Figure | Prop | Arrow | Region | TextObject;

export interface Faction {
  id: string;
  name: string;
  color: string;
}

export interface Scene {
  schema: typeof SCHEMA;
  version: typeof VERSION;
  title: string;
  seed: number;
  styleVersion: typeof STYLE_VERSION;
  canvas: { width: number; height: number; paper: string; ink: string };
  safeArea: { top: number; right: number; bottom: number; left: number };
  factions: Faction[];
  objects: SceneObject[];
  animation: { durationMs: number };
  sample: boolean;
  template: TemplateId | null;
}

export const TEMPLATE_IDS = [
  'encirclement',
  'retreat',
  'siege',
  'trade-route',
  'supply-line',
  'alliance-formation',
  'alliance-collapse',
  'timeline',
] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export const LIMITS = {
  factions: 8,
  objects: 300,
  textMax: 200,
  titleMax: 120,
  factionNameMax: 40,
  fileBytes: 2_000_000,
  coordMin: -4096,
  coordMax: 8192,
} as const;

/** True for objects that have a single (x, y) anchor. */
export function isPointObject(o: SceneObject): o is Figure | Prop | TextObject {
  return o.kind === 'figure' || o.kind === 'prop' || o.kind === 'text';
}
