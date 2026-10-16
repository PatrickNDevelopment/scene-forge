import { useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { labelBox, objectBox, renderScene, type Scene } from '../engine';
import { toReact } from './SvgView';

interface Props {
  scene: Scene;
  t: number;
  selectedId: string;
  showGuides: boolean;
  onSelect: (id: string) => void;
  onDrag: (id: string, part: 'object' | 'label', dx: number, dy: number, key: string) => void;
  onKey: (e: KeyboardEvent<HTMLDivElement>) => void;
}

interface DragState {
  id: string;
  part: 'object' | 'label';
  lastX: number;
  lastY: number;
  key: string;
}

/** Converts a pointer position to scene coordinates through the SVG's own transform. */
function toScene(svg: SVGSVGElement, clientX: number, clientY: number): [number, number] {
  const m = svg.getScreenCTM();
  if (!m) return [clientX, clientY];
  const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
  return [p.x, p.y];
}

export function Canvas({
  scene,
  t,
  selectedId,
  showGuides,
  onSelect,
  onDrag,
  onKey,
}: Props): ReactNode {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drag = useRef<DragState | null>(null);
  const tree = renderScene(scene, { t });
  const selected = scene.objects.find((o) => o.id === selectedId);
  const { width, height } = scene.canvas;
  const s = scene.safeArea;

  function onPointerDown(e: PointerEvent<SVGSVGElement>): void {
    const target = e.target as Element;
    const g = target.closest('[data-id]');
    if (!g || !svgRef.current) {
      onSelect('');
      return;
    }
    const id = g.getAttribute('data-id') ?? '';
    const part = target.closest('[data-role="label"]') ? 'label' : 'object';
    onSelect(id);
    const [x, y] = toScene(svgRef.current, e.clientX, e.clientY);
    drag.current = { id, part, lastX: x, lastY: y, key: `drag:${part}:${id}:${e.timeStamp}` };
    svgRef.current.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent<SVGSVGElement>): void {
    const d = drag.current;
    if (!d || !svgRef.current) return;
    const [x, y] = toScene(svgRef.current, e.clientX, e.clientY);
    const dx = Math.round(x - d.lastX);
    const dy = Math.round(y - d.lastY);
    if (dx === 0 && dy === 0) return;
    d.lastX += dx;
    d.lastY += dy;
    onDrag(d.id, d.part, dx, dy, d.key);
  }

  function onPointerUp(e: PointerEvent<SVGSVGElement>): void {
    drag.current = null;
    if (svgRef.current?.hasPointerCapture(e.pointerId))
      svgRef.current.releasePointerCapture(e.pointerId);
  }

  const box = selected ? objectBox(selected) : null;
  const lbox = selected ? labelBox(selected) : null;

  return (
    <div
      className="canvas-wrap"
      tabIndex={0}
      role="group"
      aria-label={`Scene canvas, ${scene.objects.length} objects. ${selected ? `Selected: ${selected.id}. Arrow keys move it, Alt plus arrows move its label, Delete removes it.` : 'Select an object in the list or on the canvas.'}`}
      aria-describedby="canvas-help"
      onKeyDown={onKey}
      data-testid="canvas"
    >
      <div className="canvas-inner" style={{ aspectRatio: `${width} / ${height}` }}>
        {toReact(tree, undefined, {
          ref: svgRef,
          className: 'scene-svg',
          onPointerDown,
          onPointerMove,
          onPointerUp,
          onPointerCancel: onPointerUp,
          role: 'img',
          'aria-label': scene.title,
          'data-testid': 'scene-svg',
          width: undefined,
          height: undefined,
        })}
        <svg
          className="overlay"
          viewBox={`0 0 ${width} ${height}`}
          aria-hidden="true"
          data-testid="overlay"
        >
          {showGuides ? (
            <rect
              x={s.left}
              y={s.top}
              width={Math.max(0, width - s.left - s.right)}
              height={Math.max(0, height - s.top - s.bottom)}
              className="safe-guide"
            />
          ) : null}
          {box ? (
            <rect
              x={box[0] - 4}
              y={box[1] - 4}
              width={box[2] - box[0] + 8}
              height={box[3] - box[1] + 8}
              className="sel-box"
            />
          ) : null}
          {lbox ? (
            <rect
              x={lbox[0] - 3}
              y={lbox[1] - 3}
              width={lbox[2] - lbox[0] + 6}
              height={lbox[3] - lbox[1] + 6}
              className="sel-label"
            />
          ) : null}
        </svg>
        {scene.objects.length === 0 ? (
          <p className="canvas-empty">
            Empty scene. Add an object, or pick a template in the gallery.
          </p>
        ) : null}
      </div>
    </div>
  );
}
