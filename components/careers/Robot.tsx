'use client';

import { useEffect, useRef } from 'react';
import type * as THREE from 'three';
import styles from './Careers.module.css';
import { createRelief } from './reliefGrid';
import { createGradientMapMaterial, createGradientMapUniforms } from './robotGradientMap';

/*
 * Unitree G1 from the Blender file (public/models/g1.glb, see scripts/README).
 * Blender's NLA "look" actions are exported as clips; instead of playing them
 * through time, each one is scrubbed by the cursor and both run at once, so the
 * robot turns (waist, Look_LeftRight) and tilts (torso, Look_UpDown) together.
 */

const FPS = 24;
// the smooth middle of each ping-pong action: extreme → neutral → other extreme
const LEFT_RIGHT = { clip: 'Look_LeftRight', bone: 'waist_yaw_link', from: 45, mid: 75, to: 105 };
const UP_DOWN = { clip: 'Look_UpDown', bone: 'torso_link', from: 36, mid: 60, to: 84 };
const BASE = {
  clip: 'Base_ArmsDown',
  bones: ['left_elbow_link', 'right_elbow_link', 'left_shoulder_roll_link', 'right_shoulder_roll_link'],
};
// follow speed (1/s) — exponential smoothing so turning and tilting ease together
const FOLLOW = 5;
// touch screens (no cursor): how far the robot turns / tilts as it scrolls through the viewport
const SCROLL_TURN = 0.35;
const SCROLL_TILT = 0.4;

const frameTime = (f: number) => f / FPS;

// framing from the Figma reference: visible height in head-heights, gap above the head
const HEAD_NODE = 'G1_|_head_link';
const FRAME = { heads: 1.8, topMargin: 0.08, rise: -0.1 };
// the rig faces +X; turn it to the camera, then well round to its left — towards the
// open-positions list on the left of the section
const BASE_YAW = -Math.PI / 2 - 1.0;
// grid bas-relief (reliefGrid.ts) instead of the gradient-mapped robot: a full grid field
// whose lines rise and bend with the robot's height
const RELIEF_GRID = true;

export default function Robot({ active }: { active: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const host = hostRef.current!;
    let disposed = false;
    let raf = 0;
    let inView = false;
    let cleanup = () => {};

    (async () => {
      const THREE_ = await import('three');
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const { DRACOLoader } = await import('three/examples/jsm/loaders/DRACOLoader.js');
      if (disposed) return;

      const renderer = new THREE_.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
      renderer.outputColorSpace = THREE_.SRGBColorSpace;
      renderer.toneMapping = THREE_.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1;
      renderer.domElement.className = styles.robotCanvas;
      host.appendChild(renderer.domElement);

      const scene = new THREE_.Scene();
      const camera = new THREE_.PerspectiveCamera(26, 1, 0.01, 50);
      // soft, flat studio light (the reference reads almost as a matte grey cast)
      scene.add(new THREE_.HemisphereLight(0xffffff, 0x9a9a9a, 2.1));
      const key = new THREE_.DirectionalLight(0xffffff, 1.3);
      key.position.set(-1.5, 2.5, 3);
      scene.add(key);
      const rim = new THREE_.DirectionalLight(0xffffff, 0.6);
      rim.position.set(2.5, 1.5, -2);
      scene.add(rim);

      const draco = new DRACOLoader().setDecoderPath('/draco/');
      const gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync('/models/g1.glb');
      draco.dispose();
      if (disposed) {
        renderer.dispose();
        return;
      }
      const model = gltf.scene;
      scene.add(model);

      // matte grey, lit, then gradient-mapped like the team photo (robotGradientMap.ts)
      const gmUniforms = createGradientMapUniforms(THREE_);
      const material = createGradientMapMaterial(THREE_, gmUniforms);
      model.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.material = material;
      });

      /* ---- NLA actions → mixer, each limited to the bones it really drives ---- */
      const mixer = new THREE_.AnimationMixer(model);
      const only = (name: string, bones: string[]) => {
        const src = gltf.animations.find((c) => c.name === name);
        if (!src) return null;
        const clip = src.clone();
        clip.tracks = clip.tracks.filter((t) => bones.includes(t.name.split('.')[0]) && t.name.endsWith('.quaternion'));
        const action = mixer.clipAction(clip);
        action.play();
        action.paused = true;
        return action;
      };
      const base = only(BASE.clip, BASE.bones);
      const yaw = only(LEFT_RIGHT.clip, [LEFT_RIGHT.bone]);
      const pitch = only(UP_DOWN.clip, [UP_DOWN.bone]);
      if (base) base.time = 0;

      /* ---- frame the upper body ---- */
      const pose = (cx: number, y: number) => {
        // the waist action's first extreme turns the robot to screen-right, so mirror x
        const x = -cx;
        if (yaw)
          yaw.time = frameTime(
            x < 0
              ? LEFT_RIGHT.mid + x * (LEFT_RIGHT.mid - LEFT_RIGHT.from)
              : LEFT_RIGHT.mid + x * (LEFT_RIGHT.to - LEFT_RIGHT.mid),
          );
        if (pitch)
          pitch.time = frameTime(
            y < 0 ? UP_DOWN.mid + y * (UP_DOWN.mid - UP_DOWN.from) : UP_DOWN.mid + y * (UP_DOWN.to - UP_DOWN.mid),
          );
        mixer.update(0);
      };
      /* ---- frame like the reference: head + upper torso, cut flat across the chest ---- */
      model.rotation.y = BASE_YAW;
      pose(0, 0);
      model.updateMatrixWorld(true);
      const box = new THREE_.Box3().setFromObject(model);
      const center = box.getCenter(new THREE_.Vector3());
      const head = model.getObjectByName(HEAD_NODE);
      const headBox = head ? new THREE_.Box3().setFromObject(head) : box;
      const viewH = (headBox.max.y - headBox.min.y) * FRAME.heads; // visible height, world units
      const lookY = box.max.y + viewH * FRAME.topMargin - viewH / 2;
      const dist = viewH / 2 / Math.tan(THREE_.MathUtils.degToRad(camera.fov / 2));
      // camera a touch below the look point, so the head is seen slightly from beneath
      camera.position.set(center.x, lookY + viewH * FRAME.rise, center.z + dist);
      camera.lookAt(center.x, lookY, center.z);

      // with the relief on, the robot is never drawn itself: it only drives the grid
      const relief = RELIEF_GRID ? createRelief(THREE_, renderer, scene, camera, model) : null;
      const draw = () => (relief ? relief.render() : renderer.render(scene, camera));

      /* ---- sizing: the canvas sits inside a CSS-scaled canvas, so size from the real rect ---- */
      const resize = () => {
        const r = renderer.domElement.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        renderer.setPixelRatio(dpr);
        renderer.setSize(r.width, r.height, false);
        camera.aspect = r.width / r.height;
        camera.updateProjectionMatrix();
        gmUniforms.uGmPixelRatio.value = dpr;
        relief?.resize(r.width, r.height, dpr);
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(renderer.domElement);

      /* ---- cursor → targets, eased ---- */
      const target = { x: 0, y: 0 };
      const cur = { x: 0, y: 0 };
      const onMove = (e: PointerEvent) => {
        // follows a mouse only: on touch, a finger scrolling past shouldn't steer it
        if (e.pointerType !== 'mouse') return;
        const r = host.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height * 0.3; // roughly head height
        target.x = Math.max(-1, Math.min(1, (e.clientX - cx) / (window.innerWidth / 2)));
        target.y = Math.max(-1, Math.min(1, (e.clientY - cy) / (window.innerHeight / 2)));
      };
      window.addEventListener('pointermove', onMove, { passive: true });

      // touch: no cursor to follow — the robot turns and tilts a little as the page scrolls it
      // from the bottom of the screen (looking up) to the top (looking down)
      const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
      const onScroll = () => {
        const r = host.getBoundingClientRect();
        const p = Math.max(-1, Math.min(1, (r.top + r.height / 2 - window.innerHeight / 2) / (window.innerHeight / 2)));
        target.x = p * SCROLL_TURN;
        target.y = -p * SCROLL_TILT;
      };
      if (!fine) {
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
      }

      let last = performance.now();
      const tick = (now: number) => {
        raf = 0;
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        // with no role open the robot follows the cursor; otherwise it eases back to centre
        const tx = activeRef.current ? target.x : 0;
        const ty = activeRef.current ? target.y : 0;
        const a = 1 - Math.exp(-FOLLOW * dt);
        cur.x += (tx - cur.x) * a;
        cur.y += (ty - cur.y) * a;
        pose(cur.x, cur.y);
        draw();
        if (inView) raf = requestAnimationFrame(tick);
      };
      const start = () => {
        if (!raf) {
          last = performance.now();
          raf = requestAnimationFrame(tick);
        }
      };
      const io = new IntersectionObserver(([e]) => {
        inView = e.isIntersecting;
        if (inView) start();
      });
      io.observe(host);
      draw();
      host.dataset.ready = 'true';

      cleanup = () => {
        io.disconnect();
        ro.disconnect();
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('scroll', onScroll);
        cancelAnimationFrame(raf);
        mixer.stopAllAction();
        relief?.dispose();
        model.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) {
            m.geometry.dispose();
            (m.material as THREE.Material).dispose();
          }
        });
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return <div ref={hostRef} className={styles.robot} aria-hidden />;
}
