import type * as THREE from 'three';

/*
 * Grid bas-relief for the robot (Robot.tsx).
 *
 * The robot itself is never drawn. Each frame:
 *   1. HEIGHT — the existing scene + camera render the animated robot into a small
 *      offscreen target with an unlit height material: nearest robot point = 1,
 *      empty = 0. No lights, no shading — just depth.
 *   2. FALLOFF — two blur passes (horizontal, vertical) on that target soften the
 *      edge of the relief so the sheet rises smoothly out of the flat field.
 *   3. SHEET — a flat, subdivided plane facing an orthographic camera. Its vertex
 *      shader reads the height and lifts each vertex toward the camera, with a
 *      slight oblique shift so the lift shows as bent lines. The fragment shader
 *      draws the grid from the sheet's undeformed coordinates, so lines stay a
 *      perfect square grid where flat and follow the relief where lifted. The
 *      sheet is one flat colour and is cut off at a hard rectangle.
 *
 * Sizes are in CSS pixels at the reference canvas height (590, desktop) and scale
 * with the canvas, so the grid density relative to the robot stays the same.
 */

export const RELIEF = {
  /** grid cell size, px (cells are square) */
  gridCellSize: 14,
  /** line thickness, px on screen */
  gridLineWidth: 1,
  /** line colour */
  gridColor: 0x00088e,
  /** sheet colour — matches the careers card so only the lines read */
  sheetColor: 0xdddddd,
  /** hard-edged grid rectangle, px, centred in the robot area (clamped to it) */
  gridBoundsWidth: 616,
  gridBoundsHeight: 504,

  /** how far the nearest robot point lifts the sheet toward the camera, px */
  reliefDepth: 46,
  /** 0 = flat embossed silhouette, 1 = the robot's full depth variation */
  reliefStrength: 0.85,
  /** edge softness of the relief (blur radius), px */
  reliefFalloff: 10,
  /** on-screen shift per px of lift — the oblique "view" that makes depth visible */
  reliefTilt: { x: -0.35, y: 0.75 },
  /** robot depth (metres) mapped onto the relief: from its nearest point back this far */
  sourceDepthRange: 0.32,

  /** robot size inside the grid field */
  robotScale: 1,
  /** robot position inside the grid field, px (+x right, +y down) */
  robotOffsetX: 0,
  robotOffsetY: 0,
};

/** canvas height the px values above are designed for */
const REFERENCE_H = 590;
/** sheet subdivision: one vertex every this many px */
const SEGMENT_PX = 3;

type Three = typeof THREE;

const FULLSCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const BLUR_FRAG = /* glsl */ `
uniform sampler2D uTex;
uniform vec2 uStep; // texel step × spread
varying vec2 vUv;
void main() {
  float sum = 0.0;
  float wsum = 0.0;
  for (int i = -6; i <= 6; i++) {
    float w = exp(-float(i * i) / 18.0); // sigma = 3 taps
    sum += texture2D(uTex, vUv + uStep * float(i)).r * w;
    wsum += w;
  }
  gl_FragColor = vec4(sum / wsum, 0.0, 0.0, 1.0);
}
`;

const HEIGHT_VERT = /* glsl */ `
varying float vViewZ;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewZ = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const HEIGHT_FRAG = /* glsl */ `
uniform float uNear;
uniform float uRange;
uniform float uStrength;
varying float vViewZ;
void main() {
  float d = clamp(1.0 - (vViewZ - uNear) / uRange, 0.0, 1.0);
  gl_FragColor = vec4(mix(1.0, d, uStrength), 0.0, 0.0, 1.0);
}
`;

const SHEET_VERT = /* glsl */ `
uniform sampler2D uHeight;
uniform vec2 uCanvas;      // canvas size, px
uniform vec2 uRobotOffset; // px, y up
uniform float uRobotScale;
uniform float uDepth;      // px
uniform vec2 uTilt;
varying vec2 vGrid;
varying vec2 vScreen;
void main() {
  vec2 p = position.xy; // px from the canvas centre, y up
  vec2 uv = (p - uRobotOffset) / (uCanvas * uRobotScale) + 0.5;
  float h = texture2D(uHeight, uv).r * uDepth;
  vec3 q = vec3(p + uTilt * h, h);
  vGrid = p;
  vScreen = q.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(q, 1.0);
}
`;

const SHEET_FRAG = /* glsl */ `
uniform float uCell;
uniform float uLineWidth; // device px
uniform vec3 uLineColor;
uniform vec3 uSheetColor;
uniform vec2 uBounds;     // half size, px
varying vec2 vGrid;
varying vec2 vScreen;
void main() {
  if (abs(vScreen.x) > uBounds.x || abs(vScreen.y) > uBounds.y) discard;
  vec2 fw = max(fwidth(vGrid), vec2(1e-4));
  // device pixels to the nearest line, measured on the deformed sheet
  vec2 d = abs(fract(vGrid / uCell + 0.5) - 0.5) * uCell / fw;
  float halfW = 0.5 * max(uLineWidth, 1.0);
  vec2 l = 1.0 - smoothstep(halfW - 0.5, halfW + 0.5, d);
  float line = max(l.x, l.y) * min(uLineWidth, 1.0);
  gl_FragColor = vec4(mix(uSheetColor, uLineColor, line), 1.0);
}
`;

/**
 * Replaces the direct robot render. `scene`/`camera` are the existing robot scene
 * and camera; `model` is used once to find its nearest point for the depth range.
 */
export function createRelief(
  THREE_: Three,
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  model: THREE.Object3D,
) {
  const rtOpts = { depthBuffer: true, type: THREE_.UnsignedByteType, format: THREE_.RGBAFormat };
  const heightRT = new THREE_.WebGLRenderTarget(1, 1, rtOpts);
  const blurRT = new THREE_.WebGLRenderTarget(1, 1, { ...rtOpts, depthBuffer: false });

  /* ---- 1. height material: depth of the robot, normalised from its nearest visible point ---- */
  const nearest = nearestDepth(THREE_, model, camera);
  const heightMat = new THREE_.ShaderMaterial({
    vertexShader: HEIGHT_VERT,
    fragmentShader: HEIGHT_FRAG,
    uniforms: {
      uNear: { value: nearest },
      uRange: { value: RELIEF.sourceDepthRange },
      uStrength: { value: RELIEF.reliefStrength },
    },
  });

  /* ---- 2. blur ---- */
  const blurMat = new THREE_.ShaderMaterial({
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: BLUR_FRAG,
    uniforms: { uTex: { value: null }, uStep: { value: new THREE_.Vector2() } },
    depthTest: false,
    depthWrite: false,
  });
  const quadScene = new THREE_.Scene();
  const quad = new THREE_.Mesh(new THREE_.PlaneGeometry(2, 2), blurMat);
  quad.frustumCulled = false;
  quadScene.add(quad);

  /* ---- 3. sheet ---- */
  const sheetUniforms = {
    uHeight: { value: heightRT.texture },
    uCanvas: { value: new THREE_.Vector2(1, 1) },
    uRobotOffset: { value: new THREE_.Vector2() },
    uRobotScale: { value: RELIEF.robotScale },
    uDepth: { value: RELIEF.reliefDepth },
    uTilt: { value: new THREE_.Vector2(RELIEF.reliefTilt.x, RELIEF.reliefTilt.y) },
    uCell: { value: RELIEF.gridCellSize },
    uLineWidth: { value: RELIEF.gridLineWidth },
    // written straight to the screen, so the hex values are used as-is
    uLineColor: { value: new THREE_.Color().setHex(RELIEF.gridColor, THREE_.LinearSRGBColorSpace) },
    uSheetColor: { value: new THREE_.Color().setHex(RELIEF.sheetColor, THREE_.LinearSRGBColorSpace) },
    uBounds: { value: new THREE_.Vector2(1, 1) },
  };
  const sheetMat = new THREE_.ShaderMaterial({
    vertexShader: SHEET_VERT,
    fragmentShader: SHEET_FRAG,
    uniforms: sheetUniforms,
  });
  const sheet = new THREE_.Mesh(new THREE_.BufferGeometry(), sheetMat);
  sheet.frustumCulled = false;
  const sheetScene = new THREE_.Scene();
  sheetScene.add(sheet);
  const sheetCam = new THREE_.OrthographicCamera(-1, 1, 1, -1, -1000, 1000);

  let blurPx = 1; // falloff radius in height-target texels

  /** w/h: canvas size in CSS px; dpr: the renderer's pixel ratio */
  const resize = (w: number, h: number, dpr: number) => {
    const s = h / REFERENCE_H;
    // height + blur at half CSS resolution: plenty for a softened relief
    const rw = Math.max(2, Math.round(w / 2));
    const rh = Math.max(2, Math.round(h / 2));
    heightRT.setSize(rw, rh);
    blurRT.setSize(rw, rh);
    blurPx = (RELIEF.reliefFalloff * s) / 2;

    sheetCam.left = -w / 2;
    sheetCam.right = w / 2;
    sheetCam.top = h / 2;
    sheetCam.bottom = -h / 2;
    sheetCam.updateProjectionMatrix();

    const u = sheetUniforms;
    u.uCanvas.value.set(w, h);
    u.uRobotOffset.value.set(RELIEF.robotOffsetX * s, -RELIEF.robotOffsetY * s);
    u.uDepth.value = RELIEF.reliefDepth * s;
    u.uCell.value = RELIEF.gridCellSize * s;
    u.uLineWidth.value = RELIEF.gridLineWidth * dpr;
    const bw = Math.min(RELIEF.gridBoundsWidth * s, w);
    const bh = Math.min(RELIEF.gridBoundsHeight * s, h);
    u.uBounds.value.set(bw / 2, bh / 2);

    // the sheet overhangs the bounds by the largest shift, so a lifted edge never
    // pulls away from the boundary; fragments outside it are discarded
    const lift = RELIEF.reliefDepth * s;
    const margin = Math.ceil(lift * Math.max(Math.abs(RELIEF.reliefTilt.x), Math.abs(RELIEF.reliefTilt.y))) + 4;
    const sw = bw + margin * 2;
    const sh = bh + margin * 2;
    sheet.geometry.dispose();
    sheet.geometry = new THREE_.PlaneGeometry(sw, sh, Math.ceil(sw / SEGMENT_PX), Math.ceil(sh / SEGMENT_PX));
  };

  const render = () => {
    const prevTarget = renderer.getRenderTarget();

    // 1. height of the animated robot
    scene.overrideMaterial = heightMat;
    renderer.setRenderTarget(heightRT);
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    renderer.render(scene, camera);
    scene.overrideMaterial = null;

    // 2. separable blur, back into heightRT
    const spread = blurPx / 3; // 13 taps, sigma 3 taps → ~2 sigma = blurPx
    blurMat.uniforms.uTex.value = heightRT.texture;
    blurMat.uniforms.uStep.value.set(spread / heightRT.width, 0);
    renderer.setRenderTarget(blurRT);
    renderer.render(quadScene, sheetCam);
    blurMat.uniforms.uTex.value = blurRT.texture;
    blurMat.uniforms.uStep.value.set(0, spread / heightRT.height);
    renderer.setRenderTarget(heightRT);
    renderer.render(quadScene, sheetCam);

    // 3. the sheet, to the canvas (transparent outside the grid rectangle)
    renderer.setRenderTarget(prevTarget);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(sheetScene, sheetCam);
  };

  const dispose = () => {
    heightRT.dispose();
    blurRT.dispose();
    heightMat.dispose();
    blurMat.dispose();
    quad.geometry.dispose();
    sheetMat.dispose();
    sheet.geometry.dispose();
  };

  return { resize, render, dispose };
}

/** view depth (metres) of the robot's nearest vertex inside the camera's vertical frame */
function nearestDepth(THREE_: Three, model: THREE.Object3D, camera: THREE.PerspectiveCamera) {
  camera.updateMatrixWorld(true);
  model.updateMatrixWorld(true);
  const v = new THREE_.Vector3();
  const view = new THREE_.Vector3();
  const ndc = new THREE_.Vector3();
  let best = Infinity;
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i += 4) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      ndc.copy(v).project(camera);
      if (Math.abs(ndc.y) > 1) continue;
      view.copy(v).applyMatrix4(camera.matrixWorldInverse);
      best = Math.min(best, -view.z);
    }
  });
  return Number.isFinite(best) ? best : camera.position.length();
}
