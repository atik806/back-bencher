import type { Vec } from "./types";

export const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
export const angleTo = (from: Vec, to: Vec) => Math.atan2(to.y - from.y, to.x - from.x);

/** Wrap an angle into (-PI, PI]. */
export function wrapAngle(a: number): number {
  let r = a % (Math.PI * 2);
  if (r <= -Math.PI) r += Math.PI * 2;
  if (r > Math.PI) r -= Math.PI * 2;
  return r;
}

/** Rotate `current` toward `target` by at most `maxStep` radians. */
export function turnToward(current: number, target: number, maxStep: number): number {
  const diff = wrapAngle(target - current);
  if (Math.abs(diff) <= maxStep) return wrapAngle(target);
  return wrapAngle(current + Math.sign(diff) * maxStep);
}

export interface ConeHit {
  inside: boolean;
  /** 1 at the centre line, 0.5 at the edge. */
  centre: number;
  /** 1 up close, 0.55 at max range. */
  near: number;
}

export function coneTest(origin: Vec, facing: number, fov: number, range: number, p: Vec): ConeHit {
  const d = dist(origin, p);
  if (d > range) return { inside: false, centre: 0, near: 0 };
  const off = Math.abs(wrapAngle(angleTo(origin, p) - facing));
  const half = fov / 2;
  if (off > half) return { inside: false, centre: 0, near: 0 };
  return { inside: true, centre: 1 - 0.5 * (off / half), near: 1 - 0.45 * (d / range) };
}

export const clamp = (v: number, min = 0, max = 100) => Math.min(max, Math.max(min, v));
