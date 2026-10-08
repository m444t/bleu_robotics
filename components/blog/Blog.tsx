'use client';

import { useState, type CSSProperties } from 'react';
import styles from './Blog.module.css';

/** each post's graphic colour, shown on its band while the row is lit */
type Tone = 'blue' | 'navy' | 'orange' | 'yellow';

type Post = {
  title: string;
  excerpt: string;
  team: string;
  updated: string;
  read: string;
  href: string;
  tone: Tone;
};

const POSTS: Post[] = [
  {
    title: 'Introducing Bleu_0.1.',
    excerpt: 'Our first few-shot imitation policy: any task, any robot, deployed in few demonstrations',
    team: 'Research team',
    updated: '2026/03/17',
    read: '5 min read',
    href: '#blog',
    tone: 'blue',
  },
  {
    title: 'The scientific heritage of Bleu Robotics',
    excerpt:
      'Backed by two decades of academic research conducted before “AI” was called AI: we helped shape the very path of what is now called artificial intelligence. Here are our contributions.',
    team: 'Research team',
    updated: '2026/02/24',
    read: '5 min read',
    href: '#blog',
    tone: 'navy',
  },
];

/** band, line, date-chip border and chip text colours per tone (Figma 450:12008) */
const TONES: Record<Tone, CSSProperties> = {
  blue: { '--band': '#00088e', '--lines': '#efefef', '--chip-border': '#efefef', '--chip-ink': '#fff' } as CSSProperties,
  navy: { '--band': '#001027', '--lines': '#efefef', '--chip-border': '#fff', '--chip-ink': '#efefef' } as CSSProperties,
  orange: { '--band': '#fe5c3c', '--lines': '#001027', '--chip-border': '#001027', '--chip-ink': '#001027' } as CSSProperties,
  yellow: { '--band': '#ffbc2b', '--lines': '#001027', '--chip-border': '#001027', '--chip-ink': '#001027' } as CSSProperties,
};

const ReadArrow = () => (
  <svg className={styles.readArrow} viewBox="0 0 6.336 5.952" aria-hidden>
    <path
      d="M3.312 5.952V4.248L5.4 3.084V2.868L3.312 1.704V0H3.384L6.336 1.824V4.128L3.384 5.952H3.312ZM0 5.952V4.248L2.088 3.084V2.868L0 1.704V0H0.0719999L3.024 1.824V4.128L0.0719999 5.952H0Z"
      fill="currentColor"
    />
  </svg>
);

/**
 * Blog teaser. Rows rest grey; one row is always lit — white, its band in the
 * post's own colour — the first by default, otherwise whichever row is hovered
 * or focused. On mobile (Figma 501:3156) every row shows its colours.
 */
export default function Blog() {
  const [active, setActive] = useState<number | null>(null);
  const lit = active ?? 0;

  return (
    <section className={styles.blog} id="blog" aria-labelledby="blog-title">
      <h2 id="blog-title" className={styles.heading}>
        Technical notes from the people building it, with the conditions behind every number.
      </h2>

      {/* hover lights a row only with a mouse; touch taps go straight to the link */}
      <ul className={styles.list} onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}>
        {POSTS.map((p, i) => (
          <li key={i}>
            <a
              className={styles.row}
              href={p.href}
              style={TONES[p.tone]}
              data-lit={i === lit ? 'true' : undefined}
              onPointerEnter={(e) => e.pointerType === 'mouse' && setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            >
              <span className={styles.band} aria-hidden>
                <span className={styles.bandLines} />
                <span className={styles.chip}>Last update: {p.updated}</span>
              </span>
              <span className={styles.body}>
                <span className={styles.title}>{p.title}</span>
                <span className={styles.text}>
                  <span className={styles.tags}>
                    <span className={styles.team}>[ {p.team} ]</span>
                    {/* mobile only: on desktop the date is the chip on the band */}
                    <span className={styles.date}>Last update: {p.updated}</span>
                  </span>
                  <span className={styles.excerpt}>{p.excerpt}</span>
                </span>
              </span>
              <span className={styles.meta}>
                <span className={styles.read}>
                  {p.read} <ReadArrow />
                </span>
                <span className={styles.colorBar} aria-hidden>
                  <i />
                  <i />
                  <i />
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
