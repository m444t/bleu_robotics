import { ease } from '@/lib/motion';
import type { MediaFit, Slide } from './slides';

/**
 * The hero is driven by one set of boundaries (the grid). Everything else —
 * clip regions, image UI, navbar, bottom panel, media framing — is derived
 * from these numbers, so a moving boundary moves everything attached to it.
 *
 *   stageT ─ navbar bottom / top of the media viewport
 *   stageB ─ media viewport bottom / top of the headline panel
 *   winL/T/R/B ─ grid intersections = the clean-image reveal window
 */
export type Frame = {
  stageT: number;
  stageB: number;
  winL: number;
  winT: number;
  winR: number;
  winB: number;
  /** 0 | 1 — counter bar + arrows pop in at their window corners */
  ui: number;
  /** header strip readout, counts 0 -> 255 */
  count: number;
};

export type MediaBox = { x: number; y: number; w: number };

export type Layout = {
  heroW: number;
  heroH: number;
  start: Frame;
  end: Frame;
};

// Figma desktop canvas (1440 × 845)
const D = {
  w: 1440,
  h: 845,
  nav: 56,
  stageH: 674,
  win: { l: 92, r: 1349, t: 33.5, b: 644.5 }, // t/b relative to stage top
  startWinT: 374,
  panel: 115,
};

export const NAV_H = 56;
export const DECO_H = 28; // image header strip
export const DECO_W = 445;
export const MOBILE_MAX = 767;
/** Wide breakpoint: from here the layout stops scaling and sits in a centred column. */
export const WIDE_MIN = 1920;

/**
 * @param heroW  hero width in px
 * @param panelContentH  measured height of the headline/subline block
 * @param viewportH  the hero is one viewport tall; the stage takes what the panel leaves
 * @param viewportW  window width, so the wide breakpoint matches a CSS media query (scrollbar included)
 */
export function computeLayout(heroW: number, panelContentH: number, viewportH: number, viewportW = heroW): Layout {
  if (heroW <= MOBILE_MAX) {
    const winL = 16;
    const winR = heroW - 16;
    const winT = NAV_H + 16;
    // 100vh: the stage fills whatever the headline panel leaves (with a floor for very short screens)
    const stageB = Math.max(viewportH - panelContentH, winT + 240 + 16);
    const winB = stageB - 16;
    const heroH = stageB + panelContentH;
    const startT = Math.round(heroH * 0.44);
    return {
      heroW,
      heroH,
      end: { stageT: NAV_H, stageB, winL, winT, winR, winB, ui: 1, count: 255 },
      start: { stageT: -2, stageB: heroH, winL, winT: startT, winR, winB: startT + DECO_H, ui: 0, count: 0 },
    };
  }

  // 1440–1919: everything scales with the width. ≥1920: scale is frozen at the
  // 1920 size and the grid sits in a centred 1920 column (media stays full-bleed).
  // Height is always one viewport: the stage takes what the nav and panel leave.
  const wide = viewportW >= WIDE_MIN;
  const colW = wide ? Math.min(heroW, WIDE_MIN) : heroW;
  const offset = (heroW - colW) / 2;
  const k = colW / D.w;
  const panelH = Math.max(D.panel * k, panelContentH);
  const stageH = Math.max(viewportH - NAV_H - panelH, D.stageH * k * 0.5);
  const stageB = NAV_H + stageH;
  const heroH = stageB + panelH;
  const winL = offset + D.win.l * k;
  const winR = offset + D.win.r * k;
  const startT = (heroH * D.startWinT) / D.h;
  return {
    heroW,
    heroH,
    end: {
      stageT: NAV_H,
      stageB,
      winL,
      winT: NAV_H + D.win.t * k,
      winR,
      // bottom inset is kept, so a shorter stage only shortens the window
      winB: stageB - (D.stageH - D.win.b) * k,
      ui: 1,
      count: 255,
    },
    start: {
      // navbar parked fully above, media fills the whole hero
      stageT: -2,
      stageB: heroH,
      winL,
      // the window starts as a slit exactly the size of the image header strip
      winT: startT,
      winR: Math.min(winL + DECO_W + 1, winR),
      winB: startT + DECO_H,
      ui: 0,
      count: 0,
    },
  };
}

/** Cover the stage with the composition, honour zoom + focal point, then clamp. */
export function fitMedia(
  slide: Pick<Slide, 'width' | 'height'>,
  fit: MediaFit,
  heroW: number,
  stageT: number,
  stageB: number,
  anchorX: number,
  anchorY: number,
): MediaBox {
  const aspect = slide.width / slide.height;
  const coverW = Math.max(heroW, (stageB - stageT) * aspect);
  const w = coverW * fit.zoom;
  const h = w / aspect;
  const x = clamp(anchorX - fit.fx * w, heroW - w, 0);
  const y = clamp(anchorY - fit.fy * h, stageB - h, stageT);
  return { x, y, w };
}

export function restingMedia(slide: Slide, layout: Layout): MediaBox {
  const f = layout.end;
  return fitMedia(slide, slide.fit, layout.heroW, f.stageT, f.stageB, (f.winL + f.winR) / 2, (f.winT + f.winB) / 2);
}

export function introStartMedia(slide: Slide, layout: Layout): MediaBox {
  const f = layout.start;
  return fitMedia(slide, slide.introFit ?? slide.fit, layout.heroW, f.stageT, f.stageB, layout.heroW / 2, layout.heroH / 2);
}

/* ------------------------------------------------------------------ */
/* Intro timeline: one progress value, one schedule per boundary.     */
/* ------------------------------------------------------------------ */

export const INTRO_MS = 3400;

const SCHEDULE = {
  // 1. the slit runs out to the right…
  winR: [0, 0.32],
  // 2. …then opens up and down, the navbar dropping in with the top edge
  winT: [0.3, 0.66],
  winB: [0.3, 0.66],
  stageT: [0.36, 0.7],
  media: [0.4, 0.85],
  // 3. last: the headline panel closes the stage, then the image UI pops in once the media has settled
  stageB: [0.533, 0.773],
  ui: 0.85,
  // the readout ticks across the whole structural move
  count: [0.02, 0.92],
} as const;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const linear = (p: number, [a, b]: readonly [number, number]) => clamp((p - a) / (b - a), 0, 1);
const local = (p: number, range: readonly [number, number]) => ease(linear(p, range));

export function frameAt(layout: Layout, p: number): Frame {
  const { start: s, end: e } = layout;
  return {
    stageT: lerp(s.stageT, e.stageT, local(p, SCHEDULE.stageT)),
    stageB: lerp(s.stageB, e.stageB, local(p, SCHEDULE.stageB)),
    winL: lerp(s.winL, e.winL, p),
    winT: lerp(s.winT, e.winT, local(p, SCHEDULE.winT)),
    winR: lerp(s.winR, e.winR, local(p, SCHEDULE.winR)),
    winB: lerp(s.winB, e.winB, local(p, SCHEDULE.winB)),
    ui: p >= SCHEDULE.ui ? e.ui : s.ui,
    count: Math.round(lerp(s.count, e.count, local(p, SCHEDULE.count))),
  };
}

export function mediaAt(from: MediaBox, to: MediaBox, p: number): MediaBox {
  const t = local(p, SCHEDULE.media);
  return { x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t), w: lerp(from.w, to.w, t) };
}
