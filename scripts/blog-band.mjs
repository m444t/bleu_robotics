// Blog teaser band: the line drawing as an alpha mask, so CSS can colour it per
// post and per state (light on blue/navy/grey bands, navy on orange/yellow).
// The export's light lines on #00088e become white with alpha.
//   desktop — Figma 450:12014, 208×73; the date chip's corner is cleared (it is live HTML on top)
//   mobile  — Figma 501:3248, 60×88 crop, no chip
// Sources: sources/blog/band*.svg (Figma SVG exports). Run: node scripts/blog-band.mjs
import sharp from 'sharp';

const SCALE = 2;
const BANDS = [
  { src: 'sources/blog/band.svg', out: 'public/blog/band-lines.png', chip: { w: 134, h: 19 } },
  { src: 'sources/blog/band-mobile.svg', out: 'public/blog/band-lines-mobile.png', chip: null },
];

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
