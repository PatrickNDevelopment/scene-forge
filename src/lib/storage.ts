/** Browser persistence: the current scene and the user's presets (docs/spec/02-editor-and-qa.md). */
import { validateScene, type Scene } from '../engine';

export const SCENE_KEY = 'scene-forge.scene.v2';
export const CORRUPT_KEY = 'scene-forge.scene.v2.corrupt';
export const PRESETS_KEY = 'scene-forge.presets.v1';
export const MAX_PRESETS = 20;

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function read(key: string): string | null {
  try {
    return storage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export type LoadResult =
  | { kind: 'empty' }
  | { kind: 'ok'; scene: Scene; migrated: boolean }
  | { kind: 'recovered'; raw: string; errors: string[] };

export function loadScene(): LoadResult {
  const raw = read(SCENE_KEY);
  if (raw === null) return { kind: 'empty' };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return keepCorrupt(raw, ['the stored scene is not valid JSON']);
  }
  const r = validateScene(value);
  if (r.ok) return { kind: 'ok', scene: r.scene, migrated: r.migratedFrom !== null };
  return keepCorrupt(raw, r.errors);
}

function keepCorrupt(raw: string, errors: string[]): LoadResult {
  try {
    storage()?.setItem(CORRUPT_KEY, raw);
  } catch {
    /* the raw text is still returned so the UI can offer a download */
  }
  return { kind: 'recovered', raw, errors };
}

/** Returns an error message, or null when saved. */
export function saveScene(scene: Scene): string | null {
  const s = storage();
  if (s === null) return 'Browser storage is unavailable; save the scene as JSON to keep it.';
  try {
    s.setItem(SCENE_KEY, JSON.stringify(scene));
    return null;
  } catch {
    return 'The browser refused to store the scene (storage may be full). Save it as JSON now.';
  }
}

export interface Preset {
  name: string;
  savedAt: string;
  scene: Scene;
}

export function loadPresets(): Preset[] {
  const raw = read(PRESETS_KEY);
  if (raw === null) return [];
  try {
    const list = JSON.parse(raw) as unknown;
    if (!Array.isArray(list)) return [];
    const out: Preset[] = [];
    for (const item of list.slice(0, MAX_PRESETS)) {
      if (typeof item !== 'object' || item === null) continue;
      const p = item as { name?: unknown; savedAt?: unknown; scene?: unknown };
      const r = validateScene(p.scene);
      if (typeof p.name === 'string' && typeof p.savedAt === 'string' && r.ok) {
        out.push({ name: p.name.slice(0, 80), savedAt: p.savedAt, scene: r.scene });
      }
    }
    return out;
  } catch {
    return [];
  }
}

export function savePresets(presets: Preset[]): string | null {
  try {
    storage()?.setItem(PRESETS_KEY, JSON.stringify(presets.slice(0, MAX_PRESETS)));
    return null;
  } catch {
    return 'The browser refused to store the preset (storage may be full).';
  }
}
