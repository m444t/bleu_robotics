'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import styles from './Careers.module.css';
import { EMPTY, JOBS } from './jobs';
import Robot from './Robot';

const DESIGN_W = 1440;
const WIDE_MIN = 1920;
const MOBILE_MAX = 767;
// the divider travels down to reveal a role, and back up before swapping roles
const OPEN_MS = 900;
const CLOSE_MS = 450;

/**
 * Open positions. Picking a role slides the panel's divider bar from the top
 * to the bottom; the role's text sits above the bar and is revealed with it.
 * Switching roles slides the bar back up, swaps the text, and slides it down.
 */
export default function Careers() {
  const rootRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [requested, setRequested] = useState<number | null>(null);
  const [shown, setShown] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  /* ---- scale the 1440-wide composition; mobile stacks instead ---- */
  useLayoutEffect(() => {
    const root = rootRef.current!;
    const fit = () => {
      const w = root.clientWidth;
      root.dataset.layout = w <= MOBILE_MAX ? 'mobile' : 'desktop';
      root.style.setProperty('--k', `${Math.min(w, WIDE_MIN) / DESIGN_W}`);
      // mobile: the bar travels exactly as far as the role's text is tall
      root.style.setProperty('--open-h', w <= MOBILE_MAX ? `${innerRef.current!.scrollHeight + 24}px` : '587px');
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(root);
    ro.observe(innerRef.current!);
    return () => ro.disconnect();
  }, []);

  // re-measure as soon as a role's text is in the DOM (mobile reveal height)
  useLayoutEffect(() => {
    const root = rootRef.current!;
    if (root.dataset.layout === 'mobile') root.style.setProperty('--open-h', `${innerRef.current!.scrollHeight + 24}px`);
  }, [shown]);

  /* ---- close → swap → open ---- */
  useEffect(() => {
    if (requested === null || requested === shown) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // the (always-mounted) content box transitions its height from 0, so the
    // new text and the open flag can land in the same render
    if (shown === null || reduced) {
      setShown(requested);
      setOpen(true);
      return;
    }
    setOpen(false);
    const t = window.setTimeout(() => {
      setShown(requested);
      setOpen(true);
    }, CLOSE_MS);
    return () => clearTimeout(t);
  }, [requested, shown]);

  const job = shown === null ? null : JOBS[shown];

  return (
    <section
      ref={rootRef}
      className={styles.careers}
      id="careers"
      aria-labelledby="careers-title"
      data-open={open ? 'true' : undefined}
      data-selected={job ? 'true' : undefined}
      style={{ '--open-ms': `${OPEN_MS}ms`, '--close-ms': `${CLOSE_MS}ms` } as CSSProperties}
    >
      <div className={styles.frame}>
        <div className={styles.canvas}>
          <h2 id="careers-title" className={styles.heading}>
            Open positions
          </h2>

          <ul className={styles.list}>
            {JOBS.map((j, i) => (
              <li key={j.code}>
                <button
                  type="button"
                  className={styles.item}
                  aria-pressed={requested === i}
                  aria-controls="careers-panel"
                  onClick={() => setRequested(i)}
                >
                  {j.title}
                </button>
              </li>
            ))}
          </ul>

          <p className={styles.note}>
            We hire researchers and engineers who want their work judged on a factory floor, not in a simulator.
          </p>

          <div className={styles.panel} id="careers-panel" aria-live="polite">
            <p className={styles.code}>[ {job ? job.code : EMPTY.code} ]</p>
            <span className={styles.swatches} aria-hidden>
              <i />
              <i />
              <i />
            </span>

            <div className={styles.content} aria-hidden={!open}>
              <div className={styles.inner} ref={innerRef}>
                {job && (
                  <>
                    <a className={styles.cta} href={job.href} tabIndex={open ? 0 : -1}>
                      <span className={styles.ctaLabel}>{job.title}</span>
                      <span className={styles.ctaArrow}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/icons/arrow-light.svg" alt="" width={16.25} height={12.5} />
                      </span>
                    </a>
                    <div className={styles.intro}>
                      {job.intro.map((p) => (
                        <p key={p}>{p}</p>
                      ))}
                    </div>
                    {job.lists.map((l) => (
                      <div key={l.heading} className={styles.group}>
                        <p className={styles.groupHeading}>{l.heading}</p>
                        <ul>
                          {l.items.map((it) => (
                            <li key={it}>▸ {it}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            <span className={styles.divider} aria-hidden />

            {/* idle state: the G1 follows the cursor; an opening role sweeps over it */}
            <Robot active={!open && requested === null} />

            <div className={styles.meta}>
              <p className={styles.tags}>{(job ? job.tags : EMPTY.tags).map((t) => `[ ${t} ]`).join('  ')}</p>
              <span className={styles.barcode} aria-hidden>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/careers/barcode.svg" alt="" width={312.599} height={31} />
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
