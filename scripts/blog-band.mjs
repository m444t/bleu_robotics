// Blog teaser band: the line drawing as an alpha mask, so CSS can colour it per
// post and per state (light on blue/navy/grey bands, navy on orange/yellow).
//   desktop — Figma 522:4293, 208×100: its strokes (sources/blog/band-strokes.json)
//             drawn white into an SVG that runs 60px past the band top and bottom,
//             so a taller row (tablet) shows more of the drawing instead of cutting it
//   mobile  — Figma 501:3248, 60×88 crop, no chip; the export's light lines on
//             #00088e become white with alpha
// Run: node scripts/blog-band.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const SCALE = 2;
const BANDS = [{ src: 'sources/blog/band-mobile.svg', out: 'public/blog/band-lines-mobile.png', chip: null }];

/* ---- desktop: vector mask ---- */

const SW = 1.6; // every stroke on the page
const BLEED = 60; // drawing shown above / below the 100px band
const band = JSON.parse(readFileSync('sources/blog/band-strokes.json', 'utf8'));
const r2 = (v) => Math.round(v * 100) / 100;
// filled wedge on an open line's ends, pointing outwards (same shape as the footer art's caps)
const caps = (d) => {
  const [x1, y1, x2, y2] = d.match(/-?[\d.]+/g).map(Number);
  return [
    [x1, y1, x2, y2],
    [x2, y2, x1, y1],
  ].map(([px, py, qx, qy]) => {
    let dx = px - qx;
    let dy = py - qy;
    const L = Math.hypot(dx, dy);
    dx /= L;
    dy /= L;
    const nx = -dy;
    const ny = dx;
    const half = SW * 2.885;
    const len = SW * 5;
    const pts = [
      [px + nx * half, py + ny * half],
      [px - nx * half, py - ny * half],
      [px - dx * len - (nx * SW) / 2, py - dy * len - (ny * SW) / 2],
      [px - dx * len + (nx * SW) / 2, py - dy * len + (ny * SW) / 2],
    ];
    return `<polygon points="${pts.map((p) => p.map(r2).join(',')).join(' ')}"/>`;
  });
};
const H = band.h + 2 * BLEED;
const svg = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="${band.w}" height="${H}" viewBox="0 ${-BLEED} ${band.w} ${H}">`,
  `<g fill="none" stroke="#fff" stroke-width="${SW}">`,
  ...band.strokes.map((s) => `<path d="${s.d}"${s.dash.length ? ` stroke-dasharray="${s.dash.join(' ')}"` : ''}/>`),
  '</g>',
  '<g fill="#fff">',
  ...band.strokes.filter((s) => s.caps).flatMap((s) => caps(s.d)),
  '</g>',
  '</svg>',
].join('\n');
writeFileSync('public/blog/band-lines.svg', svg + '\n');
console.log('public/blog/band-lines.svg', band.w, H);

/* ---- mobile: raster mask from the Figma export ---- */

for (const { src, out, chip } of BANDS) {
  const { data, info } = await sharp(src, { density: 72 * SCALE }).raw().toBuffer({ resolveWithObject: true });
  const px = Buffer.alloc(info.width * info.height * 4);
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels;
      // line #efefef over band #00088e: red runs 0 → 239
      let a = Math.min(255, Math.round((data[i] / 239) * 255));
      if (chip && x < chip.w * SCALE && y < chip.h * SCALE) a = 0;
      const o = (y * info.width + x) * 4;
      px[o] = px[o + 1] = px[o + 2] = 255;
      px[o + 3] = a;
    }
  }
  await sharp(px, { raw: { width: info.width, height: info.height, channels: 4 } }).png({ compressionLevel: 9 }).toFile(out);
  console.log(out, info.width, info.height);
}
