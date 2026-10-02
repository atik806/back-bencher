/**
 * Maps a flat w×h element onto any screen quad (perspective "homography"), so a real DOM
 * question paper can lie on the 3D desk and stay clickable. Also maps screen points back
 * onto the paper, which is how the phone camera knows which question it's over.
 */

export type Pt = [number, number];

/** 3×3 row-major: [a b c; d e f; g h 1] mapping element px (x,y) → screen px. */
export type Homography = [number, number, number, number, number, number, number, number, number];

/** Corners in order: top-left, top-right, bottom-right, bottom-left (of the element). */
export function rectToQuad(w: number, h: number, q: Pt[]): Homography | null {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const dy3 = y0 - y1 + y2 - y3;
  let g = 0;
  let hh = 0;
  if (Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9) {
    const den = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(den) < 1e-12) return null;
    g = (dx3 * dy2 - dx2 * dy3) / den;
    hh = (dx1 * dy3 - dx3 * dy1) / den;
  }
  // unit square → quad
  const a = x1 - x0 + g * x1;
  const b = x3 - x0 + hh * x3;
  const d = y1 - y0 + g * y1;
  const e = y3 - y0 + hh * y3;
  // pre-scale so the input is element pixels instead of 0..1
  return [a / w, b / h, x0, d / w, e / h, y0, g / w, hh / h, 1];
}

/** CSS `matrix3d` for an element with `transform-origin: 0 0`. */
export function toCss(H: Homography): string {
  const [a, b, c, d, e, f, g, h, i] = H;
  return `matrix3d(${a},${d},0,${g},${b},${e},0,${h},0,0,1,0,${c},${f},0,${i})`;
}

export function apply(H: Homography, x: number, y: number): Pt {
  const [a, b, c, d, e, f, g, h, i] = H;
  const w = g * x + h * y + i;
  return [(a * x + b * y + c) / w, (d * x + e * y + f) / w];
}

export function invert(H: Homography): Homography | null {
  const [a, b, c, d, e, f, g, h, i] = H;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) return null;
  const k = 1 / det;
  return [A * k, -(b * i - c * h) * k, (b * f - c * e) * k, B * k, (a * i - c * g) * k, -(a * f - c * d) * k, C * k, -(a * h - b * g) * k, (a * e - b * d) * k];
}
