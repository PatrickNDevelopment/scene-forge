/**
 * Constant geometry: pose joint tables, prop outlines and a unit-circle table. No trigonometry is
 * used anywhere in the engine (docs/spec/01-rendering.md), so these tables are written out.
 */
import type { Point, Pose, PropKind } from './types';

/** 12 points on the unit circle, 30 degrees apart, starting at (1, 0). */
export const UNIT_CIRCLE: readonly Point[] = [
  [1, 0],
  [0.8660254, 0.5],
  [0.5, 0.8660254],
  [0, 1],
  [-0.5, 0.8660254],
  [-0.8660254, 0.5],
  [-1, 0],
  [-0.8660254, -0.5],
  [-0.5, -0.8660254],
  [0, -1],
  [0.5, -0.8660254],
  [0.8660254, -0.5],
];

export function circle(cx: number, cy: number, r: number): Point[] {
  const pts: Point[] = UNIT_CIRCLE.map(([x, y]) => [cx + x * r, cy + y * r]);
  pts.push(pts[0] as Point);
  return pts;
}

/** Joints in a 100-unit tall frame; feet midpoint at (0, 0); y grows downwards. */
export interface PoseJoints {
  head: Point;
  neck: Point;
  shoulder: Point;
  hip: Point;
  handL: Point;
  handR: Point;
  footL: Point;
  footR: Point;
}

export const POSE_TABLE: Readonly<Record<Pose, PoseJoints>> = {
  stand: {
    head: [0, -88],
    neck: [0, -77],
    shoulder: [0, -70],
    hip: [0, -40],
    handL: [-18, -48],
    handR: [18, -48],
    footL: [-14, 0],
    footR: [14, 0],
  },
  walk: {
    head: [4, -87],
    neck: [3, -76],
    shoulder: [2, -69],
    hip: [0, -40],
    handL: [-16, -52],
    handR: [20, -46],
    footL: [-20, 0],
    footR: [18, -2],
  },
  point: {
    head: [0, -88],
    neck: [0, -77],
    shoulder: [0, -70],
    hip: [0, -40],
    handL: [-14, -46],
    handR: [42, -74],
    footL: [-14, 0],
    footR: [14, 0],
  },
  cheer: {
    head: [0, -88],
    neck: [0, -77],
    shoulder: [0, -70],
    hip: [0, -40],
    handL: [-24, -100],
    handR: [24, -100],
    footL: [-16, 0],
    footR: [16, 0],
  },
  fallen: {
    head: [-40, -11],
    neck: [-29, -10],
    shoulder: [-22, -10],
    hip: [14, -8],
    handL: [-14, -26],
    handR: [-6, 0],
    footL: [46, -2],
    footR: [42, -16],
  },
};

export const HEAD_RADIUS = 10;

/** Stroke lists for props, in a local frame anchored at the base centre (y up is negative). */
export const PROP_STROKES: Readonly<Record<PropKind, readonly (readonly Point[])[]>> = {
  castle: [
    [
      [-50, 0],
      [-50, -70],
      [-40, -70],
      [-40, -60],
      [-30, -60],
      [-30, -70],
      [-20, -70],
      [-20, -50],
      [20, -50],
      [20, -70],
      [30, -70],
      [30, -60],
      [40, -60],
      [40, -70],
      [50, -70],
      [50, 0],
      [-50, 0],
    ],
    [
      [-10, 0],
      [-10, -20],
      [10, -20],
      [10, 0],
    ],
  ],
  tent: [
    [
      [-32, 0],
      [0, -42],
      [32, 0],
      [-32, 0],
    ],
    [
      [0, -42],
      [-6, 0],
    ],
  ],
  flag: [
    [
      [0, 0],
      [0, -72],
    ],
    [
      [0, -72],
      [32, -62],
      [0, -52],
    ],
  ],
  ship: [
    [
      [-46, -12],
      [46, -12],
      [32, 4],
      [-32, 4],
      [-46, -12],
    ],
    [
      [0, -12],
      [0, -62],
    ],
    [
      [0, -60],
      [26, -24],
      [0, -24],
    ],
  ],
  crate: [
    [
      [-16, 0],
      [-16, -32],
      [16, -32],
      [16, 0],
      [-16, 0],
    ],
    [
      [-16, 0],
      [16, -32],
    ],
  ],
  tree: [
    [
      [0, 0],
      [0, -30],
    ],
    circle(0, -50, 20),
  ],
  wall: [
    [
      [-60, 0],
      [-60, -36],
      [-48, -36],
      [-48, -28],
      [-36, -28],
      [-36, -36],
      [-24, -36],
      [-24, -28],
      [-12, -28],
      [-12, -36],
      [0, -36],
      [0, -28],
      [12, -28],
      [12, -36],
      [24, -36],
      [24, -28],
      [36, -28],
      [36, -36],
      [48, -36],
      [48, -28],
      [60, -28],
      [60, 0],
      [-60, 0],
    ],
  ],
};

/** Unscaled bounding boxes [minX, minY, maxX, maxY] in the local frame (for visual QA). */
export const PROP_BOX: Readonly<Record<PropKind, readonly [number, number, number, number]>> = {
  castle: [-52, -72, 52, 2],
  tent: [-34, -44, 34, 2],
  flag: [-2, -74, 34, 2],
  ship: [-48, -64, 48, 6],
  crate: [-18, -34, 18, 2],
  tree: [-22, -72, 22, 2],
  wall: [-62, -38, 62, 2],
};

export const FIGURE_BOX: Readonly<Record<Pose, readonly [number, number, number, number]>> = {
  stand: [-22, -100, 22, 2],
  walk: [-22, -99, 22, 2],
  point: [-18, -100, 44, 2],
  cheer: [-26, -102, 26, 2],
  fallen: [-52, -28, 48, 2],
};
