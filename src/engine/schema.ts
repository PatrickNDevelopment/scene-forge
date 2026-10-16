/**
 * Strict import validation and version migration (docs/spec/00-scene-format.md). Untrusted JSON
 * never reaches the renderer without passing here.
 */
import { z } from 'zod';
import {
  KINDS,
  LIMITS,
  POSES,
  PROPS,
  SCHEMA,
  STYLE_VERSION,
  TEMPLATE_IDS,
  VERSION,
  type Scene,
} from './types';

/** The text rule: single line, no C0/C1 controls, no lone surrogates. */
export function isCleanText(text: string): boolean {
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    if (c < 0x20 || (c >= 0x7f && c <= 0x9f)) return false;
    if (c >= 0xd800 && c <= 0xdbff) {
      const d = i + 1 < text.length ? text.charCodeAt(i + 1) : 0;
      if (!(d >= 0xdc00 && d <= 0xdfff)) return false;
      i += 1;
    } else if (c >= 0xdc00 && c <= 0xdfff) {
      return false;
    }
  }
  return true;
}

/** Removes characters the text rule forbids (used on typed input). */
export function cleanText(text: string): string {
  let out = '';
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    if (c < 0x20 || (c >= 0x7f && c <= 0x9f) || (c >= 0xd800 && c <= 0xdfff)) continue;
    out += ch;
  }
  return out;
}

const cpLen = (s: string): number => Array.from(s).length;

const text = (min: number, max: number) =>
  z
    .string()
    .refine((s) => cpLen(s) >= min && cpLen(s) <= max, {
      message: `must be ${min} to ${max} characters`,
    })
    .refine(isCleanText, { message: 'contains a control character or invalid Unicode' });

const id = z
  .string()
  .regex(/^[a-z][a-z0-9-]{0,31}$/, 'ids are lower case letters, digits and -, up to 32');
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'colours are #rrggbb');
const coord = z.number().finite().min(LIMITS.coordMin).max(LIMITS.coordMax);
const point = z.tuple([coord, coord]);
const frac = z.number().finite().min(0).max(1);

const label = z
  .object({
    text: text(1, LIMITS.textMax),
    dx: z.number().finite().min(-2000).max(2000),
    dy: z.number().finite().min(-2000).max(2000),
    size: z.number().finite().min(10).max(64),
  })
  .strict();

const animNone = z.object({ kind: z.literal('none') }).strict();
const animMove = z
  .object({ kind: z.literal('move'), fromX: coord, fromY: coord, start: frac, end: frac })
  .strict()
  .refine((a) => a.start < a.end, { message: 'animation start must be before end' });
const animDraw = z
  .object({ kind: z.literal('draw'), start: frac, end: frac })
  .strict()
  .refine((a) => a.start < a.end, { message: 'animation start must be before end' });

const base = {
  id,
  factionId: id.nullable(),
  label: label.nullable(),
};

const figure = z
  .object({
    ...base,
    kind: z.literal('figure'),
    x: coord,
    y: coord,
    scale: z.number().finite().min(0.25).max(4),
    pose: z.enum(POSES),
    facing: z.union([z.literal(1), z.literal(-1)]),
    anim: z.union([animNone, animMove]),
  })
  .strict();
const prop = z
  .object({
    ...base,
    kind: z.literal('prop'),
    x: coord,
    y: coord,
    scale: z.number().finite().min(0.25).max(4),
    prop: z.enum(PROPS),
    anim: z.union([animNone, animMove]),
  })
  .strict();
const arrow = z
  .object({
    ...base,
    kind: z.literal('arrow'),
    points: z.array(point).min(2).max(12),
    width: z.number().finite().min(1).max(12),
    dashed: z.boolean(),
    anim: z.union([animNone, animDraw]),
  })
  .strict();
const region = z
  .object({
    ...base,
    kind: z.literal('region'),
    points: z.array(point).min(3).max(24),
    anim: z.union([animNone, animDraw]),
  })
  .strict();
const textObj = z
  .object({
    ...base,
    kind: z.literal('text'),
    x: coord,
    y: coord,
    text: text(1, LIMITS.textMax),
    size: z.number().finite().min(10).max(96),
    anim: z.union([animNone, animMove]),
  })
  .strict();

const object = z.discriminatedUnion('kind', [figure, prop, arrow, region, textObj]);

const intIn = (lo: number, hi: number) => z.number().int().min(lo).max(hi);

const canvas = z
  .object({ width: intIn(320, 4096), height: intIn(320, 4096), paper: color, ink: color })
  .strict();
const faction = z.object({ id, name: text(1, LIMITS.factionNameMax), color }).strict();

export const sceneSchemaV2 = z
  .object({
    schema: z.literal(SCHEMA),
    version: z.literal(VERSION),
    title: text(1, LIMITS.titleMax),
    seed: intIn(0, 4294967295),
    styleVersion: z.literal(STYLE_VERSION),
    canvas,
    safeArea: z
      .object({
        top: intIn(0, 400),
        right: intIn(0, 400),
        bottom: intIn(0, 400),
        left: intIn(0, 400),
      })
      .strict(),
    factions: z.array(faction).max(LIMITS.factions),
    objects: z.array(object).max(LIMITS.objects),
    animation: z.object({ durationMs: intIn(500, 20000) }).strict(),
    sample: z.boolean(),
    template: z.enum(TEMPLATE_IDS).nullable(),
  })
  .strict();

/** Version 1: no animation fields, a single-number safe area. */
const v1Object = z.union([
  figure.omit({ anim: true }),
  prop.omit({ anim: true }),
  arrow.omit({ anim: true }),
  region.omit({ anim: true }),
  textObj.omit({ anim: true }),
]);
const sceneSchemaV1 = z
  .object({
    schema: z.literal(SCHEMA),
    version: z.literal(1),
    title: text(1, LIMITS.titleMax),
    seed: intIn(0, 4294967295),
    styleVersion: z.literal(STYLE_VERSION),
    canvas,
    safeArea: intIn(0, 400),
    factions: z.array(faction).max(LIMITS.factions),
    objects: z.array(v1Object).max(LIMITS.objects),
    sample: z.boolean(),
  })
  .strict();

export type ValidationResult =
  { ok: true; scene: Scene; migratedFrom: number | null } | { ok: false; errors: string[] };

function issues(error: z.ZodError): string[] {
  return error.issues
    .slice(0, 20)
    .map((i) => `${i.path.length ? i.path.join('.') : '(root)'}: ${i.message}`);
}

/** Cross-record rules the schema cannot express. */
export function crossCheck(scene: Scene): string[] {
  const errors: string[] = [];
  const fids = new Set<string>();
  scene.factions.forEach((f, i) => {
    if (fids.has(f.id)) errors.push(`factions.${i}.id: duplicate id "${f.id}"`);
    fids.add(f.id);
  });
  const oids = new Set<string>();
  scene.objects.forEach((o, i) => {
    if (oids.has(o.id)) errors.push(`objects.${i}.id: duplicate id "${o.id}"`);
    oids.add(o.id);
    if (o.factionId !== null && !fids.has(o.factionId)) {
      errors.push(`objects.${i}.factionId: no faction "${o.factionId}"`);
    }
  });
  const s = scene.safeArea;
  if (s.left + s.right >= scene.canvas.width || s.top + s.bottom >= scene.canvas.height) {
    errors.push('safeArea: the safe area leaves no room on the canvas');
  }
  return errors;
}

export function migrateV1(v1: z.infer<typeof sceneSchemaV1>): Scene {
  const pad = v1.safeArea;
  return {
    ...v1,
    version: VERSION,
    safeArea: { top: pad, right: pad, bottom: pad, left: pad },
    animation: { durationMs: 4000 },
    template: null,
    objects: v1.objects.map((o) => ({ ...o, anim: { kind: 'none' } }) as Scene['objects'][number]),
  };
}

export function validateScene(value: unknown): ValidationResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, errors: ['(root): not a SceneForge scene (expected a JSON object)'] };
  }
  const v = value as { schema?: unknown; version?: unknown };
  if (v.schema !== SCHEMA) return { ok: false, errors: [`schema: expected "${SCHEMA}"`] };
  if (v.version === 1) {
    const r = sceneSchemaV1.safeParse(value);
    if (!r.success) return { ok: false, errors: issues(r.error) };
    const scene = migrateV1(r.data);
    const cross = crossCheck(scene);
    return cross.length > 0 ? { ok: false, errors: cross } : { ok: true, scene, migratedFrom: 1 };
  }
  if (v.version !== VERSION) {
    return {
      ok: false,
      errors: [
        typeof v.version === 'number' && v.version > VERSION
          ? `version: ${v.version} is newer than this SceneForge (${VERSION}); update the app`
          : 'version: unknown scene version',
      ],
    };
  }
  const r = sceneSchemaV2.safeParse(value);
  if (!r.success) return { ok: false, errors: issues(r.error) };
  const scene = r.data as Scene;
  const cross = crossCheck(scene);
  return cross.length > 0 ? { ok: false, errors: cross } : { ok: true, scene, migratedFrom: null };
}

export function parseSceneJson(textValue: string): ValidationResult {
  if (new TextEncoder().encode(textValue).length > LIMITS.fileBytes) {
    return { ok: false, errors: ['(file): larger than 2 MB'] };
  }
  let value: unknown;
  try {
    value = JSON.parse(textValue);
  } catch {
    return { ok: false, errors: ['(file): not valid JSON'] };
  }
  return validateScene(value);
}

export const OBJECT_KINDS = KINDS;
