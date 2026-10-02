"use client";

import { useEffect, useRef, useState } from "react";
import { PovCanvas } from "@/render/PovCanvas";
import { createGame, dispatch, step, FIXED_DT } from "@/engine/game";
import type { GameState } from "@/engine/types";
import { getLevel } from "@/data/levels";
import { QUESTIONS } from "@/data/questions";
import { useGame } from "@/store/game-store";
import { HowToPlay } from "./HowToPlay";

export function TitleScreen() {
  const go = useGame((s) => s.go);
  const [howTo, setHowTo] = useState(false);
  const demo = useRef<GameState | null>(null);

  // A live attract-mode hall behind the title.
  useEffect(() => {
    const s = createGame({ ...getLevel(3), startSilent: true, startDnd: true, snitches: [], duration: 1e9 }, { seed: 2026, pool: QUESTIONS });
    dispatch(s, { type: "start" });
    for (let i = 0; i < 60 * 8; i++) step(s, FIXED_DT);
    demo.current = s;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      for (let t = 0; t < dt; t += FIXED_DT) step(s, FIXED_DT);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !howTo) go("levels");
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [go, howTo]);

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden">
      <PovCanvas source={() => demo.current} yaw={() => Math.sin((demo.current?.time ?? 0) * 0.22) * 0.7} demo className="absolute inset-0 h-full w-full opacity-50 blur-[1px]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(13,17,23,0.35),rgba(13,17,23,0.95))]" />

      <div className="relative z-10 mx-4 flex max-w-xl flex-col items-center text-center">
        <div className="mb-3 rounded-full border border-amber/40 bg-amber/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber">
          Exam Cheating Simulator
        </div>
        <h1 className="text-6xl font-black leading-none tracking-tight sm:text-8xl">
          BACK
          <br />
          <span className="text-amber">BENCHER</span>
        </h1>
        <p className="mt-5 font-script text-3xl text-white/85">Phone under the desk. Eyes on the teacher.</p>
        <p className="mt-3 max-w-md text-sm text-white/60">
          Snap the question, ask the AI, bubble the answer, and don&apos;t get expelled. Five exams, each with tighter security than the last.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => go("levels")}
            className="rounded-xl bg-amber px-8 py-3.5 text-lg font-bold text-ink shadow-[0_6px_0_#b07d00] transition active:translate-y-1 active:shadow-[0_2px_0_#b07d00]"
          >
            ▶ Play
          </button>
          <button onClick={() => setHowTo(true)} className="rounded-xl border border-white/20 bg-white/5 px-6 py-3.5 text-lg font-semibold hover:bg-white/10">
            How to play
          </button>
        </div>
        <p className="mt-10 text-[11px] text-white/35">A comedy game. Please don&apos;t try this in a real exam.</p>
      </div>
      {howTo && <HowToPlay onClose={() => setHowTo(false)} />}
    </main>
  );
}
