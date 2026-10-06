/** The one easing curve used by every animation on the site. */
export const EASE = [0.5, 0, 0.5, 1] as const;
export const EASE_CSS = `cubic-bezier(${EASE.join(', ')})`;

/** JS version of the same curve, for the rAF-driven hero intro. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const bez = (t: number, a: number, b: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  const slope = (t: number, a: number, b: number) => 3 * a * (1 - t) ** 2 + 6 * (b - a) * t * (1 - t) + 3 * (1 - b) * t * t;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    // Newton–Raphson on x(t), bisection fallback
    let t = x;
    for (let i = 0; i < 8; i++) {
      const dx = bez(t, x1, x2) - x;
      const d = slope(t, x1, x2);
      if (Math.abs(dx) < 1e-6) return bez(t, y1, y2);
      if (Math.abs(d) < 1e-6) break;
      t -= dx / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 30; i++) {
      const v = bez(t, x1, x2);
      if (Math.abs(v - x) < 1e-6) break;
      if (v < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return bez(t, y1, y2);
  };
}

export const ease = cubicBezier(...EASE);
