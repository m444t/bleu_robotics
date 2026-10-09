// Team photo: one composition baked twice (clean + gradient-mapped), so both
// layers line up exactly. The team section's Figma effect uses its own stops.
import sharp from 'sharp';
import { applyGradientMap } from './gradient-map.mjs';

const SRC = 'sources/team.jpg';
const OUT = 'public/media';
const TEAM_MAP = {
  stops: [
    { position: 0, color: [0.9960784316062927, 0.3607843220233917, 0.23529411852359772] },
    { position: 0.26442307233810425, color: [0, 0.0313725508749485, 0.5568627715110779] },
    { position: 0.7740384340286255, color: [0.3666760325431824, 0.3902963697910309, 0.7859262228012085] },
    { position: 0.9278846383094788, color: [1, 0.7372549176216125, 0.16862745583057404] },
  ],
};

const meta = await sharp(SRC).metadata();
await sharp(SRC).resize(2400).webp({ quality: 82 }).toFile(`${OUT}/team-clean.webp`);

// The treated layer is no longer baked here: public/media/team-treated.webp is Figma
// 572:2494's own render (2× export, webp q82), cropped to the 1346.6 × 719 media box.
// Run with BAKE_TREATED=1 to bake the old gradient-mapped version instead.
if (!process.env.BAKE_TREATED) process.exit(0);

const W = 1400;
const H = Math.round((W / meta.width) * meta.height);
const gray = await sharp(SRC).resize(W, H, { fit: 'fill' }).greyscale().raw().toBuffer();
// a bright interior: map its own tones directly (no matching to the hero's dark frame)
const rgb = applyGradientMap(gray, W, H, { map: TEAM_MAP });
await sharp(rgb, { raw: { width: W, height: H, channels: 3 } }).webp({ quality: 86 }).toFile(`${OUT}/team-treated.webp`);
console.log('team', meta.width, meta.height);
