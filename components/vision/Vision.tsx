'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { EASE_CSS } from '@/lib/motion';
import styles from './Vision.module.css';
import { IDLE_BUTTONS, STEPS } from './steps';
import FigureArt from './FigureArt';

const DESIGN_W = 1440;
const DESIGN_H = 762;
const MOBILE_MAX = 767;
const WIDE_MIN = 1920; // composition stops growing here and stays centred
const FOLLOW_MAX = 16; // px, blue box travel each way
const IDLE_MS = 2000;

/*
 * Figure appear: the blue box stays at full size (it only fades in when the
 * section is reached); the grey panel — and the lines that run past the box —
 * open outward from the box edges while the strokes draw on.
 */
const BOX_CLIP = 'inset(68px 60px 48px 64px)'; // the blue box inside the 657×684 panel
const POP_FADE: KeyframeAnimationOptions = { duration: 260, easing: EASE_CSS, fill: 'backwards' };
const POP_OPEN: KeyframeAnimationOptions = { duration: 560, delay: 120, easing: EASE_CSS, fill: 'backwards' };

/*
 * Leaving a step plays it backwards: panel + overhanging lines close onto the
 * box, then the drawing fades off the (unchanged) blue box.
 */
const UNPOP_CLOSE: KeyframeAnimationOptions = { duration: 560, easing: EASE_CSS, fill: 'forwards' };
const UNPOP_FADE: KeyframeAnimationOptions = { duration: 260, delay: 440, easing: EASE_CSS, fill: 'forwards' };

/** Corner bracket of the 01/02/03 buttons (bottom-left orientation; others are mirrored in CSS). */
const Corner = ({ className }: { className: string }) => (
  <svg className={className} viewBox="0 0 18.1333 18.1333" aria-hidden>
    <path d="M0.355556 0V17.7778H18.1333" stroke="currentColor" strokeWidth="0.711111" fill="none" />
  </svg>
);

export default function Vision() {
  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const linesRef = useRef<HTMLDivElement>(null);
  const popAnims = useRef<Animation[]>([]);
  const inViewRef = useRef(false);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  // the step the figure is showing; trails `active` while the outgoing figure plays out
  const [shown, setShown] = useState(0);
  const shownRef = useRef(0);
  const exiting = useRef(false);
  // bumped on every pop so the line drawing re-draws from scratch
  const [drawKey, setDrawKey] = useState(0);
  // while a click's smooth scroll travels, the scroll position still reads the old step
  const scrollLock = useRef<{ top: number; until: number } | null>(null);

  /* ---- fit the 1440×762 composition into the sticky stage ---- */

  useLayoutEffect(() => {
    const root = rootRef.current!;
    const stage = stageRef.current!;
    const fit = () => {
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      root.dataset.layout = w <= MOBILE_MAX ? 'mobile' : 'desktop';
      root.style.setProperty('--k', `${Math.min(Math.min(w, WIDE_MIN) / DESIGN_W, h / DESIGN_H)}`);
      // mobile: the figure panel scales to whatever room the stacked layout leaves it
      root.style.setProperty('--fig-s', `${Math.min((w - 32) / 657, (h * 0.36) / 684)}`);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(stage);
    return () => ro.disconnect();
  }, []);

  /* ---- scroll drives the step; the section is a tall track with a sticky stage ---- */

  const progressRange = useCallback(() => {
    const root = rootRef.current!;
    const top = root.getBoundingClientRect().top + window.scrollY;
    return { top, span: root.offsetHeight - window.innerHeight };
  }, []);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const lock = scrollLock.current;
      if (lock) {
        if (Math.abs(window.scrollY - lock.top) > 2 && performance.now() < lock.until) return;
        scrollLock.current = null;
      }
      const { top, span } = progressRange();
      const p = Math.min(1, Math.max(0, (window.scrollY - top) / span));
      const next = Math.min(STEPS.length - 1, Math.floor(p * STEPS.length));
      if (next !== activeRef.current) {
        activeRef.current = next;
        setActive(next);
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    // the user taking over the scroll ends a click's lock straight away
    const release = () => {
      scrollLock.current = null;
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    window.addEventListener('wheel', release, { passive: true });
    window.addEventListener('touchstart', release, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('wheel', release);
      window.removeEventListener('touchstart', release);
    };
  }, [progressRange]);

  // clicking a number scrolls to the middle of that step's band, so scroll and click stay in sync
  const goTo = (i: number) => {
    const { top, span } = progressRange();
    activeRef.current = i;
    setActive(i);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const target = Math.round(top + ((i + 0.5) / STEPS.length) * span);
    scrollLock.current = { top: target, until: performance.now() + 2000 };
    window.scrollTo({ top: target, behavior: reduced ? 'auto' : 'smooth' });
  };

  /* ---- blue box follows the cursor vertically, inverted, ±16px ---- */

  useEffect(() => {
    const root = rootRef.current!;
    let raf = 0;
    let y = 0;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      y = e.clientY;
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          const ratio = Math.min(1, Math.max(-1, (y / window.innerHeight - 0.5) * 2));
          root.style.setProperty('--follow', `${-ratio * FOLLOW_MAX}px`);
        });
    };
    root.addEventListener('pointermove', onMove);
    return () => {
      cancelAnimationFrame(raf);
      root.removeEventListener('pointermove', onMove);
    };
  }, []);

  /* ---- figure pop: on entering the section, and every time a step becomes active ---- */

  const pop = useCallback(() => {
    const root = rootRef.current!;
    const entering = root.dataset.figure === 'waiting';
    popAnims.current.forEach((a) => a.cancel());
    delete root.dataset.figure;
    setDrawKey((k) => k + 1);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const open = [{ clipPath: BOX_CLIP }, { clipPath: 'inset(0px)' }];
    popAnims.current = [panelRef.current!.animate(open, POP_OPEN), linesRef.current!.animate(open, POP_OPEN)];
    // only when the section is reached; between steps the box simply stays
    if (entering) popAnims.current.push(popRef.current!.animate([{ opacity: 0 }, { opacity: 1 }], POP_FADE));
  }, []);

  useEffect(() => {
    const root = rootRef.current!;
    const io = new IntersectionObserver(
      ([entry]) => {
        const was = inViewRef.current;
        inViewRef.current = entry.isIntersecting;
        if (entry.isIntersecting && !was) pop();
        // out of view: park the figure collapsed so it pops again on return
        if (!entry.isIntersecting) root.dataset.figure = 'waiting';
      },
      { threshold: 0.35 },
    );
    io.observe(stageRef.current!);
    return () => io.disconnect();
  }, [pop]);

  const unpop = useCallback(() => {
    popAnims.current.forEach((a) => a.cancel());
    const close = [{ clipPath: 'inset(0px)' }, { clipPath: BOX_CLIP }];
    popAnims.current = [
      panelRef.current!.animate(close, UNPOP_CLOSE),
      linesRef.current!.animate(close, UNPOP_CLOSE),
      linesRef.current!.animate([{ opacity: 1 }, { opacity: 0 }], UNPOP_FADE),
    ];
    return Promise.all(popAnims.current.map((a) => a.finished));
  }, []);

  // step change: play the outgoing figure out, then swap and pop the new one in
  useEffect(() => {
    if (active === shownRef.current || exiting.current) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!inViewRef.current || reduced) {
      shownRef.current = active;
      setShown(active);
      return;
    }
    exiting.current = true;
    unpop().then(
      () => {
        exiting.current = false;
        // scrolling may have moved on (or back) while the figure was leaving
        const target = activeRef.current;
        if (target === shownRef.current) pop();
        else {
          shownRef.current = target;
          setShown(target);
        }
      },
      () => {
        // cancelled by a fresh pop (section re-entered): just catch the figure up
        exiting.current = false;
        if (activeRef.current !== shownRef.current) {
          shownRef.current = activeRef.current;
          setShown(activeRef.current);
        }
      },
    );
  }, [active, pop, unpop]);

  const firstShown = useRef(true);
  useEffect(() => {
    if (firstShown.current) {
      firstShown.current = false;
      return;
    }
    if (inViewRef.current) pop();
  }, [shown, pop]);

  /* ---- scroll indicator: after 2s without scrolling inside the section, nudge every 2s ---- */

  useEffect(() => {
    const root = rootRef.current!;
    let inView = false;
    let timer = 0;
    const arm = () => {
      clearTimeout(timer);
      delete root.dataset.idle;
      if (inView) timer = window.setTimeout(() => (root.dataset.idle = 'true'), IDLE_MS);
    };
    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      arm();
    });
    io.observe(stageRef.current!);
    window.addEventListener('scroll', arm, { passive: true });
    return () => {
      io.disconnect();
      clearTimeout(timer);
      window.removeEventListener('scroll', arm);
    };
  }, []);

  const step = STEPS[active];

  return (
    <section
      ref={rootRef}
      className={styles.vision}
      aria-label="Our approach"
      style={{ '--step-color': step.color, '--step-ink': step.ink, '--steps': STEPS.length } as CSSProperties}
    >
      <div ref={stageRef} className={styles.stage}>
        <div className={styles.frame}>
          <div className={styles.canvas}>
            <h2 className={styles.heading}>Be the first to deploy humanoid robots in factories at scale.</h2>

            {/* right: figure panel — the blue box moves, the line drawing stays */}
            <div className={styles.figure} aria-hidden>
              <div className={styles.pop} ref={popRef}>
                {/* inside the scaling wrapper, so while clipped to the box it stays hidden under it */}
                <div className={styles.panel} ref={panelRef} />
                <div className={styles.box} />
                <div className={styles.linesClip} ref={linesRef}>
                  <FigureArt key={`${shown}-${drawKey}`} step={STEPS[shown]} />
                </div>
              </div>
            </div>

            {/* left: scroll strip + step tab */}
            <div className={styles.scrollStrip} aria-hidden>
              <div className={styles.scrollBar}>
                <span className={styles.scrollText}>
                  <span className={styles.scrollArrow}>←</span> [ Scroll ]
                </span>
              </div>
              <div className={styles.scrollBarcode}>
                <img src="/vision/scroll-barcode.svg" alt="" width={521} height={34} />
              </div>
            </div>

            <div className={styles.tab} aria-hidden>
              <span className={styles.tabIcon} />
              <span className={styles.tabLabel} key={step.id}>
                {step.id}
              </span>
            </div>

            <div className={styles.card}>
              <img className={styles.cardGrid} src="/vision/isogrid.svg" alt="" width={654} height={260} />
              <div className={styles.copy} key={step.id} aria-live="polite">
                <p className={styles.label}>[ {step.label} ]</p>
                <h3 className={styles.title}>{step.title}</h3>
                <p className={styles.body}>{step.body}</p>
              </div>
            </div>

            <div className={styles.buttons} role="tablist" aria-label="Steps">
              {STEPS.map((s, i) => {
                const idle = IDLE_BUTTONS[active][i];
                const style = {
                  '--bg': idle ? idle.bg : s.color,
                  '--ink': idle ? idle.ink : s.ink,
                  '--hover-bg': s.color,
                  '--hover-ink': s.ink,
                } as CSSProperties;
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="tab"
                    aria-selected={i === active}
                    aria-label={`${s.number} — ${s.label}`}
                    className={styles.button}
                    style={style}
                    onClick={() => goTo(i)}
                  >
                    <Corner className={styles.cTL} />
                    <Corner className={styles.cTR} />
                    <span className={styles.number}>{s.number}</span>
                    <Corner className={styles.cBL} />
                    <Corner className={styles.cBR} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <div hidden>
        {STEPS.map((s) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={s.id} src={s.figure.src} alt="" />
        ))}
      </div>
    </section>
  );
}
