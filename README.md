# Bleu Robotics — hero

```bash
npm install
npm run dev        # http://localhost:3000
```

## Structure

- `components/hero/geometry.ts` — the grid boundaries, the intro timeline, media framing. Every moving part is derived from these numbers.
- `components/hero/Hero.tsx` — writes the geometry to CSS variables (one rAF loop during the intro only) and runs the carousel (Web Animations, both media layers locked to one start time).
- `components/hero/Hero.module.css` — the six layers: treated media, clean media, reveal clip, grid, image UI, page UI.
- `components/hero/slides.ts` — captions, alt text and framing per slide.

## Vision section

- `components/vision/Vision.tsx` — sticky scroll track (scroll or click 01/02/03), cursor-follow on the blue box, idle scroll nudge.
- `components/vision/steps.ts` — copy and colours per step.
- `components/vision/strokes.json` — the figures' stroke paths and arrow caps, read from the Figma vectors; `FigureArt.tsx` draws them on, then hands over to the textured raster.
- `npm run prepare:vision` — splits the Figma figure exports in `sources/vision/` into line-drawing layers (`public/vision/`), so the blue box can move under them.

## Team

- `components/team/Team.tsx` — team photo on the hero's grid/reveal system. Hovering (or focusing/tapping) Jean-Baptiste's tag or his figure moves the window in on him; the edges are registered CSS properties (`--wl/--wt/--wr/--wb`, see `globals.css`) so lines and clip move as one.
- `npm run bake:team` — clean + gradient-mapped team photo.

## Careers

- `components/careers/Careers.tsx` — picking a role slides the panel's divider bar from top to bottom, revealing the text above it; switching roles slides it up, swaps, and slides it down again.
- `components/careers/jobs.ts` — the roles (titles 2–4 are placeholders).

## Footer

- `components/footer/Footer.tsx` — over the last 343 design-px of scroll the footer opens from 343 to 686 tall (its bottom stays on the viewport bottom, so it pushes the page up); fully open, the drawing draws on.
- `components/footer/footer-art.json` — the drawing's strokes/caps/labels, read from the Figma vectors.
- `components/drawing/DrawnStrokes.tsx` — the shared draw-on component (Vision figures + footer).

## Media

Each slide is baked into two files from one composition, so they are always the same size and crop:

```bash
npm run bake       # sources/*.png -> public/media/*-clean.webp + *-treated.webp
```

The treated version is a CPU port of the Figma "Gradient map" effect (same stops, offset, scatter), in `scripts/gradient-map.mjs`.

## QA

- `/?intro=0` — initial keyframe
- `/?intro=0.25` — slit running out to the right; `/?intro=0.6` — window opened up/down; `/?intro=0.88` — panel and image UI arriving
- `/?intro=1` — skip straight to the interactive resting state
