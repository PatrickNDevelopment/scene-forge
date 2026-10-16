import { useState, type ReactNode } from 'react';
import { runQa, type NewKind, type Scene } from '../engine';

export function ObjectList({
  scene,
  selectedId,
  onSelect,
  onAdd,
}: {
  scene: Scene;
  selectedId: string;
  onSelect: (id: string) => void;
  onAdd: (kind: NewKind) => void;
}): ReactNode {
  const [kind, setKind] = useState<NewKind>('figure');
  return (
    <section className="panel" aria-labelledby="objects-h">
      <h2 id="objects-h">Objects ({scene.objects.length})</h2>
      <div className="row">
        <label className="field inline">
          New
          <select value={kind} onChange={(e) => setKind(e.target.value as NewKind)}>
            <option value="figure">Stick figure</option>
            <option value="prop">Prop</option>
            <option value="arrow">Arrow</option>
            <option value="region">Region</option>
            <option value="text">Text</option>
          </select>
        </label>
        <button type="button" onClick={() => onAdd(kind)} disabled={scene.objects.length >= 300}>
          Add
        </button>
      </div>
      {scene.objects.length === 0 ? (
        <p className="help">No objects yet.</p>
      ) : (
        <ul className="plain object-list" data-testid="object-list">
          {scene.objects.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                className={o.id === selectedId ? 'pick selected' : 'pick'}
                aria-pressed={o.id === selectedId}
                onClick={() => onSelect(o.id)}
                data-testid={`pick-${o.id}`}
              >
                <span className="kind">{o.kind}</span> {o.id}
                {o.label ? (
                  <span className="muted"> &ldquo;{o.label.text.slice(0, 24)}&rdquo;</span>
                ) : null}
                {o.kind === 'text' ? (
                  <span className="muted"> &ldquo;{o.text.slice(0, 24)}&rdquo;</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function QaPanel({
  scene,
  onSelect,
}: {
  scene: Scene;
  onSelect: (id: string) => void;
}): ReactNode {
  const findings = runQa(scene);
  return (
    <section className="panel" aria-labelledby="qa-h">
      <h2 id="qa-h">Visual QA ({findings.length})</h2>
      <p className="help">
        Label sizes are estimated (no font metrics), so overlap checks are approximate.
      </p>
      {findings.length === 0 ? (
        <p data-testid="qa-clear">No problems found.</p>
      ) : (
        <ul className="plain qa-list" data-testid="qa-list">
          {findings.map((f, i) => (
            <li key={`${f.code}-${f.objectId}-${f.otherId ?? ''}-${i}`}>
              <code>{f.code}</code> {f.message}{' '}
              {f.objectId ? (
                <button type="button" className="link" onClick={() => onSelect(f.objectId ?? '')}>
                  Select {f.objectId}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function Timeline({
  t,
  playing,
  reducedMotion,
  durationMs,
  onT,
  onPlay,
}: {
  t: number;
  playing: boolean;
  reducedMotion: boolean;
  durationMs: number;
  onT: (t: number) => void;
  onPlay: (play: boolean) => void;
}): ReactNode {
  return (
    <section className="panel timeline" aria-labelledby="time-h">
      <h2 id="time-h">Animation</h2>
      <div className="row">
        <button
          type="button"
          onClick={() => onPlay(!playing)}
          disabled={reducedMotion}
          aria-describedby="motion-note"
          data-testid="play"
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <label className="field inline grow">
          Time
          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round(t * 1000)}
            onChange={(e) => onT(Number(e.target.value) / 1000)}
            data-testid="scrub"
            aria-valuetext={`${Math.round(t * durationMs)} of ${durationMs} ms`}
          />
        </label>
        <output data-testid="time-out">{Math.round(t * durationMs)} ms</output>
        <button type="button" onClick={() => onT(1)}>
          End
        </button>
      </div>
      <p id="motion-note" className="help" data-testid="motion-note">
        {reducedMotion
          ? 'Your system asks for reduced motion, so playback is off. Use the slider to step through the animation.'
          : 'Movement and draw-on animations. Editing always shows the final frame.'}
      </p>
    </section>
  );
}
