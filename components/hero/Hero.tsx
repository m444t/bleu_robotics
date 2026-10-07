'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { EASE_CSS } from '@/lib/motion';
import styles from './Hero.module.css';
import { SLIDES, type Slide } from './slides';
import {
  computeLayout,
  frameAt,
  introStartMedia,
  mediaAt,
  restingMedia,
  INTRO_MS,
  type Frame,
  type Layout,
  type MediaBox,
} from './geometry';

const SLIDE_MS = 1050;
const SLIDE_EASING = EASE_CSS;
const INTRO_HOLD_MS = 350;
const pad2 = (n: number) => String(n).padStart(2, '0');
const readout = (n: number) => `[000-000-${String(n).padStart(3, '0')}]`;

type Transition = { from: number; to: number; dir: 1 | -1 } | null;

export default function Hero() {
  const rootRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLElement>(null);
  const treatedTracks = useRef<(HTMLDivElement | null)[]>([]);
  const cleanTracks = useRef<(HTMLDivElement | null)[]>([]);
  const layoutRef = useRef<Layout | null>(null);
  const introDone = useRef(false);

  const [index, setIndex] = useState(0);
  const [transition, setTransition] = useState<Transition>(null);
  const [interactive, setInteractive] = useState(false);

  /* ---- geometry -> CSS variables (no React renders) ---- */

  const writeFrame = useCallback((f: Frame) => {
    const s = rootRef.current!.style;
    s.setProperty('--stage-t', `${f.stageT}px`);
    s.setProperty('--stage-b', `${f.stageB}px`);
    s.setProperty('--stage-h', `${f.stageB - f.stageT}`);
    s.setProperty('--win-l', `${f.winL}px`);
    s.setProperty('--win-t', `${f.winT}px`);
    s.setProperty('--win-r', `${f.winR}px`);
    s.setProperty('--win-b', `${f.winB}px`);
    s.setProperty('--ui', `${f.ui}`);
    s.setProperty('--fx', `${f.fx}`);
    const text = readout(f.count);
    if (readoutRef.current!.textContent !== text) readoutRef.current!.textContent = text;
  }, []);

  // One set of variables per slide, read by BOTH the treated and the clean copy.
  const writeMedia = useCallback((i: number, slide: Slide, m: MediaBox) => {
    const s = rootRef.current!.style;
    s.setProperty(`--mx-${i}`, `${m.x}px`);
    s.setProperty(`--my-${i}`, `${m.y}px`);
    s.setProperty(`--ms-${i}`, `${m.w / slide.width}`);
  }, []);

  const measure = useCallback(() => {
    const root = rootRef.current!;
    const layout = computeLayout(root.clientWidth, panelRef.current!.offsetHeight, window.innerHeight, window.innerWidth);
    layoutRef.current = layout;
    root.style.setProperty('--hero-h', `${layout.heroH}px`);
    root.style.setProperty('--panel-h', `${layout.heroH - layout.end.stageB}px`);
    return layout;
  }, []);

  const writeResting = useCallback(
    (layout: Layout) => {
      writeFrame(layout.end);
      SLIDES.forEach((slide, i) => writeMedia(i, slide, restingMedia(slide, layout)));
    },
    [writeFrame, writeMedia],
  );

  /* ---- intro: a single progress value drives every boundary ---- */

  useLayoutEffect(() => {
    const root = rootRef.current!;
    const layout = measure();
    const first = SLIDES[0];
    const renderAt = (p: number) => {
      const l = layoutRef.current!;
      writeFrame(frameAt(l, p));
      writeMedia(0, first, mediaAt(introStartMedia(first, l), restingMedia(first, l), p));
    };

    SLIDES.forEach((slide, i) => i > 0 && writeMedia(i, slide, restingMedia(slide, layout)));
    renderAt(0);
    root.dataset.ready = 'true';

    const finish = () => {
      introDone.current = true;
      root.dataset.intro = 'done';
      writeResting(layoutRef.current!);
      setInteractive(true);
    };

    // QA: ?intro=0.5 freezes the timeline (compare with the Figma keyframes),
    // ?intro=1 skips straight to the interactive resting state
    const frozen = new URLSearchParams(window.location.search).get('intro');
    if (frozen !== null) {
      const p = Math.min(1, Math.max(0, Number(frozen) || 0));
      root.dataset.loaded = 'true';
      if (p >= 1) finish();
      else renderAt(p);
      return;
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let holdTimer = 0;
    let cancelled = false;

    const run = () => {
      if (cancelled) return;
      root.dataset.loaded = 'true';
      if (reduced) return finish();
      root.dataset.intro = 'running';
      holdTimer = window.setTimeout(() => {
        // the clock starts on the first painted frame, so a tab opened in the
        // background still plays the full intro once it becomes visible
        let t0 = -1;
        const tick = (now: number) => {
          if (t0 < 0) t0 = now;
          const p = Math.min(1, (now - t0) / INTRO_MS);
          renderAt(p);
          if (p < 1) raf = requestAnimationFrame(tick);
          else finish();
        };
        raf = requestAnimationFrame(tick);
      }, INTRO_HOLD_MS);
    };

    // start once the first composition (both layers) is decoded, or after a timeout
    const imgs = [treatedTracks.current[0], cleanTracks.current[0]].map((t) => t!.querySelector('img')!);
    const decoded = Promise.all(imgs.map((img) => img.decode().catch(() => undefined)));
    const timeout = new Promise((r) => setTimeout(r, 2500));
    Promise.race([decoded, timeout]).then(run);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      clearTimeout(holdTimer);
    };
  }, [measure, writeFrame, writeMedia, writeResting]);

  /* ---- responsive: recompute geometry, keep the same system ---- */

  useEffect(() => {
    const root = rootRef.current!;
    // width changes, viewport height changes and late font swaps (panel height)
    // all reshape the layout; a running intro picks it up on its next frame
    const relayout = () => {
      const layout = measure();
      if (introDone.current) writeResting(layout);
    };
    const ro = new ResizeObserver(relayout);
    ro.observe(root);
    ro.observe(panelRef.current!);
    // height-only resizes: follow them on desktop; on touch screens the URL bar
    // showing/hiding would make the hero jump while scrolling, so ignore those
    let lastW = window.innerWidth;
    const onResize = () => {
      const widthChanged = window.innerWidth !== lastW;
      lastW = window.innerWidth;
      if (widthChanged || !window.matchMedia('(pointer: coarse)').matches) relayout();
    };
    window.addEventListener('resize', onResize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [measure, writeResting]);

  /* ---- carousel: only media tracks move; both layers share one clock ---- */

  const go = useCallback(
    (dir: 1 | -1) => {
      if (!interactive || transition) return;
      const to = (index + dir + SLIDES.length) % SLIDES.length;
      setTransition({ from: index, to, dir });
      setIndex(to);
    },
    [interactive, transition, index],
  );

  useLayoutEffect(() => {
    if (!transition) return;
    const { from, to, dir } = transition;
    const root = rootRef.current!;
    const distance = root.clientWidth * 1.04; // a short blue gap trails the incoming edge
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timing: KeyframeAnimationOptions = { duration: reduced ? 1 : SLIDE_MS, easing: SLIDE_EASING };

    const anims: Animation[] = [];
    for (const tracks of [treatedTracks.current, cleanTracks.current]) {
      anims.push(
        tracks[from]!.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-dir * distance}px)` }], timing),
        tracks[to]!.animate([{ transform: `translateX(${dir * distance}px)` }, { transform: 'translateX(0)' }], timing),
      );
    }
    // lock every track to the same start time so treated + clean can never drift
    const t = document.timeline.currentTime;
    anims.forEach((a) => (a.startTime = t));

    let alive = true;
    Promise.all(anims.map((a) => a.finished)).then(() => alive && setTransition(null), () => {});
    return () => {
      alive = false;
      anims.forEach((a) => a.cancel());
    };
  }, [transition]);

  const trackState = (i: number) => ({
    'data-visible': i === index || i === transition?.from ? 'true' : undefined,
    'data-entering': transition && i === transition.to ? (transition.dir > 0 ? 'next' : 'prev') : undefined,
  });

  const renderLayer = (layer: 'treated' | 'clean') =>
    SLIDES.map((slide, i) => (
      <div
        key={slide.id}
        className={styles.track}
        ref={(el) => {
          (layer === 'treated' ? treatedTracks : cleanTracks).current[i] = el;
        }}
        {...trackState(i)}
      >
        <div
          className={styles.media}
          style={{
            width: slide.width,
            height: slide.height,
            transform: `translate3d(var(--mx-${i}), var(--my-${i}), 0) scale(var(--ms-${i}))`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={layer === 'treated' ? slide.treated : slide.clean}
            alt={layer === 'clean' ? slide.alt : ''}
            aria-hidden={layer === 'treated' || i !== index ? true : undefined}
            draggable={false}
            decoding="async"
            fetchPriority={i === 0 ? 'high' : 'low'}
          />
        </div>
        <span className={styles.edge} aria-hidden />
      </div>
    ));

  const current = SLIDES[index];

  return (
    <section ref={rootRef} className={styles.hero} aria-roledescription="carousel" aria-label="Bleu Robotics in the field">
      {/* LAYER 1 — treated media, clipped to the stage */}
      <div className={styles.treated} aria-hidden>
        {renderLayer('treated')}
      </div>

      {/* LAYER 2 + 3 — clean media, revealed through the grid window */}
      <div className={styles.clean}>{renderLayer('clean')}</div>

      {/* LAYER 4 — structural grid: independent filled elements */}
      <div className={styles.grid} aria-hidden>
        <div className={`${styles.hLine} ${styles.hTop}`}>
          <span className={styles.capL} />
          <span className={styles.capR} />
        </div>
        <div className={`${styles.hLine} ${styles.hBottom}`}>
          <span className={styles.capL} />
          <span className={styles.capR} />
        </div>
        <div className={`${styles.vLine} ${styles.vLeft}`}>
          <span className={styles.rule} />
          <span className={styles.capT} />
          <span className={styles.capB} />
        </div>
        <div className={`${styles.vLine} ${styles.vRight}`}>
          <span className={styles.rule} />
          <span className={styles.capT} />
          <span className={styles.capB} />
        </div>
      </div>

      {/* LAYER 5 — image UI, pinned to the window corners */}
      <div className={styles.imageUi}>
        <div className={styles.info}>
          <p className={styles.label} aria-live="polite">
            <span className={styles.roll} key={`n${index}`} data-anim={transition ? transition.dir : undefined}>
              [ {pad2(index + 1)} / {pad2(SLIDES.length)} ]
            </span>
          </p>
          <p className={`${styles.label} ${styles.caption}`}>
            <span className={styles.roll} key={`c${index}`} data-anim={transition ? transition.dir : undefined}>
              {current.caption}
            </span>
          </p>
          <div className={styles.progress} aria-hidden>
            {SLIDES.map((s, i) => (
              <span key={s.id} data-active={i === index ? 'true' : undefined} />
            ))}
          </div>
        </div>

        <div className={styles.arrows}>
          <button type="button" className={styles.prev} onClick={() => go(-1)} disabled={!interactive} aria-label="Previous slide">
            <span className={styles.icon}>
              <img src="/icons/arrow-dark.svg" alt="" width={16.25} height={12.5} />
            </span>
          </button>
          <button type="button" className={styles.next} onClick={() => go(1)} disabled={!interactive} aria-label="Next slide">
            <span className={styles.icon}>
              <img src="/icons/arrow-light.svg" alt="" width={16.25} height={12.5} />
            </span>
          </button>
        </div>

        <div className={styles.deco} aria-hidden>
          <span className={styles.swatches}>
            <i style={{ width: 48, background: '#00088e' }} />
            <i style={{ width: 20, background: '#fc5c04' }} />
            <i style={{ width: 15, background: '#ffd920' }} />
          </span>
          <span className={styles.code}>
            <b ref={readoutRef}>{readout(0)}</b>
          </span>
          <img className={styles.barcode} src="/icons/barcode.svg" alt="" width={254.373} height={19.956} />
        </div>
      </div>

      {/* LAYER 6 — page UI riding the stage boundaries */}
      <header className={styles.nav}>
        <a href="/" className={styles.logo} aria-label="Bleu Robotics home">
          <img src="/icons/logo-mark.svg" alt="" width={24.439} height={32.428} />
          <img src="/icons/logo-word.svg" alt="" width={68.527} height={28.489} />
        </a>
        <nav className={styles.links} aria-label="Primary">
          <a href="#blog">Blog</a>
          <a href="#careers">Careers</a>
          <a href="#contact" className={styles.cta}>
            <span className={styles.ctaLabel}>Let’s talk</span>
            <span className={styles.ctaArrow}>
              <span className={styles.icon}>
                <img src="/icons/arrow-light.svg" alt="" width={16.25} height={12.5} />
              </span>
            </span>
          </a>
        </nav>
      </header>

      <div className={styles.panel}>
        <div className={styles.panelInner} ref={panelRef}>
          <h1 className={styles.headline}>Industrial AI that learns from demonstration.</h1>
          <p className={styles.subline}>
            Bleu Robotics builds the AI that lets one humanoid robot take on the next task on your line. An operator teaches it
            by demonstration, and the same robot is retaught whenever the work changes.
          </p>
        </div>
      </div>
    </section>
  );
}
