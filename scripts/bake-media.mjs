// Bakes every hero slide into two perfectly aligned files:
//   <id>-clean.webp    full-colour composition
//   <id>-treated.webp  same composition through the Figma gradient-map effect
// Both come from one composition buffer, so they share crop, size and aspect.
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { applyGradientMap, histogramMatchLut } from './gradient-map.mjs';

const OUT_DIR = 'public/media';
const MANIFEST = 'components/hero/media-manifest.json';
const CLEAN_MAX_W = 2560;
const TREATED_MAX_W = 1600; // ~1 image px per CSS px at 1440, so the dither grain stays crisp

// Figma's treated input is a graded B/W frame; match every slide to its tonal distribution.
const figmaInput = await sharp('sources/figma-treated-input.png').greyscale().raw().toBuffer();

const SLIDES = [
  {
    id: 'robot-demo',
    src: 'sources/slide-robot-demo.png',
    // below the letterbox bar, above the burnt-in captions, left of the partner logos
    crop: { left: 0, top: 100, width: 2560, height: 1330 },
    // Retouch the burnt-in video overlay (source coordinates):
    patches: [
      // "Training - x5" caption -> the curtain above it, stretched along its vertical folds
      { left: 2226, top: 170, width: 334, height: 120, fromLeft: 2226, fromTop: 100, fromHeight: 70 },
      // blue frame rule, horizontal -> rows just below, flipped
      { left: 0, top: 172, width: 2560, height: 18, fromLeft: 0, fromTop: 190, flip: true },
      // blue frame rule, vertical -> columns just left, flopped
      { left: 70, top: 100, width: 20, height: 1370, fromLeft: 50, fromTop: 100, flop: true },
    ],
    // extend the curtain upward (stretched along its folds) so the media can sit above
    // the head room; the head columns borrow plain curtain from further left
    extendTop: { rows: 60, sourceRows: 14, avoid: { left: 1340, width: 420, fromLeft: 900 } },
  },
  {
    id: 'food-packing',
    src: 'sources/slide-food-packing.png',
    crop: null,
  },
  {
    id: 'robot-detail',
    src: 'sources/slide-robot-demo.png',
    crop: { left: 300, top: 330, width: 1900, height: 970 },
  },
];

async function buildComposition(slide) {
  // retouch in source space first, then crop
  let buf = await sharp(slide.src).removeAlpha().png().toBuffer();
  for (const p of slide.patches ?? []) {
    let patch = sharp(buf).extract({ left: p.fromLeft, top: p.fromTop, width: p.width, height: p.fromHeight ?? p.height });
    if (p.fromHeight) patch = sharp(await patch.png().toBuffer()).resize(p.width, p.height, { fit: 'fill' });
    if (p.flip) patch = patch.flip();
    if (p.flop) patch = patch.flop();
    buf = await sharp(buf)
      .composite([{ input: await patch.png().toBuffer(), left: p.left, top: p.top }])
      .png()
      .toBuffer();
  }
  if (slide.crop) buf = await sharp(buf).extract(slide.crop).png().toBuffer();

  if (slide.extendTop) {
    const { rows, sourceRows, avoid } = slide.extendTop;
    const { width, height } = await sharp(buf).metadata();
    const stretch = async (left, w) =>
      sharp(await sharp(buf).extract({ left, top: 0, width: w, height: sourceRows }).png().toBuffer())
        .resize(w, rows, { fit: 'fill' })
        .png()
        .toBuffer();
    const strip = await stretch(0, width);
    const fill = await stretch(avoid.fromLeft, avoid.width);
    buf = await sharp({ create: { width, height: height + rows, channels: 3, background: '#000' } })
      .composite([
        { input: strip, left: 0, top: 0 },
        { input: fill, left: avoid.left, top: 0 },
        { input: buf, left: 0, top: rows },
      ])
      .png()
      .toBuffer();
  }
  return buf;
}

await fs.mkdir(OUT_DIR, { recursive: true });
const manifest = [];

for (const slide of SLIDES) {
  const comp = await buildComposition(slide);
  const { width, height } = await sharp(comp).metadata();

  const cleanW = Math.min(width, CLEAN_MAX_W);
  await sharp(comp).resize(cleanW).webp({ quality: 82 }).toFile(`${OUT_DIR}/${slide.id}-clean.webp`);

  const treatedW = Math.min(width, TREATED_MAX_W);
  const treatedH = Math.round((treatedW / width) * height);
  const gray = await sharp(comp).resize(treatedW, treatedH, { fit: 'fill' }).greyscale().raw().toBuffer();
  const lut = histogramMatchLut(gray, figmaInput);
  for (let i = 0; i < gray.length; i++) gray[i] = lut[gray[i]];
  const rgb = applyGradientMap(gray, treatedW, treatedH);
  await sharp(rgb, { raw: { width: treatedW, height: treatedH, channels: 3 } })
    .webp({ quality: 86 })
    .toFile(`${OUT_DIR}/${slide.id}-treated.webp`);

  manifest.push({
    id: slide.id,
    clean: `/media/${slide.id}-clean.webp`,
    treated: `/media/${slide.id}-treated.webp`,
    width,
    height,
  });
  console.log(`baked ${slide.id} ${width}x${height}`);
}

await fs.writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
