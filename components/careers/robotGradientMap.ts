import type * as THREE from 'three';

/*
 * Figma "Gradient map" on the robot (Robot.tsx) — the same effect, stops and maths
 * as the team photo (scripts/gradient-map.mjs, scripts/bake-team.mjs), done live in
 * the robot's material: the lit, tone-mapped colour → luma → offset + scatter
 * dither → repeat → 4-stop sRGB ramp. No extra pass; only robot pixels are mapped.
 */

export const GRADIENT_MAP = {
  /**
   * input levels on the luma before mapping: the lit matte grey only spans about
   * 0.55–0.84, so stretch it to use the whole ramp like the team photo's robot
   */
  levels: { black: 0.48, white: 0.84 },
  /** Figma "Offset" */
  offset: 0.08,
  /** Figma "Scatter" — per-pixel dither of the ramp position */
  scatter: 0.1,
  /** Figma "Repeat frequency" (repeat type: Repeat) */
  repeatFrequency: 1,
  /** Figma gradient stops (mix space sRGB) */
  stops: [
    { position: 0, color: 0xfe5c3c },
    { position: 0.2644, color: 0x00088e },
    { position: 0.774, color: 0x5e64c8 },
    { position: 0.9279, color: 0xffbc2b },
  ],
};

/** robot surface before mapping: the matte grey the tones are read from */
export const ROBOT_MATERIAL = { color: 0x9e9ea0, roughness: 0.85, metalness: 0 };

const FRAG_HEAD = /* glsl */ `
uniform vec2 uGmLevels;
uniform float uGmOffset;
uniform float uGmScatter;
uniform float uGmRepeat;
uniform float uGmPixelRatio;
uniform float uGmStopPos[4];
uniform vec3 uGmStopColor[4];

// rand3 from the Figma shader (hash without sine)
float gmRand3(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float gmToSrgb(float c) {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * pow(c, 1.0 / 2.4) - 0.055;
}

vec3 gmRamp(float t) {
  if (t <= uGmStopPos[0]) return uGmStopColor[0];
  for (int i = 0; i < 3; i++) {
    if (t <= uGmStopPos[i + 1]) {
      float f = (t - uGmStopPos[i]) / max(uGmStopPos[i + 1] - uGmStopPos[i], 1e-5);
      return mix(uGmStopColor[i], uGmStopColor[i + 1], f);
    }
  }
  return uGmStopColor[3];
}
`;

// after <colorspace_fragment>: gl_FragColor is the robot's final sRGB colour
const FRAG_BODY = /* glsl */ `
{
  float luma = gmToSrgb(dot(clamp(gl_FragColor.rgb, 0.0, 1.0), vec3(0.2126, 0.7152, 0.0722)));
  luma = clamp((luma - uGmLevels.x) / (uGmLevels.y - uGmLevels.x), 0.0, 1.0);
  // grain per CSS pixel, like the baked photos
  vec2 cell = floor(gl_FragCoord.xy / uGmPixelRatio);
  float scatter = (gmRand3(vec3(cell, 1.0)) - 0.5) * uGmScatter;
  float t = fract((luma - uGmOffset) * uGmRepeat + scatter);
  gl_FragColor.rgb = gmRamp(t);
}
`;

export function createGradientMapUniforms(THREE_: typeof THREE) {
  return {
    uGmLevels: { value: new THREE_.Vector2(GRADIENT_MAP.levels.black, GRADIENT_MAP.levels.white) },
    uGmOffset: { value: GRADIENT_MAP.offset },
    uGmScatter: { value: GRADIENT_MAP.scatter },
    uGmRepeat: { value: GRADIENT_MAP.repeatFrequency },
    uGmPixelRatio: { value: 1 },
    uGmStopPos: { value: GRADIENT_MAP.stops.map((s) => s.position) },
    // written straight to the sRGB output, so the hex values are used as-is
    uGmStopColor: {
      value: GRADIENT_MAP.stops.map((s) => new THREE_.Color().setHex(s.color, THREE_.LinearSRGBColorSpace)),
    },
  };
}

/** the robot's lit material with the gradient map applied to its final colour */
export function createGradientMapMaterial(
  THREE_: typeof THREE,
  uniforms: ReturnType<typeof createGradientMapUniforms>,
) {
  const material = new THREE_.MeshStandardMaterial(ROBOT_MATERIAL);
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_HEAD}`)
      .replace('#include <colorspace_fragment>', `#include <colorspace_fragment>\n${FRAG_BODY}`);
  };
  return material;
}
