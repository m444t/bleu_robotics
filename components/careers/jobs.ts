export type Job = {
  code: string;
  title: string;
  tags: string[];
  intro: string[];
  lists: { heading: string; items: string[] }[];
  /** where the segmented CTA points */
  href: string;
};

// Copy from the Figma "open position" state. The design repeats one role four
// times; titles 2–4 are placeholders until the real openings are known.
const researchBody = {
  intro: [
    'Join our research team to develop learning systems that enable humanoid robots to operate reliably in real-world industrial environments. You’ll work across robot learning, reinforcement learning, perception, and control — turning research ideas into systems that run on physical robots.',
    'We’re looking for engineers who are comfortable moving between experiments, code, and hardware, and who want to solve problems that don’t yet have established solutions.',
  ],
  lists: [
    {
      heading: 'What you’ll work on',
      items: [
        'Train and evaluate learning-based control policies',
        'Build pipelines for collecting and using real-world robot data',
        'Develop and test models for manipulation and locomotion',
        'Run experiments directly on humanoid robotic platforms',
        'Collaborate with robotics, ML, and hardware engineers',
      ],
    },
    {
      heading: 'What we’re looking for',
      items: [
        'Strong Python and machine learning experience',
        'Experience with PyTorch, JAX, or similar frameworks',
        'Background in robotics, reinforcement learning, imitation learning, or control',
        'Comfortable working with real-world robotic systems',
        'Strong experimental and problem-solving skills',
      ],
    },
  ],
};

const apply = (title: string) => `mailto:careers@bleu-robotics.com?subject=${encodeURIComponent(title)}`;

export const JOBS: Job[] = [
  'Research Engineer for Learning Robots',
  'Robotics Software Engineer',
  'Machine Learning Infrastructure Engineer',
  'Field Deployment Engineer',
].map((title, i) => ({
  code: `BR-JOB-${String(i + 1).padStart(3, '0')}`,
  title,
  tags: ['Tech', 'Full time', 'Paris', 'On-site'],
  ...researchBody,
  href: apply(title),
}));

/** Resting panel before a role is picked. */
export const EMPTY = { code: 'BR-JOB-000', tags: ['0000', '0000 0000', '00000', '00-000'] };
