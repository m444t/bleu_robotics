'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react';
import styles from './Team.module.css';

const DESIGN_W = 1440;
const WIDE_MIN = 1920;
const MOBILE_MAX = 767;

/** a person in the photo: head centre and hover strip, in canvas px (1440 × 811) */
type Face = { cx: number; cy: number; from: number; to: number };

type Member = { name: string; face?: Face };

// the photo's people, left to right (canvas px): head centres read off the team photo;
// each hover strip runs from one head's midpoint with its neighbours to the next
const FACES: Face[] = [
  { cx: 214, cy: 212, from: 105, to: 329 },
  { cx: 444, cy: 202, from: 329, to: 524 },
  { cx: 604, cy: 218, from: 524, to: 650 },
  { cx: 695, cy: 187, from: 650, to: 730 },
  { cx: 766, cy: 221, from: 730, to: 851 },
  { cx: 937, cy: 232, from: 851, to: 1071 },
  { cx: 1205, cy: 210, from: 1071, to: 1315 },
];

// list order; `face` is who they are in the photo, numbered left to right from 1
// (the last four aren't in it)
const MEMBERS: Member[] = [
  { name: 'Benoit Berkoukchi', face: FACES[3] },
  { name: 'Jean-Baptiste Mouret', face: FACES[0] },
  { name: 'Serena Ivaldi', face: FACES[2] },
  { name: 'Hippolyte Henry', face: FACES[1] },
  { name: 'Romain Klokov', face: FACES[4] },
  { name: 'Waldez Gomez', face: FACES[5] },
  { name: 'Côme Perrot', face: FACES[6] },
  { name: 'Ahmed Mohamed' },
  { name: 'Sébastien Dignoire' },
  { name: 'Alexandros Paraschos' },
  { name: 'José Mendez Filho' },
];

// the window around a focused head (the first framing from Figma: 161 × 193, a touch above the head centre)
const WIN_HALF_W = 80.5;
const WIN_HALF_H = 96.5;
const WIN_RISE = 12;
// bottom of the hover strips: the people's feet
const STRIP_BOTTOM = 755;

const windowVars = (f: Face) =>
  ({
    '--wl': `${f.cx - WIN_HALF_W}px`,
    '--wr': `${f.cx + WIN_HALF_W}px`,
    '--wt': `${f.cy - WIN_RISE - WIN_HALF_H}px`,
    '--wb': `${f.cy - WIN_RISE + WIN_HALF_H}px`,
  }) as CSSProperties;

/**
 * Team photo with the hero's grid/reveal system. At rest the clean window is
 * almost the whole frame; focusing a person (their name, or their spot in the
 * photo) moves the four grid lines in to frame their head, and the full-colour
 * image shrinks to that window while the rest turns blue/orange.
 */
export default function Team() {
  const rootRef = useRef<HTMLElement>(null);
  // index into MEMBERS of the person framed
  const [focus, setFocusState] = useState<number | null>(null);
  // the last person focused: keeps the zoom origin in place while zooming back out
  const [zoomed, setZoomed] = useState<number | null>(null);
  const setFocus = (id: number | null) => {
    setFocusState(id);
    if (id !== null) setZoomed(id);
  };

  useLayoutEffect(() => {
    const root = rootRef.current!;
    const fit = () => {
      const w = root.clientWidth;
      const k = Math.min(w, WIDE_MIN) / DESIGN_W;
      root.dataset.layout = w <= MOBILE_MAX ? 'mobile' : 'desktop';
      root.style.setProperty('--k', `${k}`);
      // past 1920 the frame stops growing: the margin beside it, in design px, for the lines to reach the page edges
      root.style.setProperty('--gutter', `${(w - DESIGN_W * k) / 2 / k}px`);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  // the press that leads to a click: a tap also fires focus first, so the click must
  // toggle from the state before the tap; with a mouse, hover already does the work
  const press = useRef({ on: false, mouse: false });
  const bind = (id: number) => ({
    // hover only for a real mouse; touch goes through the click
    onPointerEnter: (e: PointerEvent) => e.pointerType === 'mouse' && setFocus(id),
    onPointerLeave: (e: PointerEvent) => e.pointerType === 'mouse' && setFocus(null),
    onPointerDown: (e: PointerEvent) => (press.current = { on: focus === id, mouse: e.pointerType === 'mouse' }),
    // touch toggles; keyboard clicks (detail 0) have no press, so they toggle from the current state
    onClick: (e: MouseEvent) => {
      if (e.detail === 0) setFocus(focus === id ? null : id);
      else if (!press.current.mouse) setFocus(press.current.on ? null : id);
    },
    onFocus: () => setFocus(id),
    onBlur: () => setFocus(null),
  });

  const focusFace = focus === null ? undefined : MEMBERS[focus].face;
  const zoomFace = zoomed === null ? undefined : MEMBERS[zoomed].face;

  const list = (
    <ul className={styles.list} aria-label="Team list">
      <li className={styles.listHead}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/folder-open.svg" alt="" width={14} height={14} />
        Team list
      </li>
      {MEMBERS.map((m, i) => (
        <li key={m.name}>
          {m.face ? (
            <button type="button" className={styles.tag} data-active={focus === i ? 'true' : undefined} {...bind(i)}>
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
    <section
      ref={rootRef}
      className={styles.team}
      data-focus={focus ?? undefined}
      aria-label="The team"
      style={
        {
          ...(focusFace && windowVars(focusFace)),
          // mobile zoom pivots on the last person zoomed, so zooming back out retraces the zoom in
          ...(zoomFace && { '--zoom-origin': `${zoomFace.cx - 4}px ${zoomFace.cy + 8}px` }),
        } as CSSProperties
      }
    >
      <div className={styles.frame}>
        <div className={styles.canvas}>
          {/* mobile: tapping a person zooms the photo (and its grid) in on them, frame unchanged */}
          <div className={styles.zoom}>
            {/* LAYER 1 + 2: treated photo, clean photo revealed through the window */}
            <div className={styles.media} aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.treatedPhoto} src="/media/team-treated.webp" alt="" />
              <div className={styles.clean}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={styles.photo} src="/media/team-clean.webp" alt="" />
              </div>
            </div>
            <span className="sr-only">The Bleu Robotics team in the lab with their robots.</span>

            {/* hover targets: a strip over each person in the photo */}
            {MEMBERS.map(
              (m, i) =>
                m.face && (
                  <span
                    key={m.name}
                    className={styles.hotspot}
                    aria-hidden
                    style={{
                      left: m.face.from,
                      top: m.face.cy - 60,
                      width: m.face.to - m.face.from,
                      height: STRIP_BOTTOM - (m.face.cy - 60),
                    }}
                    {...bind(i)}
                  />
                ),
            )}

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
          </div>

          <div className={styles.listDesktop}>{list}</div>
        </div>
      </div>
      <div className={styles.listMobile}>{list}</div>
    </section>
  );
}
