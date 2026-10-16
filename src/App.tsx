import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import * as E from './engine';
import { download, slug } from './lib/files';
import {
  CORRUPT_KEY,
  SCENE_KEY,
  loadPresets,
  loadScene,
  savePresets,
  saveScene,
  type LoadResult,
  type Preset,
} from './lib/storage';
import { Canvas } from './ui/Canvas';
import { About, Gallery } from './ui/Gallery';
import { Inspector } from './ui/Inspector';
import { ObjectList, QaPanel, Timeline } from './ui/Panels';

type View = 'editor' | 'gallery' | 'about';
const VIEWS: { id: View; label: string }[] = [
  { id: 'editor', label: 'Editor' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'about', label: 'About' },
];

function viewFromHash(): View {
  const h = window.location.hash.replace(/^#\/?/, '');
  return VIEWS.find((v) => v.id === h)?.id ?? 'editor';
}

function initialScene(load: LoadResult): E.Scene {
  return load.kind === 'ok' ? load.scene : E.buildTemplate('encirclement', { seed: 1 });
}

function usePrefersReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return undefined;
    const on = (): void => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

export function App(): ReactNode {
  const [load] = useState<LoadResult>(loadScene);
  const [history, setHistory] = useState(() => E.createHistory(initialScene(load)));
  const [selectedId, setSelectedId] = useState('');
  const [view, setView] = useState<View>(viewFromHash);
  const [t, setT] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [guides, setGuides] = useState(true);
  const [notice, setNotice] = useState<{ kind: 'info' | 'error' | 'success'; text: string } | null>(
    load.kind === 'ok' && load.migrated
      ? { kind: 'info', text: 'Your saved scene was upgraded from format version 1.' }
      : null,
  );
  const [saveError, setSaveError] = useState('');
  const [presets, setPresets] = useState<Preset[]>(loadPresets);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const reducedMotion = usePrefersReducedMotion();
  const fileRef = useRef<HTMLInputElement>(null);
  const histRef = useRef(history);
  const scene = history.present;
  const selected = scene.objects.find((o) => o.id === selectedId);

  const commitHistory = useCallback((next: E.History) => {
    histRef.current = next;
    setHistory(next);
    setSaveError(
      E.validateScene(next.present).ok
        ? (saveScene(next.present) ?? '')
        : 'Internal error: refused to save an invalid scene.',
    );
  }, []);

  const apply = useCallback(
    (fn: (s: E.Scene) => E.Scene, key?: string) => {
      const h = histRef.current;
      const next = fn(h.present);
      if (next === h.present) return;
      setT(1);
      setPlaying(false);
      commitHistory(E.commit(h, next, key ?? null, performance.now()));
    },
    [commitHistory],
  );

  const replaceScene = useCallback(
    (next: E.Scene, message: string) => {
      setSelectedId('');
      setT(1);
      setPlaying(false);
      commitHistory(E.createHistory(next));
      setNotice({ kind: 'success', text: message });
    },
    [commitHistory],
  );

  // hash routing (works under the /scene-forge/ prefix on static hosting)
  useEffect(() => {
    const onHash = (): void => setView(viewFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const go = (v: View): void => {
    window.location.assign(`#/${v}`);
    setView(v);
  };

  // playback
  useEffect(() => {
    if (!playing || reducedMotion) return undefined;
    let raf = 0;
    let last = performance.now();
    const step = (now: number): void => {
      const dt = (now - last) / scene.animation.durationMs;
      last = now;
      setT((cur) => {
        const next = cur + dt;
        if (next >= 1) {
          setPlaying(false);
          return 1;
        }
        return next;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, reducedMotion, scene.animation.durationMs]);

  function undo(): void {
    if (!E.canUndo(histRef.current)) return;
    commitHistory(E.undo(histRef.current));
    setT(1);
  }
  function redo(): void {
    if (!E.canRedo(histRef.current)) return;
    commitHistory(E.redo(histRef.current));
    setT(1);
  }

  // global undo/redo shortcuts (not while typing in a field)
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent): void => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT'))
        return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (E.canUndo(histRef.current)) commitHistory(E.undo(histRef.current));
      } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
        e.preventDefault();
        if (E.canRedo(histRef.current)) commitHistory(E.redo(histRef.current));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [commitHistory]);

  function onCanvasKey(e: KeyboardEvent<HTMLDivElement>): void {
    if (!selected) return;
    const step = e.shiftKey ? 10 : 1;
    const dirs: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const d = dirs[e.key];
    if (d) {
      e.preventDefault();
      if (e.altKey)
        apply((s) => E.moveLabelBy(s, selected.id, d[0], d[1]), `key-label:${selected.id}`);
      else apply((s) => E.moveBy(s, selected.id, d[0], d[1]), `key-move:${selected.id}`);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      apply((s) => E.removeObject(s, selected.id));
      setSelectedId('');
    } else if (e.key === 'Escape') {
      setSelectedId('');
    }
  }

  async function onOpen(file: File | undefined): Promise<void> {
    if (!file) return;
    setImportErrors([]);
    if (file.size > E.LIMITS.fileBytes) {
      setImportErrors(['(file): larger than 2 MB']);
      return;
    }
    const r = E.parseSceneJson(await file.text());
    if (!r.ok) {
      setImportErrors(r.errors);
      return;
    }
    replaceScene(
      r.scene,
      r.migratedFrom !== null
        ? `Opened "${r.scene.title}" (upgraded from format version ${r.migratedFrom}).`
        : `Opened "${r.scene.title}".`,
    );
    go('editor');
  }

  const exportSvg = (animated: boolean): void => {
    const svg = E.serializeSvg(E.renderScene(scene, animated ? { animated: true } : {}));
    download(`${slug(scene.title)}${animated ? '-animated' : ''}.svg`, svg, 'image/svg+xml');
    setNotice({
      kind: 'success',
      text: `Exported ${animated ? 'an animated' : 'a static'} SVG (vector, editable).`,
    });
  };

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <header className="app-header">
        <div className="brand">
          <h1>SceneForge</h1>
          <p className="tagline">Deterministic hand-drawn SVG scenes</p>
        </div>
        <div className="chips">
          {scene.sample ? (
            <span className="chip chip-sample" data-testid="sample-indicator">
              Sample scene (synthetic)
            </span>
          ) : null}
          <span className="chip">Illustration, not a map</span>
        </div>
        <nav aria-label="Main" className="main-nav">
          <ul>
            {VIEWS.map((v) => (
              <li key={v.id}>
                <a
                  href={`#/${v.id}`}
                  aria-current={view === v.id ? 'page' : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    go(v.id);
                  }}
                >
                  {v.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <div className="banners">
        {load.kind === 'recovered' ? (
          <div className="banner banner-warn" role="alert">
            The saved scene could not be read ({load.errors.slice(0, 2).join('; ')}). A sample scene
            is shown instead; the unreadable copy is kept.{' '}
            <button
              type="button"
              className="link"
              onClick={() => download('scene-forge-unreadable.json', load.raw, 'application/json')}
            >
              Download the unreadable copy
            </button>
          </div>
        ) : null}
        {saveError ? (
          <p className="banner banner-error" role="alert" data-testid="save-failed">
            {saveError}
          </p>
        ) : null}
        <div
          className={notice ? `banner banner-${notice.kind}` : 'banner-empty'}
          role={notice?.kind === 'error' ? 'alert' : 'status'}
          data-testid="notice"
        >
          {notice ? (
            <>
              {notice.text}{' '}
              <button type="button" className="link" onClick={() => setNotice(null)}>
                Dismiss
              </button>
            </>
          ) : null}
        </div>
        {importErrors.length > 0 ? (
          <div className="banner banner-error" role="alert" data-testid="import-errors">
            <strong>That file was not opened.</strong>
            <ul>
              {importErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <main id="main" tabIndex={-1}>
        {view === 'editor' ? (
          <>
            <div className="toolbar" role="toolbar" aria-label="Scene actions">
              <button
                type="button"
                onClick={undo}
                disabled={!E.canUndo(history)}
                data-testid="undo"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={!E.canRedo(history)}
                data-testid="redo"
              >
                Redo
              </button>
              <button
                type="button"
                onClick={() =>
                  download(
                    `${slug(scene.title)}.scene.json`,
                    `${JSON.stringify(scene, null, 2)}\n`,
                    'application/json',
                  )
                }
              >
                Save JSON
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden-input"
                aria-label="Scene JSON file to open"
                data-testid="open-file"
                onChange={(e) => {
                  void onOpen(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <button type="button" onClick={() => fileRef.current?.click()}>
                Open JSON
              </button>
              <button type="button" className="primary" onClick={() => exportSvg(false)}>
                Export SVG
              </button>
              <button type="button" onClick={() => exportSvg(true)}>
                Export animated SVG
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = [
                    { name: scene.title, savedAt: new Date().toISOString(), scene },
                    ...presets,
                  ].slice(0, 20);
                  const err = savePresets(next);
                  if (err) setNotice({ kind: 'error', text: err });
                  else {
                    setPresets(next);
                    setNotice({
                      kind: 'success',
                      text: `Saved "${scene.title}" as a preset (see Gallery).`,
                    });
                  }
                }}
              >
                Save as preset
              </button>
              <label className="field inline">
                <input
                  type="checkbox"
                  checked={guides}
                  onChange={(e) => setGuides(e.target.checked)}
                />
                Safe-area guide
              </label>
            </div>
            <div className="editor">
              <div className="col-left">
                <ObjectList
                  scene={scene}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onAdd={(kind) => {
                    const r = E.addObject(histRef.current.present, kind);
                    if (r) {
                      apply(() => r.scene);
                      setSelectedId(r.id);
                    }
                  }}
                />
                <QaPanel scene={scene} onSelect={setSelectedId} />
              </div>
              <div className="col-main">
                <Canvas
                  scene={scene}
                  t={t}
                  selectedId={selectedId}
                  showGuides={guides}
                  onSelect={setSelectedId}
                  onDrag={(id, part, dx, dy, key) =>
                    apply(
                      (s) =>
                        part === 'label' ? E.moveLabelBy(s, id, dx, dy) : E.moveBy(s, id, dx, dy),
                      key,
                    )
                  }
                  onKey={onCanvasKey}
                />
                <p id="canvas-help" className="help">
                  Drag objects or their labels. Keyboard: select an object, focus the canvas, then
                  use the arrow keys (Shift for 10 px, Alt to move the label).
                </p>
                <Timeline
                  t={t}
                  playing={playing}
                  reducedMotion={reducedMotion}
                  durationMs={scene.animation.durationMs}
                  onT={(v) => {
                    setPlaying(false);
                    setT(v);
                  }}
                  onPlay={(p) => {
                    if (p && t >= 1) setT(0);
                    setPlaying(p);
                  }}
                />
              </div>
              <div className="col-right">
                <Inspector
                  key={scene.template ?? 'scene'}
                  scene={scene}
                  selected={selected}
                  apply={apply}
                  onSelect={setSelectedId}
                  onRegenerate={(seed) => {
                    const r = E.regenerate(histRef.current.present, seed);
                    if (r) {
                      apply(() => r);
                      setNotice({
                        kind: 'success',
                        text: `Regenerated the layout with seed ${seed}. Undo restores the previous one.`,
                      });
                    }
                  }}
                />
              </div>
            </div>
          </>
        ) : null}
        {view === 'gallery' ? (
          <Gallery
            presets={presets}
            onTemplate={(id) => {
              replaceScene(
                E.buildTemplate(id, { factions: E.DEFAULT_FACTIONS, seed: 1 }),
                `Started the ${E.TEMPLATE_INFO[id].title} template.`,
              );
              go('editor');
            }}
            onPreset={(s) => {
              replaceScene(s, `Opened preset "${s.title}".`);
              go('editor');
            }}
            onDeletePreset={(i) => {
              const next = presets.filter((_, k) => k !== i);
              savePresets(next);
              setPresets(next);
            }}
          />
        ) : null}
        {view === 'about' ? <About /> : null}
      </main>
      <footer className="app-footer">
        <p>
          SceneForge draws illustrations. Scenes are not geographically accurate maps. Storage keys:{' '}
          <code>{SCENE_KEY}</code> (unreadable copies: <code>{CORRUPT_KEY}</code>).
        </p>
      </footer>
    </>
  );
}
