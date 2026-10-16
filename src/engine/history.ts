/** Undo/redo (docs/spec/02-editor-and-qa.md): 200 steps, coalescing of rapid edits to one object. */
import type { Scene } from './types';

export const HISTORY_LIMIT = 200;
export const COALESCE_MS = 600;

export interface History {
  past: Scene[];
  present: Scene;
  future: Scene[];
  /** The key and time of the last coalescable edit. */
  lastKey: string | null;
  lastAt: number;
}

export function createHistory(scene: Scene): History {
  return { past: [], present: scene, future: [], lastKey: null, lastAt: 0 };
}

/**
 * Records a new present. Edits with the same non-null `key` (e.g. "move:figure-1") within
 * COALESCE_MS of the previous one replace the present instead of adding a step.
 */
export function commit(h: History, next: Scene, key: string | null = null, now = 0): History {
  if (next === h.present) return h;
  const coalesce =
    key !== null && key === h.lastKey && now - h.lastAt <= COALESCE_MS && h.past.length > 0;
  if (coalesce) return { ...h, present: next, future: [], lastAt: now };
  const past = [...h.past, h.present];
  if (past.length > HISTORY_LIMIT) past.shift();
  return { past, present: next, future: [], lastKey: key, lastAt: now };
}

export function undo(h: History): History {
  const prev = h.past[h.past.length - 1];
  if (prev === undefined) return h;
  return {
    past: h.past.slice(0, -1),
    present: prev,
    future: [h.present, ...h.future],
    lastKey: null,
    lastAt: 0,
  };
}

export function redo(h: History): History {
  const next = h.future[0];
  if (next === undefined) return h;
  return {
    past: [...h.past, h.present],
    present: next,
    future: h.future.slice(1),
    lastKey: null,
    lastAt: 0,
  };
}

export const canUndo = (h: History): boolean => h.past.length > 0;
export const canRedo = (h: History): boolean => h.future.length > 0;
