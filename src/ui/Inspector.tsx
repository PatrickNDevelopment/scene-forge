import { useState, type ReactNode } from 'react';
import {
  POSES,
  PROPS,
  isPointObject,
  type Pose,
  type PropKind,
  type Scene,
  type SceneObject,
} from '../engine';
import * as E from '../engine';

interface Props {
  scene: Scene;
  selected: SceneObject | undefined;
  /** Applies an edit. `key` coalesces rapid edits of the same field into one undo step. */
  apply: (fn: (s: Scene) => Scene, key?: string) => void;
  onSelect: (id: string) => void;
  onRegenerate: (seed: number) => void;
}

/** A number input that commits on change and tolerates partial typing. */
function NumberField({
  label,
  value,
  onCommit,
  step = 1,
  min,
  max,
  testId,
}: {
  label: string;
  value: number;
  onCommit: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  testId?: string;
}): ReactNode {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label className="field">
      {label}
      <input
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        value={draft ?? String(value)}
        data-testid={testId}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value.trim() !== '' && Number.isFinite(n)) onCommit(n);
        }}
        onBlur={() => setDraft(null)}
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onCommit,
  maxLength,
  testId,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  maxLength: number;
  testId?: string;
}): ReactNode {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label className="field">
      {label}
      <input
        value={draft ?? value}
        maxLength={maxLength}
        data-testid={testId}
        onChange={(e) => {
          setDraft(e.target.value);
          if (e.target.value.trim() !== '') onCommit(e.target.value);
        }}
        onBlur={() => setDraft(null)}
      />
    </label>
  );
}

export function Inspector({ scene, selected, apply, onSelect, onRegenerate }: Props): ReactNode {
  const [regenSeed, setRegenSeed] = useState(String((scene.seed + 1) % 4294967296));

  if (!selected) {
    return (
      <section className="panel" aria-labelledby="inspector-h">
        <h2 id="inspector-h">Scene</h2>
        <TextField
          label="Title"
          value={scene.title}
          maxLength={120}
          testId="scene-title"
          onCommit={(v) => apply((s) => E.setTitle(s, v), 'title')}
        />
        <NumberField
          label="Style seed (hand-drawn jitter)"
          value={scene.seed}
          min={0}
          max={4294967295}
          testId="style-seed"
          onCommit={(v) => apply((s) => E.setSeed(s, Math.trunc(v)), 'seed')}
        />
        <NumberField
          label="Animation length (ms)"
          value={scene.animation.durationMs}
          min={500}
          max={20000}
          step={100}
          onCommit={(v) => apply((s) => E.setDuration(s, v), 'duration')}
        />
        {scene.template !== null ? (
          <fieldset className="group">
            <legend>Regenerate layout</legend>
            <p className="help">
              Rebuilds the {scene.template} template with a new seed. Factions, title and labels you
              moved are kept.
            </p>
            <div className="row">
              <label className="field inline">
                Layout seed
                <input
                  type="number"
                  min={0}
                  max={4294967295}
                  value={regenSeed}
                  onChange={(e) => setRegenSeed(e.target.value)}
                  data-testid="regen-seed"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  const n = Number(regenSeed);
                  if (Number.isInteger(n) && n >= 0 && n <= 4294967295) onRegenerate(n);
                }}
              >
                Regenerate
              </button>
            </div>
          </fieldset>
        ) : null}
        <fieldset className="group">
          <legend>Factions</legend>
          {scene.factions.length === 0 ? (
            <p className="help">No factions. Objects use the ink colour.</p>
          ) : null}
          <ul className="plain">
            {scene.factions.map((f) => (
              <li key={f.id} className="faction-row">
                <TextField
                  label={`Name of ${f.id}`}
                  value={f.name}
                  maxLength={40}
                  testId={`faction-name-${f.id}`}
                  onCommit={(v) =>
                    apply((s) => E.renameFaction(s, f.id, v), `faction-name:${f.id}`)
                  }
                />
                <label className="field inline">
                  Colour
                  <input
                    type="color"
                    value={f.color}
                    data-testid={`faction-color-${f.id}`}
                    onChange={(e) =>
                      apply(
                        (s) => E.recolorFaction(s, f.id, e.target.value),
                        `faction-color:${f.id}`,
                      )
                    }
                  />
                </label>
                <button type="button" onClick={() => apply((s) => E.removeFaction(s, f.id))}>
                  Remove {f.name}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => apply((s) => E.addFaction(s))}
            disabled={scene.factions.length >= 8}
          >
            Add faction
          </button>
        </fieldset>
        <p className="help">Select an object on the canvas or in the object list to edit it.</p>
      </section>
    );
  }

  const o = selected;
  const id = o.id;
  return (
    <section className="panel" aria-labelledby="inspector-h">
      <div className="row between">
        <h2 id="inspector-h">
          {o.kind} <code>{id}</code>
        </h2>
        <button type="button" onClick={() => onSelect('')}>
          Done
        </button>
      </div>

      {isPointObject(o) ? (
        <div className="grid2">
          <NumberField
            label="X"
            value={o.x}
            testId="obj-x"
            onCommit={(v) => apply((s) => E.moveTo(s, id, v, o.y), `x:${id}`)}
          />
          <NumberField
            label="Y"
            value={o.y}
            testId="obj-y"
            onCommit={(v) => apply((s) => E.moveTo(s, id, o.x, v), `y:${id}`)}
          />
        </div>
      ) : (
        <p className="help">
          {o.points.length} points. Drag the shape or use the arrow keys on the canvas to move it.
        </p>
      )}
      <div className="row" role="group" aria-label="Nudge">
        <button
          type="button"
          aria-label="Move left 10"
          onClick={() => apply((s) => E.moveBy(s, id, -10, 0), `nudge:${id}`)}
        >
          &larr;
        </button>
        <button
          type="button"
          aria-label="Move up 10"
          onClick={() => apply((s) => E.moveBy(s, id, 0, -10), `nudge:${id}`)}
        >
          &uarr;
        </button>
        <button
          type="button"
          aria-label="Move down 10"
          onClick={() => apply((s) => E.moveBy(s, id, 0, 10), `nudge:${id}`)}
        >
          &darr;
        </button>
        <button
          type="button"
          aria-label="Move right 10"
          onClick={() => apply((s) => E.moveBy(s, id, 10, 0), `nudge:${id}`)}
        >
          &rarr;
        </button>
      </div>

      {o.kind === 'figure' || o.kind === 'prop' ? (
        <NumberField
          label="Scale"
          value={o.scale}
          step={0.05}
          min={0.25}
          max={4}
          onCommit={(v) => apply((s) => E.setScale(s, id, v), `scale:${id}`)}
        />
      ) : null}
      {o.kind === 'figure' ? (
        <div className="grid2">
          <label className="field">
            Pose
            <select
              value={o.pose}
              onChange={(e) => apply((s) => E.setPose(s, id, e.target.value as Pose))}
            >
              {POSES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => apply((s) => E.flip(s, id))}>
            Face {o.facing === 1 ? 'left' : 'right'}
          </button>
        </div>
      ) : null}
      {o.kind === 'prop' ? (
        <label className="field">
          Prop
          <select
            value={o.prop}
            onChange={(e) => apply((s) => E.setProp(s, id, e.target.value as PropKind))}
          >
            {PROPS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
      ) : null}
      {o.kind === 'arrow' ? (
        <div className="grid2">
          <NumberField
            label="Width"
            value={o.width}
            min={1}
            max={12}
            onCommit={(v) => apply((s) => E.setWidth(s, id, v), `width:${id}`)}
          />
          <label className="field inline">
            <input
              type="checkbox"
              checked={o.dashed}
              onChange={(e) => apply((s) => E.setDashed(s, id, e.target.checked))}
            />
            Dashed
          </label>
        </div>
      ) : null}
      {o.kind === 'text' ? (
        <>
          <TextField
            label="Text"
            value={o.text}
            maxLength={200}
            onCommit={(v) => apply((s) => E.setText(s, id, v), `text:${id}`)}
          />
          <NumberField
            label="Text size"
            value={o.size}
            min={10}
            max={96}
            onCommit={(v) => apply((s) => E.setSize(s, id, v), `size:${id}`)}
          />
        </>
      ) : null}

      <label className="field">
        Faction (colour)
        <select
          value={o.factionId ?? ''}
          data-testid="obj-faction"
          onChange={(e) =>
            apply((s) => E.setFaction(s, id, e.target.value === '' ? null : e.target.value))
          }
        >
          <option value="">None (ink)</option>
          {scene.factions.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="group">
        <legend>Label</legend>
        {o.label === null ? (
          <button type="button" onClick={() => apply((s) => E.setLabel(s, id, { text: 'Label' }))}>
            Add label
          </button>
        ) : (
          <>
            <TextField
              label="Label text"
              value={o.label.text}
              maxLength={200}
              testId="label-text"
              onCommit={(v) => apply((s) => E.setLabel(s, id, { text: v }), `label-text:${id}`)}
            />
            <div className="grid3">
              <NumberField
                label="Offset X"
                value={o.label.dx}
                testId="label-dx"
                onCommit={(v) => apply((s) => E.setLabel(s, id, { dx: v }), `label-dx:${id}`)}
              />
              <NumberField
                label="Offset Y"
                value={o.label.dy}
                testId="label-dy"
                onCommit={(v) => apply((s) => E.setLabel(s, id, { dy: v }), `label-dy:${id}`)}
              />
              <NumberField
                label="Size"
                value={o.label.size}
                min={10}
                max={64}
                onCommit={(v) => apply((s) => E.setLabel(s, id, { size: v }), `label-size:${id}`)}
              />
            </div>
            <button type="button" onClick={() => apply((s) => E.setLabel(s, id, null))}>
              Remove label
            </button>
          </>
        )}
      </fieldset>

      <fieldset className="group">
        <legend>Animation</legend>
        {o.anim.kind === 'none' ? (
          <button type="button" onClick={() => apply((s) => E.setAnimDefault(s, id))}>
            {isPointObject(o) ? 'Add movement' : 'Add draw-on'}
          </button>
        ) : (
          <>
            <p className="help">
              {o.anim.kind === 'move'
                ? `Moves in from (${Math.round(o.anim.fromX)}, ${Math.round(o.anim.fromY)}).`
                : 'Draws itself on.'}
            </p>
            <div className="grid2">
              <NumberField
                label="Start (0 to 1)"
                value={o.anim.start}
                step={0.05}
                min={0}
                max={0.95}
                onCommit={(v) =>
                  apply(
                    (s) => E.setAnimTiming(s, id, v, o.anim.kind === 'none' ? 1 : o.anim.end),
                    `anim:${id}`,
                  )
                }
              />
              <NumberField
                label="End (0 to 1)"
                value={o.anim.end}
                step={0.05}
                min={0.05}
                max={1}
                onCommit={(v) =>
                  apply(
                    (s) => E.setAnimTiming(s, id, o.anim.kind === 'none' ? 0 : o.anim.start, v),
                    `anim:${id}`,
                  )
                }
              />
            </div>
            <button type="button" onClick={() => apply((s) => E.setAnimNone(s, id))}>
              Remove animation
            </button>
          </>
        )}
      </fieldset>

      <div className="row">
        <button
          type="button"
          onClick={() => {
            const r = E.duplicateObject(scene, id);
            if (r) {
              apply(() => r.scene);
              onSelect(r.id);
            }
          }}
        >
          Duplicate
        </button>
        <button type="button" onClick={() => apply((s) => E.reorder(s, id, 1))}>
          Bring forward
        </button>
        <button type="button" onClick={() => apply((s) => E.reorder(s, id, -1))}>
          Send backward
        </button>
        <button
          type="button"
          className="danger"
          onClick={() => {
            apply((s) => E.removeObject(s, id));
            onSelect('');
          }}
        >
          Delete
        </button>
      </div>
    </section>
  );
}
