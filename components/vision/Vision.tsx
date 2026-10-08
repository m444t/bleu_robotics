'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { EASE_CSS, ease } from '@/lib/motion';
import styles from './Vision.module.css';
import { IDLE_BUTTONS, STEPS } from './steps';
import FigureArt, { artDuration } from './FigureArt';

const DESIGN_W = 1440;
const DESIGN_H = 762;
// the tab / scroll strip's x in the Figma frame; the whole left column moves with it (--left-shift)
const TAB_LEFT = 65;
const MOBILE_MAX = 767;
const WIDE_MIN = 1920; // composition stops growing here and stays centred
const IDLE_MS = 2000;

/* the blue box inside the 657×684 panel: top, right, bottom, left */
const BOX = [68, 60, 48, 64];
const BOX_CLIP = `inset(${BOX.map((v) => `${v}px`).join(' ')})`;
/**
 * A graphic's line clip: 0 = the blue box, 1 = the whole panel plus `up` / `down`
 * design px beyond its top / bottom edge (where the grey column carries on).
 */
const openClip = (open: number, up: number, down: number) => {
  const [t, r, b, l] = BOX.map((v) => v * (1 - open));
  const px = (v: number) => `${v.toFixed(2)}px`;
  return `inset(${px(t - open * up)} ${px(r)} ${px(b - open * down)} ${px(l)})`;
};
/* the panel's top/bottom edge sits this far from the centre of the 762-high frame */
const PANEL_HALF = 342;

/*
 * Desktop: the three graphics scroll past in the page; each one's distance from
 * the viewport centre, in slots (the distance between two graphics' centres),
 * sets its drawing. Coming in it draws on between DRAW_FROM and DRAW_TO; then the lines
 * beyond the blue box run out to their ends between EXT_FROM and EXT_TO; inside
 * EXT_TO it holds complete. Going out plays the same backwards.
 */
const DRAW_FROM = 0.7;
const DRAW_TO = 0.17;
const EXT_FROM = 0.17;
const EXT_TO = 0.05;
// the drawing trails the scroll a little: it eases toward the scroll-set amount with this time constant
const DRAW_LAG_MS = 220;


/* desktop: the grey column opens out from under a blue box once, on reaching the section */
const PANEL_OPEN: KeyframeAnimationOptions = { duration: 560, delay: 120, easing: EASE_CSS, fill: 'backwards' };
const PANEL_CLOSE: KeyframeAnimationOptions = { duration: 560, easing: EASE_CSS };

/*
 * Mobile: one figure that pops per step (the 01/02/03 buttons switch it). The blue box fades in when the
 * section is reached; the panel and overhanging lines open outward while the
 * strokes draw on, and leaving a step plays it backwards.
 */
const POP_FADE: KeyframeAnimationOptions = { duration: 260, easing: EASE_CSS, fill: 'backwards' };
const POP_OPEN: KeyframeAnimationOptions = { duration: 560, delay: 120, easing: EASE_CSS, fill: 'backwards' };
const UNPOP_CLOSE: KeyframeAnimationOptions = { duration: 560, easing: EASE_CSS, fill: 'forwards' };
const UNPOP_FADE: KeyframeAnimationOptions = { duration: 260, delay: 440, easing: EASE_CSS, fill: 'forwards' };

/*
 * Mobile figure: the blue graphic (box + drawing) at 90%, and the grey above and
 * below it half as deep — a shorter panel, still the full screen width. The
 * graphic is scaled about the box centre and moved up so the box sits M_GREY_T
 * below the panel top; the line clip opens to the panel's edges in the scaled
 * drawing's own coordinates, and the lines run on to them (FigureArt `extend`).
 */
const M_SCALE = 0.9;
const M_GREY_T = BOX[0] / 2;
const M_GREY_B = BOX[2] / 2;
const M = (() => {
  const [t, r, b, l] = BOX;
  const cx = l + (657 - l - r) / 2;
  const cy = t + (684 - t - b) / 2;
  const boxW = (657 - l - r) * M_SCALE;
  const boxH = (684 - t - b) * M_SCALE;
  const panelH = M_GREY_T + boxH + M_GREY_B;
  const dy = M_GREY_T - (cy - boxH / 2);
  const boxL = cx - boxW / 2;
  // a point of the panel (figure px) in the scaled drawing's own px
  const local = (v: number, c: number, shift = 0) => (v - shift - c) / M_SCALE + c;
  const px = (v: number) => `${v.toFixed(2)}px`;
  // the panel closed onto the (smaller) box, in panel px
  const panelClosed = `inset(${px(M_GREY_T)} ${px(657 - boxL - boxW)} ${px(M_GREY_B)} ${px(boxL)})`;
  // the lines open to the panel's edges, in the scaled drawing's px
  const linesOpen = `inset(${px(local(0, cy, dy))} ${px(657 - local(657, cx))} ${px(684 - local(panelH, cy, dy))} ${px(local(0, cx))})`;
  return {
    panelClosed,
    linesOpen,
    style: {
      '--m-panel-h': px(panelH),
      '--m-dy': px(dy),
      '--m-scale': M_SCALE,
      '--m-origin': `${px(cx)} ${px(cy)}`,
      '--m-panel-closed': panelClosed,
      '--m-lines-open': linesOpen,
    } as CSSProperties,
  };
})();

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Corner bracket of the 01/02/03 buttons (bottom-left orientation; others are mirrored in CSS). */
const Corner = ({ className }: { className: string }) => (
  <svg className={className} viewBox="0 0 18.1333 18.1333" aria-hidden>
    <path d="M0.355556 0V17.7778H18.1333" stroke="currentColor" strokeWidth="0.711111" fill="none" />
  </svg>
);

export default function Vision() {
  const rootRef = useRef<HTMLElement>(null);
  // the stage holding the left column (desktop: the front sticky layer)
  const stageRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const clipRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [layout, setLayout] = useState<'desktop' | 'mobile'>('desktop');
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);

  /* ---- fit the 1440×762 composition into the viewport-high stage ---- */

  useLayoutEffect(() => {
    const root = rootRef.current!;
    const fit = () => {
      const w = root.clientWidth;
      const h = stageRef.current?.clientHeight || window.innerHeight;
      setLayout(w <= MOBILE_MAX ? 'mobile' : 'desktop');
      const k = Math.min(Math.min(w, WIDE_MIN) / DESIGN_W, h / DESIGN_H);
      root.style.setProperty('--k', `${k}`);
      // the same scale for type elsewhere (the blog), so its text matches this section's
      // on every screen (desktop only; mobile uses the type tokens as they are)
      document.documentElement.style.setProperty('--type-k', `${w <= MOBILE_MAX ? 1 : k}`);
      // the left column starts on the page's photo edge (46 in the 1440 column, as the team
      // photo and the hero's treated band), wherever this frame sits: a short screen
      // shrinks it by height, so it's narrower than the page column and centred
      const col = Math.min(w, WIDE_MIN);
      const edge = (w - col) / 2 + (46 * col) / DESIGN_W;
      const frameLeft = (w - DESIGN_W * k) / 2;
      root.style.setProperty('--left-shift', `${(edge - frameLeft) / k - TAB_LEFT}px`);
      // mobile: the figure panel spans the full screen width
      root.style.setProperty('--fig-s', `${w / 657}`);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(root);
    window.addEventListener('resize', fit);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', fit);
      document.documentElement.style.removeProperty('--type-k');
    };
  }, []);

  const select = (i: number) => {
    if (i === activeRef.current) return;
    activeRef.current = i;
    setActive(i);
  };

  /* ---- desktop: scroll position drives the active step and every graphic's drawing ---- */

  useEffect(() => {
    if (layout !== 'desktop') return;
    const items = itemRefs.current.filter(Boolean) as HTMLDivElement[];
    const clips = clipRefs.current.filter(Boolean) as HTMLDivElement[];
    const durations = STEPS.map(artDuration);
    // the drawing's own CSS animations, paused and scrubbed; fetched on first use
    const anims: (Animation[] | null)[] = items.map(() => null);
    const written = items.map(() => ({ draw: -1, open: -1 }));
    // each graphic's drawn amount as shown, easing toward what the scroll asks for (-1: not yet set)
    const shown = items.map(() => -1);
    const lag = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : DRAW_LAG_MS;
    let last = 0;
    let centers: number[] = [];
    let slot = 1;
    // design px from a centred graphic's panel edge to the screen edge
    let reach = 0;
    let raf = 0;

    // positions are read on resize only; scrolling just reads scrollY
    const measure = () => {
      const sy = window.scrollY;
      centers = items.map((el) => {
        const r = el.getBoundingClientRect();
        return r.top + sy + r.height / 2;
      });
      slot = centers.length > 1 ? centers[1] - centers[0] : window.innerHeight;
      const k = items[0].getBoundingClientRect().width / DESIGN_W;
      reach = Math.max(0, window.innerHeight / 2 / k - PANEL_HALF) + 2;
      written.forEach((w) => (w.open = -1));
    };

    const update = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(100, now - last) : 0;
      last = now;
      const follow = lag ? 1 - Math.exp(-dt / lag) : 1;
      let settling = false;
      const mid = window.scrollY + window.innerHeight / 2;
      let nearest = 0;
      centers.forEach((c, i) => {
        const u = Math.abs(c - mid) / slot;
        if (u < Math.abs(centers[nearest] - mid) / slot) nearest = i;
        const target = clamp01((DRAW_FROM - u) / (DRAW_FROM - DRAW_TO));
        let draw = shown[i] < 0 ? target : shown[i] + (target - shown[i]) * follow;
        if (Math.abs(target - draw) < 0.002) draw = target;
        else settling = true;
        shown[i] = draw;
        const open = ease(clamp01((EXT_FROM - u) / (EXT_FROM - EXT_TO)));
        const w = written[i];
        if (draw !== w.draw) {
          anims[i] ??= clips[i].getAnimations({ subtree: true });
          for (const a of anims[i]!) {
            a.pause();
            a.currentTime = draw * durations[i];
          }
          w.draw = draw;
        }
        if (open !== w.open) {
          // the lines run on to the screen edge wherever the grey column goes on:
          // not above the first graphic, not below the last
          clips[i].style.clipPath = openClip(open, i > 0 ? reach : 0, i < items.length - 1 ? reach : 0);
          w.open = open;
        }
      });
      select(nearest);
      // keep easing after the scroll stops, until every drawing has caught up
      if (settling) raf = requestAnimationFrame(update);
      else last = 0;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    const onResize = () => {
      measure();
      onScroll();
    };

    measure();
    update(performance.now());
    window.addEventListener('scroll', onScroll, { passive: true });
    // auto snap: the browser's own scroll snapping onto the graphics (scroll-snap-align
    // in the CSS), so the scroll lands on one as it ends instead of gliding after it
    const html = document.documentElement;
    html.style.scrollSnapType = 'y proximity';
    // anything above the section changing height moves the graphics' page positions
    const ro = new ResizeObserver(onResize);
    ro.observe(document.body);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('scroll', onScroll);
      html.style.scrollSnapType = '';
    };
  }, [layout]);

  /*
   * ---- desktop: the grey column opens once when the section is reached ----
   * It waits closed onto the blue box of the graphic you arrive at — the first
   * coming down the page, the last coming back up — and closes onto the one you
   * leave from.
   */

  useEffect(() => {
    if (layout !== 'desktop') return;
    const column = columnRef.current!;
    let anim: Animation | null = null;
    let open = false;
    const closed = (end: 'first' | 'last') => {
      const k = column.offsetWidth / 657;
      const h = column.offsetHeight;
      const [t, r, b, l] = BOX.map((v) => v * k);
      const px = (v: number) => `${v.toFixed(2)}px`;
      return end === 'first'
        ? `inset(${px(t)} ${px(r)} ${px(h - (684 * k - b))} ${px(l)})`
        : `inset(${px(h - (684 * k - t))} ${px(r)} ${px(b)} ${px(l)})`;
    };
    column.style.clipPath = closed('first');
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting === open) return;
        open = entry.isIntersecting;
        // the sticky stage is below the viewport top when the section is ahead of us
        const shut = closed(entry.boundingClientRect.top > 0 ? 'first' : 'last');
        anim?.cancel();
        column.style.clipPath = open ? 'inset(0px)' : shut;
        if (reducedMotion()) return;
        anim = open
          ? column.animate([{ clipPath: shut }, { clipPath: 'inset(0px)' }], PANEL_OPEN)
          : column.animate([{ clipPath: 'inset(0px)' }, { clipPath: shut }], PANEL_CLOSE);
      },
      { threshold: 0.35 },
    );
    io.observe(stageRef.current!);
    return () => {
      io.disconnect();
      anim?.cancel();
      column.style.clipPath = '';
    };
  }, [layout]);

  /*
   * ---- 01 / 02 / 03 ----
   * Desktop: clicking only moves the page; the scroll position does the rest.
   * Mobile: the buttons alone switch the step — scrolling doesn't.
   */

  const goTo = (i: number) => {
    if (layout === 'mobile') {
      select(i);
      return;
    }
    const r = itemRefs.current[i]!.getBoundingClientRect();
    window.scrollTo({
      top: Math.round(window.scrollY + r.top + r.height / 2 - window.innerHeight / 2),
      behavior: reducedMotion() ? 'auto' : 'smooth',
    });
  };

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
  }, [layout]);

  const step = STEPS[active];

  const heading = <h2 className={styles.heading}>Deploying humanoid robots at scale, starting where they matter most.</h2>;

  const leftColumn = (
    <>
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
        <img className={styles.cardGrid} src="/vision/isogrid.svg" alt="" width={800} height={500} />
        <div className={styles.copy} key={step.id} aria-live="polite">
          <p className={styles.label}>[ {step.label} ]</p>
          <h3 className={styles.title}>{step.title}</h3>
          <p className={styles.body}>{step.body}</p>
        </div>
      </div>

      {/* desktop: the card's grid runs on over the grey column up to the blue box, held in
          place (sticky) through all three steps */}
      <div className={styles.cardGridSide} aria-hidden>
        <img className={styles.cardGrid} src="/vision/isogrid.svg" alt="" width={800} height={500} />
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
              {/* mobile: the active button widens and carries the step's label */}
              <span className={styles.buttonLabel} aria-hidden>
                [ {s.label} ]
              </span>
              <Corner className={styles.cBL} />
              <Corner className={styles.cBR} />
            </button>
          );
        })}
      </div>
    </>
  );

  return (
    <section
      ref={rootRef}
      className={styles.vision}
      data-layout={layout}
      aria-label="Our approach"
      style={{ '--step-color': step.color, '--step-ink': step.ink } as CSSProperties}
    >
      {layout === 'desktop' ? (
        <>
          {/* the sticky left column */}
          <div ref={stageRef} className={`${styles.stage} ${styles.stageFront}`}>
            <div className={styles.frame}>
              <div className={styles.canvas}>
                {heading}
                {leftColumn}
              </div>
            </div>
          </div>

          {/* under it: the three graphics in the page flow, one below the other, on one grey column */}
          <div className={styles.track} aria-hidden>
            <div className={styles.column} ref={columnRef} />
            {STEPS.map((s, i) => (
              <div
                key={s.id}
                className={styles.frame}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
              >
                <div className={styles.canvas}>
                  <div className={`${styles.figure} ${styles.scrub}`}>
                    <div className={styles.box} />
                    <div
                      className={styles.linesClip}
                      ref={(el) => {
                        clipRefs.current[i] = el;
                      }}
                    >
                      <FigureArt step={s} extend />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div ref={stageRef} className={styles.stage}>
          <div className={styles.frame}>
            <div className={styles.canvas}>
              {heading}
              <PoppingFigure active={active} />
              {leftColumn}
            </div>
          </div>
          <div hidden>
            {STEPS.map((s) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={s.id} src={s.figure.labels} alt="" />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Mobile figure (the original behaviour): one slot that pops in when the section
 * is reached, and plays out / pops in again every time the step changes.
 */
function PoppingFigure({ active }: { active: number }) {
  const figRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const linesRef = useRef<HTMLDivElement>(null);
  const popAnims = useRef<Animation[]>([]);
  const inViewRef = useRef(false);
  const activeRef = useRef(active);
  activeRef.current = active;
  // the step the figure is showing; trails `active` while the outgoing figure plays out
  const [shown, setShown] = useState(active);
  const shownRef = useRef(active);
  const exiting = useRef(false);
  // bumped on every pop so the line drawing re-draws from scratch
  const [drawKey, setDrawKey] = useState(0);

  const pop = useCallback(() => {
    const fig = figRef.current!;
    const entering = fig.dataset.figure === 'waiting';
    popAnims.current.forEach((a) => a.cancel());
    delete fig.dataset.figure;
    setDrawKey((k) => k + 1);
    if (reducedMotion()) return;
    popAnims.current = [
      panelRef.current!.animate([{ clipPath: M.panelClosed }, { clipPath: 'inset(0px)' }], POP_OPEN),
      linesRef.current!.animate([{ clipPath: BOX_CLIP }, { clipPath: M.linesOpen }], POP_OPEN),
    ];
    // only when the section is reached; between steps the box simply stays
    if (entering) popAnims.current.push(popRef.current!.animate([{ opacity: 0 }, { opacity: 1 }], POP_FADE));
  }, []);

  useEffect(() => {
    const fig = figRef.current!;
    const io = new IntersectionObserver(
      ([entry]) => {
        const was = inViewRef.current;
        inViewRef.current = entry.isIntersecting;
        if (entry.isIntersecting && !was) pop();
        // out of view: park the figure collapsed so it pops again on return
        if (!entry.isIntersecting) fig.dataset.figure = 'waiting';
      },
      { threshold: 0.35 },
    );
    io.observe(fig);
    return () => io.disconnect();
  }, [pop]);

  const unpop = useCallback(() => {
    popAnims.current.forEach((a) => a.cancel());
    popAnims.current = [
      panelRef.current!.animate([{ clipPath: 'inset(0px)' }, { clipPath: M.panelClosed }], UNPOP_CLOSE),
      linesRef.current!.animate([{ clipPath: M.linesOpen }, { clipPath: BOX_CLIP }], UNPOP_CLOSE),
      linesRef.current!.animate([{ opacity: 1 }, { opacity: 0 }], UNPOP_FADE),
    ];
    return Promise.all(popAnims.current.map((a) => a.finished));
  }, []);

  // step change: play the outgoing figure out, then swap and pop the new one in
  useEffect(() => {
    if (active === shownRef.current || exiting.current) return;
    if (!inViewRef.current || reducedMotion()) {
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

  return (
    <div className={styles.figure} ref={figRef} style={M.style} aria-hidden>
      <div className={styles.pop} ref={popRef}>
        {/* inside the scaling wrapper, so while clipped to the box it stays hidden under it */}
        <div className={styles.panel} ref={panelRef} />
        <div className={styles.scaled}>
          <div className={styles.box} />
          <div className={styles.linesClip} ref={linesRef}>
            <FigureArt key={`${shown}-${drawKey}`} step={STEPS[shown]} extend />
          </div>
        </div>
      </div>
    </div>
  );
}
