'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import DrawnStrokes, { drawTotal, type Cap, type Stroke } from '@/components/drawing/DrawnStrokes';
import art from './footer-art.json';
import styles from './Footer.module.css';

const DESIGN_W = 1440;
const WIDE_MIN = 1920;
const MOBILE_MAX = 767;
// Figma: footer 343 tall (312 band + 31 bar), extended 686 (655 + 31)
const COLLAPSED = 343;
const EXTENDED = 686;

const STROKES = art.strokes as Stroke[];
const CAPS = art.caps as Cap[];
const STEPS = ['teach', 'train', 'operate'] as const;

/**
 * Footer that grows as the page runs out: over the last (EXTENDED − COLLAPSED)
 * px of scroll its bottom stays on the viewport bottom while its top keeps
 * rising, so it opens upward and pushes the page up. Fully open, the drawing
 * on the right draws on (same technique as the Vision figures).
 */
export default function Footer() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [drawKey, setDrawKey] = useState(0);
  const [drawn, setDrawn] = useState(false);
  const drawnRef = useRef(false);

  const setDrawnState = (next: boolean) => {
    if (drawnRef.current === next) return;
    drawnRef.current = next;
    setDrawn(next);
    if (next) setDrawKey((k) => k + 1);
  };

  useLayoutEffect(() => {
    const track = trackRef.current!;
    let raf = 0;
    let k = 1;
    let mobile = false;

    const update = () => {
      raf = 0;
      if (mobile) return;
      const doc = document.documentElement;
      const toEnd = doc.scrollHeight - (window.scrollY + window.innerHeight);
      const span = (EXTENDED - COLLAPSED) * k;
      const p = Math.min(1, Math.max(0, (span - toEnd) / span));
      track.style.setProperty('--fp', `${p}`);
      if (p >= 0.98) setDrawnState(true);
      else if (p <= 0.02) setDrawnState(false);
    };
    const fit = () => {
      const w = track.clientWidth;
      mobile = w <= MOBILE_MAX;
      k = Math.min(w, WIDE_MIN) / DESIGN_W;
      track.dataset.layout = mobile ? 'mobile' : 'desktop';
      track.style.setProperty('--k', `${k}`);
      if (mobile) track.style.setProperty('--fp', '1');
      update();
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(track);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    // mobile: no growth, the drawing plays when the footer comes into view
    const io = new IntersectionObserver(([e]) => {
      if (mobile) setDrawnState(e.isIntersecting);
    }, { threshold: 0.3 });
    io.observe(track);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <div ref={trackRef} className={styles.track}>
      <footer className={styles.footer}>
        <div className={styles.frame}>
          <div className={styles.canvas}>
            <div className={styles.band}>
              <p className={styles.headline}>The AI that puts humanoids to work.</p>

              <div className={styles.graphic} aria-hidden>
                {drawn && (
                  <div
                    key={drawKey}
                    className={styles.art}
                    style={{ '--labels-at': `${drawTotal(STROKES.length)}ms` } as CSSProperties}
                  >
                    <DrawnStrokes
                      className={styles.svg}
                      strokes={STROKES}
                      caps={CAPS}
                      width={art.width}
                      height={art.height}
                    >
                      <g className={styles.labels}>
                        {art.labels.map((l) => (
                          <g key={l.text}>
                            <rect x={l.square[0]} y={l.square[1]} width={4.58} height={4.58} fill="#efefef" />
                            <text x={l.x} y={l.y + 6.9} className={styles.labelText}>
                              {l.text.toUpperCase()}
                            </text>
                          </g>
                        ))}
                      </g>
                    </DrawnStrokes>
                  </div>
                )}
              </div>

              <div className={styles.links}>
                <a href="mailto:contact@bleu-robotics.com">contact@bleu-robotics.com ↗</a>
                <a href="mailto:careers@bleu-robotics.com">careers@bleu-robotics.com ↗</a>
              </div>

              <div className={styles.hLine} aria-hidden>
                <span className={styles.capL} />
                <span className={styles.capR} />
              </div>
              <div className={styles.vLine} aria-hidden>
                <span className={styles.capT} />
                <span className={styles.capB} />
              </div>

              <div className={styles.cells}>
                {STEPS.map((s) => (
                  <div key={s} className={styles.cell}>
                    <span className={styles.cellIcon}>
                      <span />
                    </span>
                    <span className={styles.cellLabel}>{s}</span>
                  </div>
                ))}
                <div className={`${styles.cell} ${styles.logoCell}`}>
                  <span className={styles.logo} aria-label="Bleu">
                    <span className={styles.logoMark} />
                    <span className={styles.logoWord} />
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.bar}>
              <span className={styles.barNavy} />
              <span className={styles.barcode}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/footer/barcode.svg" alt="" width={433} height={31} />
              </span>
              <span className={styles.barText}>
                <span>©2026 Bleu Robotics, All rights reserved.</span>
                <span>Made by Tonik</span>
              </span>
              <span className={styles.barOrange} />
              <span className={styles.barYellow} />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
