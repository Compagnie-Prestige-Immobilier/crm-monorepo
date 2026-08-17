export const DUR_1_MS = 150;
export const DUR_2_MS = 220;
export const DUR_3_MS = 300;

export function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): (time: number) => number {
  const ax = 3 * x1 - 3 * x2 + 1;
  const bx = 3 * x2 - 6 * x1;
  const cx = 3 * x1;

  const ay = 3 * y1 - 3 * y2 + 1;
  const by = 3 * y2 - 6 * y1;
  const cy = 3 * y1;

  const sampleX = (t: number): number => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number): number => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number): number => (3 * ax * t + 2 * bx) * t + cx;

  return (time: number): number => {
    if (time <= 0) return 0;
    if (time >= 1) return 1;

    let t = time;
    for (let index = 0; index < 8; index += 1) {
      const error = sampleX(t) - time;
      if (Math.abs(error) < 1e-6) break;
      const slope = slopeX(t);
      if (Math.abs(slope) < 1e-6) break;
      t -= error / slope;
    }

    return sampleY(t);
  };
}

export const easeOut = cubicBezier(0.22, 1, 0.36, 1);

export const easeSpring = cubicBezier(0.34, 1.56, 0.64, 1);

export function interpolateCount(from: number, to: number, progress: number): number {
  if (progress <= 0) return from;
  if (progress >= 1) return to;
  return Math.round(from + (to - from) * easeOut(progress));
}
