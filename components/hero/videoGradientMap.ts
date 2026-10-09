/*
 * The hero's treated layer for a video slide: the same Figma "Gradient map" the photos are
 * baked with (scripts/bake-media.mjs + gradient-map.mjs), done live in WebGL on the clean
 * layer's own <video>, so the two layers can never drift apart.
 * grey (sRGB luminance) → histogram match to the Figma input (LUT) → linear→sRGB step →
 * offset + scatter dither → 4-stop sRGB ramp. The grain is one canvas px, the canvas as wide
 * as the baked treated photos (2560), so it matches their grain.
 */

export const TREATED_W = 2560;

/**
 * Histogram match of the hero video's greys (24 frames across it) to the Figma treated
 * input's, as bakeMedia does per photo. Only valid for that video: re-measure if it changes.
 */
const VIDEO_LUT = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
  3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 7, 7, 7, 7, 7, 7, 8, 8, 8, 8, 9, 9, 9, 9, 10, 10, 10, 11, 11,
  12, 12, 12, 13, 13, 13, 14, 14, 14, 15, 15, 15, 16, 16, 17, 17, 18, 19, 19, 20, 21, 21, 22, 22, 23, 23, 24, 24, 25,
  25, 26, 26, 27, 27, 27, 28, 28, 28, 29, 29, 30, 30, 31, 31, 32, 32, 33, 33, 33, 34, 34, 35, 35, 36, 36, 37, 37, 38,
  38, 38, 39, 39, 40, 40, 41, 41, 42, 42, 42, 43, 43, 44, 44, 45, 45, 46, 46, 47, 47, 48, 49, 50, 51, 52, 52, 53, 55,
  56, 57, 58, 59, 61, 62, 63, 64, 65, 67, 68, 71, 73, 77, 81, 85, 88, 91, 97, 102, 108, 113, 117, 122, 133, 140, 157,
  168, 175, 185, 190, 194, 197, 201, 204, 207, 210, 212, 214, 217, 219, 221, 223, 225, 226, 227, 228, 229, 230, 231,
  232, 232, 233, 234, 234, 235, 236, 236, 237, 237, 238, 238, 239, 239, 240, 240, 241, 241, 242, 242, 242, 243, 243,
  244, 244, 245, 245, 245, 246, 246, 246, 247, 247, 247, 248, 248, 248, 249, 249, 249, 250, 250, 252,
];

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

// FIGMA_GRADIENT_MAP (scripts/gradient-map.mjs): offset 0.08, scatter 0.1, repeat 1
const FRAG = `
precision highp float;
uniform sampler2D uVideo;
uniform sampler2D uLut;
varying vec2 vUv;

vec3 toLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
float toSrgb(float c) {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * pow(c, 1.0 / 2.4) - 0.055;
}
// rand3 from the Figma shader (hash without sine)
float rand3(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
vec3 ramp(float t) {
  const vec3 c0 = vec3(0.99608, 0.36078, 0.23529);
  const vec3 c1 = vec3(0.0, 0.03137, 0.55686);
  const vec3 c2 = vec3(0.36668, 0.3903, 0.78593);
  const vec3 c3 = vec3(1.0, 0.73725, 0.16863);
  if (t <= 0.1) return c0;
  if (t <= 0.22115) return mix(c0, c1, (t - 0.1) / 0.12115);
  if (t <= 0.79808) return mix(c1, c2, (t - 0.22115) / 0.57693);
  if (t <= 0.9) return mix(c2, c3, (t - 0.79808) / 0.10192);
  return c3;
}

void main() {
  vec3 rgb = texture2D(uVideo, vUv).rgb;
  float grey = toSrgb(dot(toLinear(rgb), vec3(0.2126, 0.7152, 0.0722)));
  float matched = texture2D(uLut, vec2((floor(grey * 255.0 + 0.5) + 0.5) / 256.0, 0.5)).r;
  float luma = toSrgb(matched);
  float scatter = (rand3(vec3(floor(gl_FragCoord.xy), 1.0)) - 0.5) * 0.1;
  gl_FragColor = vec4(ramp(fract(luma - 0.08 + scatter)), 1.0);
}
`;

/** Draws `video` through the gradient map into `canvas` on every new frame. Returns a cleanup. */
export function startTreatedVideo(canvas: HTMLCanvasElement, video: HTMLVideoElement): () => void {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false });
  if (!gl) return () => {};

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return () => {};
  gl.useProgram(program);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const texture = (unit: number, filter: number) => {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    return t;
  };
  const lutTex = texture(1, gl.NEAREST);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 256, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array(VIDEO_LUT));
  const videoTex = texture(0, gl.LINEAR);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.uniform1i(gl.getUniformLocation(program, 'uVideo'), 0);
  gl.uniform1i(gl.getUniformLocation(program, 'uLut'), 1);
  gl.viewport(0, 0, canvas.width, canvas.height);

  const draw = () => {
    if (video.readyState < 2) return;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, videoTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  // a draw per decoded video frame where supported, otherwise per animation frame
  let handle = 0;
  let stopped = false;
  const rvfc = 'requestVideoFrameCallback' in video;
  const loop = () => {
    if (stopped) return;
    draw();
    handle = rvfc ? video.requestVideoFrameCallback(loop) : requestAnimationFrame(loop);
  };
  loop();
  // paused or seeked frames (and the first one) still need drawing
  video.addEventListener('loadeddata', draw);
  video.addEventListener('seeked', draw);

  return () => {
    stopped = true;
    if (rvfc) video.cancelVideoFrameCallback(handle);
    else cancelAnimationFrame(handle);
    video.removeEventListener('loadeddata', draw);
    video.removeEventListener('seeked', draw);
    // free what this run made, but keep the context: a canvas only ever has the one
    gl.deleteTexture(videoTex);
    gl.deleteTexture(lutTex);
    gl.deleteBuffer(buf);
    gl.deleteProgram(program);
  };
}
