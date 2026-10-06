'use client';

import { useState } from 'react';
import styles from './Blog.module.css';

type Post = {
  title: string;
  excerpt: string;
  team: string;
  updated: string;
  read: string;
  href: string;
};

// Figma shows one article repeated four times; swap in real posts here.
const POST: Post = {
  title: 'The scientific heritage of Bleu Robotics',
  excerpt:
    'Backed by two decades of academic research conducted before “AI” was called “AI”, we helped shape the path of what is now called artificial intelligence. Here are our contributions.',
  team: 'Research team',
  updated: '2026/03/17',
  read: '5 min read',
  href: '#blog',
};
const POSTS: Post[] = [POST, POST, POST, POST];

/**
 * Blog teaser. One row is always "lit" (white row, blue pattern band): the
 * first by default, otherwise whichever row is hovered or focused.
 */
export default function Blog() {
  const [active, setActive] = useState<number | null>(null);
  const lit = active ?? 0;

  return (
    <section className={styles.blog} id="blog" aria-labelledby="blog-title">
      <h2 id="blog-title" className={styles.heading}>
        Technical notes from the people building it, with the conditions behind every number.
      </h2>

      <ul className={styles.list} onMouseLeave={() => setActive(null)}>
        {POSTS.map((p, i) => (
          <li key={i}>
            <a
              className={styles.row}
              href={p.href}
              data-lit={i === lit ? 'true' : undefined}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            >
              <span className={styles.band} aria-hidden>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={styles.bandLines} src="/blog/band-lines.png" alt="" width={117} height={91} />
              </span>
              <span className={styles.text}>
                <span className={styles.title}>{p.title}</span>
                <span className={styles.excerpt}>{p.excerpt}</span>
              </span>
              <span className={styles.read}>
                {p.read}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/blog/read.svg" alt="" width={6.336} height={5.952} />
              </span>
              <span className={styles.meta}>
                <span className={styles.chip}>[{p.team}]</span>
                <span className={`${styles.chip} ${styles.chipBlue}`}>Last update: {p.updated}</span>
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
