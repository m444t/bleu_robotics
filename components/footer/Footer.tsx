'use client';

import { useLayoutEffect, useRef } from 'react';
import styles from './Footer.module.css';

const DESIGN_W = 1440;
const WIDE_MIN = 1920;
const MOBILE_MAX = 767;
// Figma 522:4484 is 610 open (555 band + 55 bar); without its drawing the footer opens to
// 351 (20% under the 439 it had), from the same 267 closed
const COLLAPSED = 267;
const EXTENDED = 351;

const STEPS = ['teach', 'train', 'operate'] as const;

/**
 * Footer that grows as the page runs out: over the last (EXTENDED − COLLAPSED)
 * px of scroll its bottom stays on the viewport bottom while its top keeps
 * rising, so it opens upward and pushes the page up.
 */
export default function Footer() {
  const trackRef = useRef<HTMLDivElement>(null);

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
    };
    const fit = () => {
      const w = track.clientWidth;
      mobile = w <= MOBILE_MAX;
      k = Math.min(w, WIDE_MIN) / DESIGN_W;
      track.dataset.layout = mobile ? 'mobile' : 'desktop';
      track.style.setProperty('--k', `${k}`);
      // past 1920 the frame stops growing: the margin beside it, in design px, for the lines to reach the page edges
      track.style.setProperty('--gutter', `${(w - DESIGN_W * k) / 2 / k}px`);
      // content inset: Figma's 32 at 1440, easing to 92 by 1920 so the footer lines up with the
      // careers column above; --d is the extra, taken in on both sides
      const wide = Math.min(1, Math.max(0, (w - DESIGN_W) / (WIDE_MIN - DESIGN_W)));
      track.style.setProperty('--wide', `${wide}`);
      track.style.setProperty('--d', `${60 * wide}px`);
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

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
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
              {/* desktop: contact top left, careers in the right panel (left-aligned); mobile: stacked */}
              <div className={styles.links}>
                <a href="mailto:contact@bleu-robotics.com">contact@bleu-robotics.com ↗</a>
                <a className={styles.careersLink} href="mailto:careers@bleu-robotics.com">
                  careers@bleu-robotics.com ↗
                </a>
              </div>

              <div className={styles.hLine} aria-hidden>
                <span className={styles.capL} />
                <span className={styles.capR} />
              </div>
              <div className={`${styles.hLine} ${styles.hLineLow}`} aria-hidden>
                <span className={styles.capL} />
                <span className={styles.capR} />
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
                  <span className={styles.logo} role="img" aria-label="Bleu" />
                </div>
              </div>
            </div>

            <div className={styles.bar}>
              <span className={styles.barcode}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/footer/barcode.svg" alt="" width={433} height={31} />
              </span>
              <span className={styles.barText}>©2026 Bleu Robotics, All rights reserved.</span>
              <span className={styles.barOrange} />
              <span className={styles.barYellow} />
            </div>

            {/* runs the full height, over the cells row and the bar */}
            <div className={styles.vLine} aria-hidden>
              <span className={styles.capT} />
              <span className={styles.capB} />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
