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

## Typography

`app/globals.css` holds the Figma text styles as variables — `--t-display`, `--t-h1`, `--t-h2`, `--t-h3`, `--t-body-l`, `--t-body-m`, `--t-label-l`, `--t-label-m`, `--t-mono-s` (the `font` shorthand) plus `--t-…-ls` (letter-spacing). Desktop and tablet use the desktop styles; below 768px they switch to the Figma "Mobile/…" values. Components only reference these; the only literal sizes left are graphic text that has no style in Figma (figure labels, step tab, 01/02/03, hero counter).

## Blog teaser

- `components/blog/Blog.tsx` — rows rest grey; the lit row (first by default, then hover/focus) turns white and its band takes the post's own colour (`tone`: blue, navy, orange or yellow — line, chip and text colours per tone are in `TONES`).
- `node scripts/blog-band.mjs` — turns the band exports (`sources/blog/band.svg`, Figma 450:12014; `band-mobile.svg`, 501:3248) into alpha masks (`public/blog/band-lines*.png`) that CSS colours per tone.
- Mobile (Figma 501:3156): 88-high rows — 60px band, team + date / title / read, colour bar upright on the right; every row shows its colours (no hover on touch).

## Vision section

- `components/vision/Vision.tsx` — desktop: sticky left column, with the three graphics scrolling past in the page on one grey column (01's panel top → 03's panel bottom), their vertical lines running on to the screen edge wherever the grey continues; each graphic's distance from the viewport centre scrubs its draw-on and opens its lines out to the panel edges, and the nearest one sets 01/02/03 (clicks just scroll to it); the browser's scroll snapping lands the scroll on the nearest graphic. Mobile is a plain stacked block: the figure spans the full screen width and pops between steps, switched only by the 01/02/03 buttons (the active one widens and carries the step label). Also an idle scroll nudge.
- `components/vision/steps.ts` — copy and colours per step.
- `components/vision/strokes.json` — the figures' stroke paths and arrow caps, read from the Figma vectors; `FigureArt.tsx` draws them on, then hands over to the textured raster.
- `npm run prepare:vision` — splits the Figma figure exports in `sources/vision/` into line-drawing layers (`public/vision/`), so the blue box can move under them, then cuts the lines out of them (`scripts/vision-labels.mjs`) leaving just the labels; the lines are drawn as SVG strokes.

## Team

- `components/team/Team.tsx` — team photo on the hero's grid/reveal system. Hovering (or focusing/tapping) Jean-Baptiste's tag or his figure moves the window in on him; the edges are registered CSS properties (`--wl/--wt/--wr/--wb`, see `globals.css`) so lines and clip move as one.
- `npm run bake:team` — clean + gradient-mapped team photo.

## Careers

- `components/careers/Careers.tsx` — desktop (Figma 398:1394): picking a role slides the panel's divider bar from top to bottom, revealing the text above it; switching roles (or "Read next offer") slides it up, swaps, and slides it down again. Mobile (Figma 517:3860): an accordion — a role card opens in place with its description; "More info" / "← Back to description" swap in the lists with the same divider move; the robot sits below the list and eases a little with the scroll (no cursor on touch).
- `components/careers/jobs.ts` — the roles (titles 2–4 are placeholders).

### Robot (careers, idle state)

`public/models/g1.glb` is exported from the Blender file (Unitree G1 FK rig): the armature, its parented meshes and the *Pose Controls* empty, **Animation mode: Actions**, Draco compression (level 6, position 14 / normal 10 bits). `components/careers/Robot.tsx` loads it with three.js and scrubs the NLA actions by cursor instead of playing them:

- `Look_LeftRight` (waist_yaw_link) — frames 45 → 75 → 105 follow cursor x
- `Look_UpDown` (torso_link) — frames 36 → 60 → 84 follow cursor y
- `Base_ArmsDown` holds the arms

Each clip is cut down to the bones it actually animates, so both run at once and the robot turns and tilts together, eased.

## Footer

- `components/footer/Footer.tsx` — over the last 343 design-px of scroll the footer opens from 343 to 686 tall (its bottom stays on the viewport bottom, so it pushes the page up); fully open, the drawing draws on.
- `components/footer/footer-art.json` — the drawing's strokes/caps/labels, read from the Figma vectors.
- `components/drawing/DrawnStrokes.tsx` — the shared draw-on component (Vision figures + footer); `STROKE_WIDTH` (1.6) sets every drawn line's thickness, arrow caps scale with it.

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
