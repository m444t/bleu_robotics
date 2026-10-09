import manifest from './media-manifest.json';

/**
 * Where a slide's composition sits relative to the hero geometry.
 * The composition is scaled to cover the stage, multiplied by `zoom`, and the
 * normalised focal point (fx, fy) is placed on the anchor (window centre for the
 * resting layout, hero centre for the intro start). Result is clamped so the
 * stage is always covered.
 */
export type MediaFit = { zoom: number; fx: number; fy: number };

export type Slide = {
  id: string;
  caption: string;
  alt: string;
  /** photo slides: the baked clean + treated images (scripts/bake-media.mjs) */
  clean?: string;
  treated?: string;
  /** video slides: the clean layer plays it, the treated layer maps it live (videoGradientMap.ts) */
  video?: string;
  width: number;
  height: number;
  fit: MediaFit;
  /** Only the first slide plays the intro, so only it needs a start framing. */
  introFit?: MediaFit;
  /** kept, but left out of the hero for now */
  hidden?: boolean;
};

const media = Object.fromEntries(manifest.map((m) => [m.id, m]));

const ALL_SLIDES: Slide[] = [
  {
    // the hero's first slide: a 9.4 s loop, 1920 × 1080
    id: 'robot-arm',
    video: '/media/robot-arm.webm',
    width: 1920,
    height: 1080,
    caption: 'Test cell — robot arm',
    alt: 'A robot arm works at a test rack in a bright lab',
    fit: { zoom: 1, fx: 0.5, fy: 0.5 },
    introFit: { zoom: 1.12, fx: 0.5, fy: 0.5 },
  },
  {
    // the previous first slide
    ...media['factory-cell'],
    caption: 'Factory floor — packaging cell',
    alt: 'An operator in a hi-vis vest works at a packaging cell beside a humanoid robot',
    // the robot and the operator in the middle of the window
    fit: { zoom: 1, fx: 0.55, fy: 0.5 },
    introFit: { zoom: 1.12, fx: 0.5, fy: 0.5 },
    hidden: true,
  },
  {
    ...media['robot-demo'],
    caption: 'Factory floor — part handling',
    alt: 'An operator demonstrates a part-handling task to a humanoid robot',
    fit: { zoom: 1.0347, fx: 0.4836, fy: 0.4308 },
    introFit: { zoom: 1.1423, fx: 0.4304, fy: 0.4883 },
    hidden: true,
  },
  {
    ...media['food-packing'],
    caption: 'Food line — tray packing',
    alt: 'A worker packs produce trays on a food processing line',
    fit: { zoom: 1, fx: 0.6, fy: 0.42 },
    hidden: true,
  },
  {
    ...media['robot-detail'],
    caption: 'Teach cell — bimanual grasp',
    alt: 'Close-up of the humanoid robot holding a bottle while the operator guides it',
    fit: { zoom: 1.04, fx: 0.5, fy: 0.46 },
    hidden: true,
  },
];

/** the hero's slides: hidden ones are left out */
export const SLIDES = ALL_SLIDES.filter((s) => !s.hidden);
