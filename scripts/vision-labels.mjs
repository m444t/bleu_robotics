// Splits the labels off the Vision figure rasters (public/vision/*-lines.webp).
// The lines themselves are drawn as SVG strokes (components/vision/strokes.json)
// at the site's stroke width, so the raster's own 2.5 px lines are masked out:
// everything a stroke covers (plus a margin) is cut away, leaving the tags,
// №N and markers as public/vision/*-labels.webp. Run after prepare:vision.
import fs from 'node:fs/promises';
import sharp from 'sharp';

const ART = JSON.parse(await fs.readFile('components/vision/strokes.json', 'utf8'));
const FIGURES = 'components/vision/figures.json';
const figures = JSON.parse(await fs.readFile(FIGURES, 'utf8'));
// cut this much wider than the raster's lines, so their soft edges go too
const MARGIN = 5;
// design px cleared along the raster's top and bottom edge
const EDGE = 6;

for (const id of ['teach', 'train', 'operate']) {
  const f = figures[id];
  const src = `public/vision/${id}-lines.webp`;
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  // the strokes, in the raster's own frame and pixel size
  const { strokes, caps } = ART[id];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${info.width}" height="${info.height}" viewBox="${f.left} ${f.top} ${f.width} ${f.height}">
    ${strokes.map((s) => `<path d="${s.d}" fill="none" stroke="#fff" stroke-width="${s.sw + MARGIN * 2}" stroke-linejoin="round" stroke-linecap="square"/>`).join('')}
    ${caps.map((c) => `<polygon points="${c.points}" fill="#fff" stroke="#fff" stroke-width="${MARGIN * 2}" stroke-linejoin="round"/>`).join('')}
  </svg>`;
  const mask = await sharp(Buffer.from(svg)).resize(info.width, info.height).ensureAlpha().extractChannel(3).raw().toBuffer();

  // only line ends reach the panel's top and bottom edge, never a label
  const edge = Math.round((EDGE * info.height) / f.height);
  for (let i = 0; i < info.width * info.height; i++) {
    const y = Math.floor(i / info.width);
    const cut = y < edge || y >= info.height - edge ? 255 : mask[i];
    data[i * 4 + 3] = Math.round((data[i * 4 + 3] * (255 - cut)) / 255);
  }
  const out = `public/vision/${id}-labels.webp`;
  await sharp(data, { raw: info }).webp({ lossless: true }).toFile(out);
  f.labels = `/vision/${id}-labels.webp`;
  console.log(id, out);
}

await fs.writeFile(FIGURES, JSON.stringify(figures, null, 2) + '\n');
