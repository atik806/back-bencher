import type { Perks, Result } from "@/engine/types";

export interface LevelRecord {
  stars: number;
  grade: string;
  percent: number;
}

export interface Progress {
  levels: Record<number, LevelRecord>;
}

const KEY = "back-bencher:progress:v1";

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Progress;
      if (p && typeof p.levels === "object") return p;
    }
  } catch {
    // private mode / blocked storage: play without saving
  }
  return { levels: {} };
}

export function saveProgress(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // ignore
  }
}

export function recordResult(p: Progress, levelId: number, r: Result): Progress {
  const prev = p.levels[levelId];
  const better = !prev || r.stars > prev.stars || (r.stars === prev.stars && r.percent > prev.percent);
  if (!better) return p;
  return { levels: { ...p.levels, [levelId]: { stars: r.stars, grade: r.grade, percent: r.percent } } };
}

export const isUnlocked = (p: Progress, id: number) => id === 1 || (p.levels[id - 1]?.stars ?? 0) >= 1;

export function perksFrom(p: Progress): Perks {
  return {
    faceUnlock: (p.levels[2]?.stars ?? 0) >= 1,
    brainPro: (p.levels[4]?.stars ?? 0) >= 1,
  };
}

export const PERK_INFO = [
  { key: "faceUnlock" as const, name: "Face Unlock", how: "Pass the Midterm", what: "Your phone unlocks the moment it comes out, so there's no swiping." },
  { key: "brainPro" as const, name: "BrainGPT Pro", how: "Pass the University Final", what: "Fixes most of BrainGPT's wrong answers." },
];
