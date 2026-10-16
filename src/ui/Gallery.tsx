import { useMemo, type ReactNode } from 'react';
import {
  TEMPLATE_IDS,
  TEMPLATE_INFO,
  buildTemplate,
  renderScene,
  type Scene,
  type TemplateId,
} from '../engine';
import type { Preset } from '../lib/storage';
import { toReact } from './SvgView';

export function Gallery({
  presets,
  onTemplate,
  onPreset,
  onDeletePreset,
}: {
  presets: Preset[];
  onTemplate: (id: TemplateId) => void;
  onPreset: (scene: Scene) => void;
  onDeletePreset: (index: number) => void;
}): ReactNode {
  const thumbs = useMemo(
    () => TEMPLATE_IDS.map((id) => ({ id, tree: renderScene(buildTemplate(id, { seed: 1 })) })),
    [],
  );
  return (
    <div className="stack">
      <section className="panel" aria-labelledby="tpl-h">
        <h2 id="tpl-h">Templates</h2>
        <p className="help">
          Eight diagram templates with invented factions. They are illustrations, not maps of real
          places, and starting one replaces the scene in the editor (save it first if you need it).
        </p>
        <ul className="gallery" data-testid="templates">
          {thumbs.map(({ id, tree }) => (
            <li key={id} className="card">
              <div className="thumb">
                {toReact(tree, undefined, {
                  role: 'img',
                  'aria-label': `${TEMPLATE_INFO[id].title} preview`,
                  width: undefined,
                  height: undefined,
                })}
              </div>
              <h3>{TEMPLATE_INFO[id].title}</h3>
              <p className="help">{TEMPLATE_INFO[id].summary}</p>
              <button
                type="button"
                className="primary"
                onClick={() => onTemplate(id)}
                data-testid={`use-${id}`}
              >
                Use {TEMPLATE_INFO[id].title}
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section className="panel" aria-labelledby="pre-h">
        <h2 id="pre-h">Your presets ({presets.length})</h2>
        {presets.length === 0 ? (
          <p className="help">
            No presets yet. In the editor, use &ldquo;Save as preset&rdquo; to keep a scene here
            (this browser only).
          </p>
        ) : (
          <ul className="gallery" data-testid="presets">
            {presets.map((p, i) => (
              <li key={`${p.name}-${p.savedAt}`} className="card">
                <div className="thumb">
                  {toReact(renderScene(p.scene), undefined, {
                    role: 'img',
                    'aria-label': `${p.name} preview`,
                    width: undefined,
                    height: undefined,
                  })}
                </div>
                <h3>{p.name}</h3>
                <p className="help">Saved {p.savedAt.slice(0, 16).replace('T', ' ')} UTC</p>
                <div className="row">
                  <button type="button" className="primary" onClick={() => onPreset(p.scene)}>
                    Open {p.name}
                  </button>
                  <button type="button" onClick={() => onDeletePreset(i)}>
                    Delete {p.name}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function About(): ReactNode {
  return (
    <section className="panel prose">
      <h2>About SceneForge</h2>
      <p>
        SceneForge makes hand-drawn looking diagrams of stick figures, arrows, props and regions.
        Every stroke comes from a seeded generator, so the same scene file, style version and seed
        always produce exactly the same SVG.
      </p>
      <h3>What it is not</h3>
      <ul>
        <li>
          Templates and scenes are illustrations. They are not maps and are not geographically
          accurate.
        </li>
        <li>
          Template factions and labels are invented placeholders. No copyrighted characters or art
          are included.
        </li>
        <li>Visual QA estimates label sizes; it cannot see the final font rendering.</li>
      </ul>
      <h3>Keyboard</h3>
      <ul>
        <li>Pick an object in the object list (or Tab to the canvas and click one).</li>
        <li>
          On the canvas: arrow keys move the selected object (Shift: 10 px), Alt plus arrows move
          its label.
        </li>
        <li>
          Delete removes it, Escape clears the selection, Ctrl+Z undoes, Ctrl+Y or Ctrl+Shift+Z
          redoes.
        </li>
      </ul>
      <h3>Your data</h3>
      <p>
        Everything stays in this browser. Save the scene as JSON to keep it elsewhere; exports are
        plain SVG files.
      </p>
    </section>
  );
}
