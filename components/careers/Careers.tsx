'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import styles from './Careers.module.css';
import { EMPTY, JOBS, type Job } from './jobs';
import Robot from './Robot';
import { ease } from '@/lib/motion';

const DESIGN_W = 1440;
const WIDE_MIN = 1920;
const MOBILE_MAX = 767;
// the divider travels down to reveal a role, and back up before swapping roles
const OPEN_MS = 900;
const CLOSE_MS = 450;

// the readout (code + tags) ticks to a new text like the hero's 000-000-255 counter
const TICK_MS = 700;
const GLYPHS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const tagLine = (tags: string[]) => tags.map((t) => `[ ${t} ]`).join('  ');

/**
 * close → swap → open. Asking for something new first closes what's shown (the
 * divider slides back up), then swaps it in, and a moment later opens it (the
 * divider slides down), so the new content always reveals from closed.
 * Asking for null just closes.
 */
function useReveal<T>(requested: T | null) {
  const [shown, setShown] = useState<T | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (requested === shown) {
      // asked again for what's still shown (e.g. mid-close): just reopen it
      if (shown !== null) setOpen(true);
      return;
    }
    if (shown === null || reducedMotion()) {
      setShown(requested);
      return;
    }
    setOpen(false);
    const t = window.setTimeout(() => setShown(requested), CLOSE_MS);
    return () => clearTimeout(t);
  }, [requested, shown]);

  // a beat after the swap, open — the new content is in place, closed, by then
  useEffect(() => {
    if (shown === null) return;
    const t = window.setTimeout(() => setOpen(true), 30);
    return () => clearTimeout(t);
  }, [shown]);

  return { shown, open };
}

/**
 * Text t (0 → 1) of the way from a to b: each character counts up or down
 * through 0–9, A–Z to its new value, as the hero's readout counts to 255.
 * Characters off that scale (brackets, spaces) count from / to 0 and flip at
 * the end.
 */
function tick(a: string, b: string, t: number) {
  if (t >= 1) return b;
  let out = '';
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const ca = a[i] ?? ' ';
    const cb = b[i] ?? ' ';
    // the readout is set in caps, so letters count on one scale whatever their case
    const ra = GLYPHS.indexOf(ca.toUpperCase());
    const rb = GLYPHS.indexOf(cb.toUpperCase());
    if (ca === cb || (ra < 0 && rb < 0)) out += t < 0.5 ? ca : cb;
    else out += GLYPHS[Math.round(Math.max(ra, 0) + (Math.max(rb, 0) - Math.max(ra, 0)) * t)];
  }
  return out;
}

/** Renders `text`, ticking over from whatever it showed before. */
function Ticker({ text }: { text: string }) {
  const [shown, setShown] = useState(text);
  const shownRef = useRef(text);

  useEffect(() => {
    const from = shownRef.current;
    if (from === text) return;
    const set = (s: string) => {
      shownRef.current = s;
      setShown(s);
    };
    if (reducedMotion()) return set(text);
    const t0 = performance.now();
    let raf = requestAnimationFrame(function step(now) {
      const p = Math.min(1, (now - t0) / TICK_MS);
      set(tick(from, text, ease(p)));
      if (p < 1) raf = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(raf);
  }, [text]);

  return shown;
}

/**
 * Open positions.
 * Desktop (Figma 398:1394): picking a role slides the panel's divider bar from
 * the top to the bottom; the role's text sits above the bar and is revealed
 * with it. Switching roles slides the bar back up, swaps the text, and slides
 * it down again.
 * Mobile (Figma 517:3860): an accordion — a role card opens in place, and
 * "More info" / "Back to description" swap its text with the same divider move.
 */
export default function Careers() {
  const rootRef = useRef<HTMLElement>(null);
  const [layout, setLayout] = useState<'desktop' | 'mobile'>('desktop');

  /* ---- scale the 1440-wide composition; mobile stacks instead ---- */
  useLayoutEffect(() => {
    const root = rootRef.current!;
    const fit = () => {
      const w = root.clientWidth;
      setLayout(w <= MOBILE_MAX ? 'mobile' : 'desktop');
      root.style.setProperty('--k', `${Math.min(w, WIDE_MIN) / DESIGN_W}`);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  return (
    <section
      ref={rootRef}
      className={styles.careers}
      id="careers"
      aria-labelledby="careers-title"
      data-layout={layout}
      style={{ '--open-ms': `${OPEN_MS}ms`, '--close-ms': `${CLOSE_MS}ms` } as CSSProperties}
    >
      {layout === 'desktop' ? <DesktopCareers /> : <MobileCareers />}
    </section>
  );
}

const Note = () => (
  <p className={styles.note}>
    We hire researchers and engineers who want their work judged on a factory floor, not in a simulator.
  </p>
);

const Lists = ({ job }: { job: Job }) =>
  job.lists.map((l) => (
    <div key={l.heading} className={styles.group}>
      <p className={styles.groupHeading}>{l.heading}</p>
      <ul>
        {l.items.map((it) => (
          <li key={it}>▸ {it}</li>
        ))}
      </ul>
    </div>
  ));

const Intro = ({ job }: { job: Job }) => (
  <div className={styles.intro}>
    {job.intro.map((p) => (
      <p key={p}>{p}</p>
    ))}
  </div>
);

function DesktopCareers() {
  const [requested, setRequested] = useState<number | null>(null);
  const { shown, open } = useReveal(requested);
  const job = shown === null ? null : JOBS[shown];
  // with no role open, hovering one previews its code + tags in the readout
  const [hovered, setHovered] = useState<number | null>(null);
  const readout = job ?? (requested === null && hovered !== null ? JOBS[hovered] : EMPTY);

  return (
    <div className={styles.frame} data-open={open ? 'true' : undefined}>
      <div className={styles.canvas}>
        {/* left column: heading + role cards at the top, the note at the bottom */}
        <div className={styles.side}>
          <div className={styles.sideTop}>
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
                    // clicking the open role again closes it, back to the robot
                    onClick={() => setRequested((r) => (r === i ? null : i))}
                    onPointerEnter={(e) => e.pointerType === 'mouse' && setHovered(i)}
                    onPointerLeave={() => setHovered(null)}
                  >
                    <span className={styles.itemTitle}>{j.title} ↗</span>
                    <span className={styles.itemTags}>{tagLine(j.tags)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <Note />
        </div>

        <div className={styles.panel} id="careers-panel" aria-live="polite">
          <div className={styles.head}>
            <p className={styles.code}>
              <Ticker text={`[ ${readout.code} ]`} />
            </p>
            <span className={styles.swatches} aria-hidden>
              <i />
              <i />
              <i />
            </span>
          </div>

          <div className={styles.content} aria-hidden={!open}>
            <div className={styles.inner}>
              {job && (
                <>
                  <a className={styles.cta} href={job.href} tabIndex={open ? 0 : -1}>
                    <span className={styles.ctaLabel}>{job.title}</span>
                    <span className={styles.ctaArrow}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/icons/arrow-light.svg" alt="" width={16.25} height={12.5} />
                    </span>
                  </a>
                  <Intro job={job} />
                  <Lists job={job} />
                </>
              )}
            </div>
          </div>

          {/* idle state: the G1 follows the cursor; an opening role sweeps over it */}
          <Robot active={!open && requested === null} />

          <span className={styles.divider} aria-hidden />

          <div className={styles.foot}>
            <div className={styles.meta}>
              <p className={styles.tags}>
                <Ticker text={tagLine(readout.tags)} />
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.barcode} src="/careers/barcode.svg" alt="" width={312.599} height={21} />
            </div>
            <button
              type="button"
              className={styles.next}
              aria-controls="careers-panel"
              onClick={() => setRequested(((shown ?? -1) + 1) % JOBS.length)}
            >
              Read next offer →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type View = 'desc' | 'more';

function MobileCareers() {
  // `${role}:${view}` — a string, so asking for the same card + view twice is a no-op
  const [requested, setRequested] = useState<string | null>(null);
  const { shown, open } = useReveal(requested);
  const [si, sview] = shown ? (shown.split(':') as [string, View]) : [null, null];
  const innerRef = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(0);

  // the divider travels exactly as far as the swapped-in text is tall
  useLayoutEffect(() => {
    if (innerRef.current) setH(innerRef.current.scrollHeight);
  }, [shown]);

  return (
    <div className={styles.m}>
      <div className={styles.mIntro}>
        <h2 id="careers-title" className={styles.heading}>
          Open positions
        </h2>
        <Note />
      </div>

      <ul className={styles.mList}>
        {JOBS.map((j, i) =>
          String(i) === si ? (
            <li
              key={j.code}
              className={styles.mCard}
              data-open={open ? 'true' : undefined}
              style={{ '--h': `${h}px` } as CSSProperties}
            >
              <button type="button" className={styles.mCardHead} aria-expanded onClick={() => setRequested(null)}>
                <span className={styles.itemTitle}>{j.title} ↗</span>
                <span className={styles.itemTags}>{tagLine(j.tags)}</span>
              </button>

              <div className={styles.mContent} aria-hidden={!open}>
                <div className={styles.mInner} ref={innerRef}>
                  {sview === 'more' ? <Lists job={j} /> : <Intro job={j} />}
                </div>
              </div>

              <span className={styles.divider} aria-hidden />

              <div className={styles.mFoot}>
                <button
                  type="button"
                  className={styles.mMore}
                  onClick={() => setRequested(`${i}:${sview === 'more' ? 'desc' : 'more'}`)}
                >
                  {sview === 'more' ? '← Back to description' : 'More info'}
                </button>
                <a className={styles.mApply} href={j.href}>
                  Apply →
                </a>
              </div>
            </li>
          ) : (
            <li key={j.code}>
              <button
                type="button"
                className={styles.item}
                aria-expanded={false}
                onClick={() => setRequested(`${i}:desc`)}
              >
                <span className={styles.itemTitle}>{j.title} ↗</span>
                <span className={styles.itemTags}>{tagLine(j.tags)}</span>
              </button>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
