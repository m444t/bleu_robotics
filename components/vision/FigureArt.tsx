import type { CSSProperties } from 'react';
import DrawnStrokes, { drawTotal, STROKE_WIDTH, type Cap, type Stroke } from '@/components/drawing/DrawnStrokes';
import styles from './Vision.module.css';
import strokeData from './strokes.json';
import type { Step } from './steps';

const ART = strokeData as unknown as Record<Step['id'], { strokes: Stroke[]; caps: Cap[] }>;
/** the labels' fade-in after the draw (.labels in Vision.module.css) */
const ART_FADE_MS = 320;

/** full length of a step's drawing, ms — the span Vision scrubs through on desktop */
export const artDuration = (step: Step) => drawTotal(ART[step.id].strokes.length) + ART_FADE_MS;

/* strokes that leave the panel through an edge run on straight (clipped wherever the grey stops) */
const EXTEND_PX = 2400;
const EXTENSIONS = Object.fromEntries(
  // (strokes.json also carries a `_source` note)
  Object.entries(ART).flatMap(([id, art]) => {
    if (!Array.isArray(art?.strokes)) return [];
    const runs = art.strokes.flatMap((s) => {
      if (/z\s*$/i.test(s.d)) return [];
      const n = s.d.match(/-?[\d.]+/g)!.map(Number);
      const ends = [
        [n[0], n[1]],
        [n[n.length - 2], n[n.length - 1]],
      ];
      return ends.flatMap(([x, y]) => {
        if (y <= 1) return [{ x, y, x2: x, y2: y - EXTEND_PX, s }];
        if (y >= 683) return [{ x, y, x2: x, y2: y + EXTEND_PX, s }];
        if (x <= 1) return [{ x, y, x2: x - EXTEND_PX, y2: y, s }];
        if (x >= 656) return [{ x, y, x2: x + EXTEND_PX, y2: y, s }];
        return [];
      });
    });
    return [[id, runs]];
  }),
) as Record<Step['id'], { x: number; y: number; x2: number; y2: number; s: Stroke }[]>;

/**
 * The figure's line drawing: strokes draw on and stay; then the labels — tags,
 * №N, markers, cut from the Figma raster by scripts/vision-labels.mjs — fade in.
 */
export default function FigureArt({ step, extend = false }: { step: Step; extend?: boolean }) {
  const { strokes, caps } = ART[step.id];
  return (
    <div className={styles.art} style={{ '--draw-total': `${drawTotal(strokes.length)}ms` } as CSSProperties}>
      <DrawnStrokes className={styles.strokes} strokes={strokes} caps={caps} width={657} height={684} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={styles.labels}
        src={step.figure.labels}
        alt=""
        style={{ left: step.figure.left, top: step.figure.top, width: step.figure.width, height: step.figure.height }}
      />
      {extend && (
        <svg className={styles.extensions} viewBox="0 0 657 684" aria-hidden>
          {EXTENSIONS[step.id].map(({ x, y, x2, y2, s }) => (
            <line
              key={`${x}-${y}-${x2}-${y2}`}
              x1={x}
              y1={y}
              x2={x2}
              y2={y2}
              stroke="#efefef"
              strokeWidth={STROKE_WIDTH}
              strokeDasharray={s.dash.length ? s.dash.join(' ') : undefined}
            />
          ))}
        </svg>
      )}
    </div>
  );
}
