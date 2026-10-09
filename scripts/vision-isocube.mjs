// The Vision text card's grid as one isometric box (after the "1 HOUR" reference): a top face
// of rhombi, a left face of verticals + lines falling to the right, a right face of verticals
// + lines rising to the right. Drawn once in the Vision frame's own coordinates (design px,
// 1440 × 762) and shown through one window over the white card and the grey strip beside it,
// so the box runs on unbroken from white into grey. One line colour: a shade darker than the
// white, a lot lighter than the grey.
// Run: node scripts/vision-isocube.mjs
import { writeFileSync } from 'node:fs';

const P = 17.5; // vertical line spacing: the reference's density at the card's size
const S = Math.tan(Math.PI / 6); // 30°
const E = 2 * S * P; // spacing of each diagonal family, measured vertically: an iso cell's edge
const CX = 783 - 12 * P; // the box's vertical front edge: well inside the white card, so its right face
// runs on across the rest of the card and over the grey strip — one box, not a corner at the seam
const CY = 541; // where that edge meets the top face: the top face a triangle at the card's top
const X0 = -300; // the drawing's left edge (the card can sit this far left on short screens)
const X1 = 860;
const H = 762;
const SW = 1.6;

const r = (v) => Math.round(v * 100) / 100;
const W = X1 - X0;

const svg = (stroke, CX, CY) => {
  const verticals = [];
  for (let n = Math.ceil((X0 - CX) / P); CX + n * P <= X1; n++) {
    const x = CX + n * P;
    verticals.push(`M${r(x)} 0V${H}`);
  }
  // lines of slope ±S through the lattice, enough to cover the drawing
  const diag = (sign) => {
    const out = [];
    const span = S * W + H;
    for (let m = -Math.ceil(span / E) - 2; m <= Math.ceil(span / E) + 2; m++) {
      const yAt = (x) => CY + sign * S * (x - CX) + m * E;
      out.push(`M${r(X0)} ${r(yAt(X0))}L${r(X1)} ${r(yAt(X1))}`);
    }
    return out;
  };
  const falling = diag(1); // y grows with x: the left face's lines
  const rising = diag(-1); // y falls with x: the right face's lines

  // the three faces (the top face sits above both the left and right faces' upper edges)
  const far = 4000;
  const top = `M${CX} ${CY}L${CX - far} ${CY - S * far}L${CX - far} ${-far}L${CX + far} ${-far}L${CX + far} ${CY - S * far}Z`;
  const left = `M${CX} ${CY}L${CX - far} ${CY - S * far}L${CX - far} ${far}L${CX} ${far}Z`;
  const right = `M${CX} ${CY}L${CX + far} ${CY - S * far}L${CX + far} ${far}L${CX} ${far}Z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${X0} 0 ${W} ${H}">
<defs>
<clipPath id="top"><path d="${top}"/></clipPath>
<clipPath id="left"><path d="${left}"/></clipPath>
<clipPath id="right"><path d="${right}"/></clipPath>
</defs>
<g fill="none" stroke="${stroke}" stroke-width="${SW}">
<g clip-path="url(#top)"><path d="${falling.join('')}"/><path d="${rising.join('')}"/></g>
<g clip-path="url(#left)"><path d="${verticals.join('')}"/><path d="${falling.join('')}"/></g>
<g clip-path="url(#right)"><path d="${verticals.join('')}"/><path d="${rising.join('')}"/></g>
</g>
</svg>
`;
};

writeFileSync('public/vision/isocube.svg', svg('#efefef', CX, CY));
console.log('isocube', W, H, { origin: X0, corner: [CX, CY] });
