import type { CSSProperties } from 'react';
import DrawnStrokes, { drawTotal, type Cap, type Stroke } from '@/components/drawing/DrawnStrokes';
import styles from './Vision.module.css';
import strokeData from './strokes.json';
import type { Step } from './steps';

const ART = strokeData as unknown as Record<Step['id'], { strokes: Stroke[]; caps: Cap[] }>;

/**
 * The figure's line drawing: strokes draw on, then the Figma raster — which
 * carries the dynamic-stroke texture, labels and №N — fades in over them.
 */
export default function FigureArt({ step }: { step: Step }) {
  const { strokes, caps } = ART[step.id];
  return (
    <div className={styles.art} style={{ '--draw-total': `${drawTotal(strokes.length)}ms` } as CSSProperties}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={styles.lines}
        src={step.figure.src}
        alt=""
        style={{ left: step.figure.left, top: step.figure.top, width: step.figure.width, height: step.figure.height }}
      />
      <DrawnStrokes className={styles.strokes} strokes={strokes} caps={caps} width={657} height={684} />
    </div>
  );
}
