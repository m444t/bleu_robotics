'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import styles from './Team.module.css';

const DESIGN_W = 1440;
const WIDE_MIN = 1920;
const MOBILE_MAX = 767;

type Member = { name: string; id?: 'jean' };

// list order top → bottom, as in Figma
const MEMBERS: Member[] = [
  { name: 'Benoît Berkoukchi' },
  { name: 'Jean-Baptiste Mouret', id: 'jean' },
  { name: 'Serena Ivaldi' },
  { name: 'Hippolyte Henry' },
  { name: 'Roman Klokov' },
];

/**
 * Team photo with the hero's grid/reveal system. At rest the clean window is
 * almost the whole frame; focusing a person moves the four grid lines in to
 * frame them, and the full-colour image shrinks to that window while the rest
 * turns blue/orange. Only Jean-Baptiste has a framing for now.
 */
export default function Team() {
  const rootRef = useRef<HTMLElement>(null);
  const [focus, setFocus] = useState<Member['id'] | null>(null);

  useLayoutEffect(() => {
    const root = rootRef.current!;
    const fit = () => {
      const w = root.clientWidth;
      root.dataset.layout = w <= MOBILE_MAX ? 'mobile' : 'desktop';
      root.style.setProperty('--k', `${Math.min(w, WIDE_MIN) / DESIGN_W}`);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  const bind = (id: Member['id']) =>
    id
      ? {
          onMouseEnter: () => setFocus(id),
          onMouseLeave: () => setFocus(null),
          onFocus: () => setFocus(id),
          onBlur: () => setFocus(null),
        }
      : {};

  const list = (
    <ul className={styles.list} aria-label="Team list">
      <li className={styles.listHead}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/folder-open.svg" alt="" width={14} height={14} />
        Team list
      </li>
      {MEMBERS.map((m) => (
        <li key={m.name}>
          {m.id ? (
            <button
              type="button"
              className={styles.tag}
              data-active={focus === m.id ? 'true' : undefined}
              onClick={() => setFocus((f) => (f === m.id ? null : m.id))}
              {...bind(m.id)}
            >
              {m.name}
            </button>
          ) : (
            <span className={styles.tag}>{m.name}</span>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <section ref={rootRef} className={styles.team} data-focus={focus ?? undefined} aria-label="The team">
      <div className={styles.frame}>
        <div className={styles.canvas}>
          {/* LAYER 1 + 2: treated photo, clean photo revealed through the window */}
          <div className={styles.media} aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.photo} src="/media/team-treated.webp" alt="" />
            <div className={styles.clean}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.photo} src="/media/team-clean.webp" alt="" />
            </div>
          </div>
          <span className="sr-only">The Bleu Robotics team in the lab with their robots.</span>

          {/* hover target over Jean-Baptiste in the photo */}
          <span className={styles.hotspot} aria-hidden {...bind('jean')} />

          {/* LAYER 3: grid — the window's edges */}
          <div className={styles.grid} aria-hidden>
            <div className={`${styles.hLine} ${styles.hTop}`}>
              <span className={styles.capL} />
              <span className={styles.capR} />
            </div>
            <div className={`${styles.hLine} ${styles.hBottom}`}>
              <span className={styles.capL} />
              <span className={styles.capR} />
            </div>
            <div className={`${styles.vLine} ${styles.vLeft}`}>
              <span className={styles.capT} />
              <span className={styles.capB} />
            </div>
            <div className={`${styles.vLine} ${styles.vRight}`}>
              <span className={styles.capT} />
              <span className={styles.capB} />
            </div>
          </div>

          <div className={styles.listDesktop}>{list}</div>
        </div>
      </div>
      <div className={styles.listMobile}>{list}</div>
    </section>
  );
}
