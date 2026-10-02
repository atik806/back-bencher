"use client";

import { LEVELS } from "@/data/levels";
import { useGame } from "@/store/game-store";
import { isUnlocked, perksFrom, PERK_INFO } from "@/lib/progress";

export function Stars({ n, size = "text-lg" }: { n: number; size?: string }) {
  return (
    <span className={size} aria-label={`${n} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={i < n ? "text-amber" : "text-white/15"}>
          ★
        </span>
      ))}
    </span>
  );
}

export function LevelSelect() {
  const progress = useGame((s) => s.progress);
  const startLevel = useGame((s) => s.startLevel);
  const go = useGame((s) => s.go);
  const perks = perksFrom(progress);
  const totalStars = Object.values(progress.levels).reduce((a, l) => a + l.stars, 0);

  return (
    <main className="mx-auto min-h-dvh max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <button onClick={() => go("title")} className="rounded-lg px-3 py-2 text-white/70 hover:bg-white/10">
          ← Back
        </button>
        <div className="text-sm text-white/60">
          <span className="text-amber">★</span> {totalStars} / {LEVELS.length * 3}
        </div>
      </div>
      <h1 className="mt-4 text-4xl font-black">Choose your exam</h1>
      <p className="mt-1 text-white/60">Pass an exam (50% or more, without getting caught) to unlock the next one.</p>

      <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {LEVELS.map((l) => {
          const open = isUnlocked(progress, l.id);
          const rec = progress.levels[l.id];
          return (
            <li key={l.id}>
              <button
                disabled={!open}
                onClick={() => startLevel(l.id)}
                className="group flex h-full w-full flex-col rounded-2xl border border-line bg-panel p-5 text-left transition enabled:hover:-translate-y-0.5 enabled:hover:border-amber/60 disabled:opacity-45"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest text-white/40">Exam {l.id}</span>
                  {open ? <Stars n={rec?.stars ?? 0} /> : <span aria-label="Locked">🔒</span>}
                </div>
                <div className="mt-2 text-2xl font-bold">{l.name}</div>
                <div className="text-sm text-white/55">{l.subtitle}</div>
                <div className="mt-3 text-sm text-white/75">{l.newThing}</div>
                <div className="mt-auto flex flex-wrap items-center gap-3 pt-4 text-xs text-white/50">
                  <span>⏱ {Math.round(l.duration / 60)} min</span>
                  <span>📝 {l.questionCount} Qs</span>
                  <span>🔋 {l.battery}%</span>
                  {rec && <span className="ml-auto rounded bg-white/10 px-2 py-0.5 font-bold text-white">Best: {rec.grade}</span>}
                </div>
              </button>
            </li>
          );
        })}
      </ol>

      <h2 className="mt-10 text-lg font-bold">Phone upgrades</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {PERK_INFO.map((p) => (
          <li key={p.key} className={`rounded-xl border p-4 ${perks[p.key] ? "border-ok/50 bg-ok/5" : "border-line"}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{p.name}</span>
              <span className="text-xs">{perks[p.key] ? "✅ Unlocked" : `🔒 ${p.how}`}</span>
            </div>
            <div className="mt-1 text-sm text-white/60">{p.what}</div>
          </li>
        ))}
      </ul>
    </main>
  );
}
