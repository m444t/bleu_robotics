import { useId, type CSSProperties, type ReactNode } from 'react';
import styles from './DrawnStrokes.module.css';

export type Stroke = { d: string; sw: number; dash: number[]; join?: string };
export type Cap = { stroke: number; points: string };

export const DRAW_DELAY = 220;
export const DRAW_STAGGER = 70;
export const DRAW_DUR = 650;

export const drawTotal = (count: number, delay = DRAW_DELAY) => delay + (count - 1) * DRAW_STAGGER + DRAW_DUR;

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
            strokeWidth={s.sw}
            strokeDasharray={s.dash.length ? s.dash.join(' ') : undefined}
            strokeLinejoin={s.join === 'bevel' ? 'bevel' : 'miter'}
          />
          {caps
            .filter((c) => c.stroke === i)
            .map((c) => (
              <polygon key={c.points} points={c.points} />
            ))}
        </g>
      ))}
      {children}
    </svg>
  );
}
