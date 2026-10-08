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
    title: 'When dedicated automation fails',
    body: 'More than 75% of industrial tasks are still performed manually, because an operator adapts to a new part or a new sequence and a fixed robot does not. High-mix, low-volume production needs hardware that can be reassigned whenever the product or process changes. The new generation of humanoid robots provide that hardware, but still requires an engineering project for each new application.',
    color: '#00088e',
    ink: '#ffffff',
    figure: figures.teach,
  },
  {
    id: 'train',
    number: '02',
    label: 'The bottleneck',
    title: 'The factory data gap for end to end approaches',
    body: 'Every cell has its own parts, fixtures and sequences, and almost none of them appear in the data used to train generalist robot models. Out of the box, these models rarely reach production standards, and fine-tuning them takes hundreds of demonstrations per task. On a high-mix line, that cost returns at every changeover, unless the robot can learn each new task from a few demonstrations.',
    color: '#fe5c3c',
    ink: '#000000',
    figure: figures.train,
  },
  {
    id: 'operate',
    number: '03',
    label: 'Our answer',
    title: 'The frontier of data efficiency',
    body: 'Our few-shots vision-based imitation models learn long-horizon industrial tasks from as few as five demonstrations. The resulting visuomotor policy executes the sequence and is designed to reach the failure rate and cycle time the line requires. The full process, from the first demonstration to deployment, takes less than an hour from on-site demonstration.',
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
