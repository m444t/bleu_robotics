import figures from './figures.json';

export type Step = {
  id: 'teach' | 'train' | 'operate';
  number: string;
  label: string;
  title: string;
  body: string;
  /** step colour: tab, active button, hover */
  color: string;
  /** text/pictogram colour on top of `color` */
  ink: string;
  figure: (typeof figures)['teach'];
};

export const STEPS: Step[] = [
  {
    id: 'teach',
    number: '01',
    label: 'Versatility',
    title: 'Where traditional automation fails',
    body: 'Humanoid robots thrive where fixed automation cannot: versatility. High-mix, low-volume production needs standard hardware that can be redeployed for new tasks at close to zero cost, and AI software that drives the redeployment cost down.',
    color: '#00088e',
    ink: '#ffffff',
    figure: figures.teach,
  },
  {
    id: 'train',
    number: '02',
    label: 'The bottleneck',
    title: 'Generalist models miss the factory',
    body: 'Industrial operations are too specific for out-of-the-box generalist models. Imitation learning is the logical answer, but massive data requirements and heavy compute push the redeployment cost back up.',
    color: '#fe5c3c',
    ink: '#000000',
    figure: figures.train,
  },
  {
    id: 'operate',
    number: '03',
    label: 'Our answer',
    title: 'Few-shot imitation learning',
    body: 'Our first few-shot imitation model generalises to complex industrial tasks and long-horizon objectives, learning a new task from a handful of demonstrations by the operator who already runs the cell.',
    color: '#ffbc2b',
    ink: '#001027',
    figure: figures.operate,
  },
];

/** Resting colours of the non-active buttons, per active step (from the three Figma states). */
export const IDLE_BUTTONS: Record<number, ({ bg: string; ink: string } | null)[]> = {
  0: [null, { bg: '#c1c1c1', ink: '#001027' }, { bg: '#efefef', ink: '#001027' }],
  1: [{ bg: '#c1c1c1', ink: '#001027' }, null, { bg: '#efefef', ink: '#001027' }],
  2: [{ bg: '#808080', ink: '#ffffff' }, { bg: '#c1c1c1', ink: '#001027' }, null],
};
