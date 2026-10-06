// CPU port of the Figma "Gradient map" effect used on the hero media
// (CodeComponentId_384b08a4…_604). Same math as the WGSL fragment shader:
// luma -> repeat(fract) -> scatter dither -> 4-stop sRGB ramp.

export const FIGMA_GRADIENT_MAP = {
  offset: 8 / 100,
  scatter: 10 / 100,
  repeatFrequency: 1,
  repeatType: 'repeat',
  stops: [
    { position: 0.10000000149011612, color: [0.9960784316062927, 0.3607843220233917, 0.23529411852359772] },
    { position: 0.2211538404226303, color: [0, 0.0313725508749485, 0.5568627715110779] },
    { position: 0.7980769276618958, color: [0.3666760325431824, 0.3902963697910309, 0.7859262228012085] },
    { position: 0.8999999761581421, color: [1, 0.7372549176216125, 0.16862745583057404] },
  ],
};

const fract = (v) => v - Math.floor(v);

// rand3 from the shader (hash without sine), evaluated per output pixel.
export function rand3(x, y, z) {
  let px = fract(x * 0.1031);
  let py = fract(y * 0.1031);
  let pz = fract(z * 0.1031);
  const d = px * (py + 33.33) + py * (pz + 33.33) + pz * (px + 33.33);
  px += d;
  py += d;
  pz += d;
  return fract((px + py) * pz);
}

const linearToSrgbChannel = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

function gradientRamp(t, stops) {
  if (t <= stops[0].position) return stops[0].color;
  const last = stops[stops.length - 1];
  if (t >= last.position) return last.color;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (t <= b.position) {
      const f = (t - a.position) / Math.max(b.position - a.position, 1e-5);
      return [
        a.color[0] + (b.color[0] - a.color[0]) * f,
        a.color[1] + (b.color[1] - a.color[1]) * f,
        a.color[2] + (b.color[2] - a.color[2]) * f,
      ];
    }
  }
  return last.color;
}

/**
 * @param {Uint8Array} gray single-channel input (0..255), already graded
 * @param {number} width
 * @param {number} height
 * @param {{ srgbLuma?: boolean, map?: Partial<typeof FIGMA_GRADIENT_MAP> }} opts srgbLuma mirrors the shader's
 *   linear->sRGB step before luma; map overrides the gradient-map parameters
 * @returns {Buffer} RGB buffer
 */
export function applyGradientMap(gray, width, height, opts = {}) {
  const { offset, scatter, repeatFrequency, stops } = { ...FIGMA_GRADIENT_MAP, ...opts.map };
  const srgbLuma = opts.srgbLuma ?? true;
  const lut = new Float32Array(256);
  for (let v = 0; v < 256; v++) lut[v] = srgbLuma ? linearToSrgbChannel(v / 255) : v / 255;

  const out = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const luma = lut[gray[i]];
      const scatterOffset = (rand3(x, y, 1) - 0.5) * scatter;
      const t = fract((luma - offset) * repeatFrequency + scatterOffset);
      const c = gradientRamp(t, stops);
      out[i * 3] = Math.round(c[0] * 255);
      out[i * 3 + 1] = Math.round(c[1] * 255);
      out[i * 3 + 2] = Math.round(c[2] * 255);
    }
  }
  return out;
}

/** Build a 256-entry transfer curve that matches `source` luma histogram to `target`. */
export function histogramMatchLut(source, target) {
  const cdf = (arr) => {
    const h = new Float64Array(256);
    for (let i = 0; i < arr.length; i++) h[arr[i]]++;
    for (let i = 1; i < 256; i++) h[i] += h[i - 1];
    for (let i = 0; i < 256; i++) h[i] /= arr.length;
    return h;
  };
  const cs = cdf(source);
  const ct = cdf(target);
  const lut = new Uint8Array(256);
  let j = 0;
  for (let i = 0; i < 256; i++) {
    while (j < 255 && ct[j] < cs[i]) j++;
    lut[i] = j;
  }
  return lut;
}
