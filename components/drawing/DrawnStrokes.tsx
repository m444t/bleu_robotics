import { useId, type CSSProperties, type ReactNode } from 'react';
import styles from './DrawnStrokes.module.css';

export type Stroke = { d: string; sw: number; dash: number[]; join?: string };
export type Cap = { stroke: number; points: string };

export const DRAW_DELAY = 220;
export const DRAW_STAGGER = 70;
export const DRAW_DUR = 650;

export const drawTotal = (count: number, delay = DRAW_DELAY) => delay + (count - 1) * DRAW_STAGGER + DRAW_DUR;

/** every drawn line on the site is this thick, whatever its source data says */
export const STROKE_WIDTH = 1.6;

/**
 * Arrow caps are drawn for their stroke's original width; like Figma's caps they
 * scale with the stroke, about the line end (the middle of their first edge).
 */
function scaleCap(points: string, k: number) {
  const p = points.split(' ').map((xy) => xy.split(',').map(Number));
  const cx = (p[0][0] + p[1][0]) / 2;
  const cy = (p[0][1] + p[1][1]) / 2;
  return p.map(([x, y]) => `${(cx + (x - cx) * k).toFixed(2)},${(cy + (y - cy) * k).toFixed(2)}`).join(' ');
}

/**
 * Stroke-by-stroke draw-on, in layer order. Each stroke is revealed by a solid
 * copy of its own path in a mask, so dashed strokes keep their dashes while
 * drawing on; its arrow caps ride inside the same mask. Remount (change `key`)
 * to replay.
 */
export default function DrawnStrokes({
  strokes,
  caps,
  width,
  height,
  delay = DRAW_DELAY,
  className,
  children,
}: {
  strokes: Stroke[];
  caps: Cap[];
  width: number;
  height: number;
  delay?: number;
  className?: string;
  /** extra artwork drawn on top (labels etc.), outside the masks */
  children?: ReactNode;
}) {
  const uid = useId();
  return (
    <svg className={className} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <defs>
        {strokes.map((s, i) => (
          <mask key={i} id={`${uid}-${i}`} maskUnits="userSpaceOnUse" x={-20} y={-20} width={width + 40} height={height + 40}>
            <path
              className={styles.draw}
              d={s.d}
              pathLength={1}
              fill="none"
              stroke="#fff"
              strokeWidth={18}
              style={{ '--delay': `${delay + i * DRAW_STAGGER}ms`, '--dur': `${DRAW_DUR}ms` } as CSSProperties}
            />
          </mask>
        ))}
      </defs>
      {strokes.map((s, i) => (
        <g key={i} mask={`url(#${uid}-${i})`} fill="#efefef">
          <path
            d={s.d}
            fill="none"
            stroke="#efefef"
            strokeWidth={STROKE_WIDTH}
            strokeDasharray={s.dash.length ? s.dash.join(' ') : undefined}
            strokeLinejoin={s.join === 'bevel' ? 'bevel' : 'miter'}
          />
          {caps
            .filter((c) => c.stroke === i)
            .map((c) => (
              <polygon key={c.points} points={scaleCap(c.points, STROKE_WIDTH / s.sw)} />
            ))}
        </g>
      ))}
      {children}
    </svg>
  );
}
