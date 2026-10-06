// Prepares the "Vision" section artwork exported from Figma (sources/vision/*.svg).
// Each figure export is split so the blue figure box can move on its own:
//   - the canvas background rects and the grey panel/blue box are dropped
//     (both are drawn in CSS), the line drawing is rasterised at 2x
//   - the offset of the blue box inside the export is recorded, so the line
//     drawing can be positioned exactly against the CSS panel.
import fs from 'node:fs/promises';
import sharp from 'sharp';

const SRC = 'sources/vision';
const OUT = 'public/vision';
const DENSITY = 144; // 2x

// Figma wraps node exports in the page + frame backgrounds; strip them.
const stripCanvas = (svg) =>
  svg
    .split('\n')
    .filter((l) => !/fill="#363636"\/>|fill="#494949"\/>|^<rect width="1440" height="\d+" transform=/.test(l))
    .join('\n');

const figures = {};
for (const id of ['teach', 'train', 'operate']) {
  const lines = stripCanvas(await fs.readFile(`${SRC}/${id}.svg`, 'utf8')).split('\n');
  const panel = lines.findIndex((l) => l.includes('id="Rectangle 2147245732"'));
  const box = lines.findIndex((l) => l.includes('fill="#00088E"'));
  const [, bx, by] = lines[box].match(/translate\(([\d.]+) ([\d.]+)\)/);
  const fg = lines.filter((_, i) => i !== panel && i !== box).join('\n');
  const { width, height } = await sharp(Buffer.from(fg)).metadata();
  await sharp(Buffer.from(fg), { density: DENSITY }).webp({ lossless: true }).toFile(`${OUT}/${id}-lines.webp`);
  // the blue box sits at (64, 68) inside the 657x684 panel
  figures[id] = {
    src: `/vision/${id}-lines.webp`,
    left: +(64 - Number(bx)).toFixed(3),
    top: +(68 - Number(by)).toFixed(3),
    width,
    height,
  };
  console.log(id, figures[id]);
}

await fs.writeFile(`${OUT}/isogrid.svg`, stripCanvas(await fs.readFile(`${SRC}/isogrid.svg`, 'utf8')));

// tab pictogram as an alpha mask so its colour can transition in CSS
// (exported pointing right; the tab shows it pointing down)
await sharp(await fs.readFile(`${SRC}/tab-icon.svg`), { density: 288 }).rotate(90).png().toFile(`${OUT}/tab-icon-mask.png`);

await fs.writeFile('components/vision/figures.json', JSON.stringify(figures, null, 2) + '\n');
