"use client";

import { useEffect, useRef, useState } from "react";
import type { IntroPlan } from "@/render/intro";
import { introStepIndex } from "@/render/intro";
import type { Snapshot } from "@/store/game-store";
import { sfx } from "@/audio/sfx";

interface Props {
  snap: Snapshot;
  plan: IntroPlan;
  /** performance.now() when the walk began */
  startedAt: number;
  onDone: () => void;
}

/** Cinematic walk-in: black bars, subtitles, footsteps, a fade from black, and a skip button. */
export function IntroOverlay({ snap, plan, startedAt, onDone }: Props) {
  const [t, setT] = useState(0);
  const done = useRef(false);
  const lastStep = useRef(0);
  const finish = useRef(onDone);
  useEffect(() => {
    finish.current = onDone;
  });

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = (performance.now() - startedAt) / 1000;
      setT(now);
      // Contact matches the camera's gait. A stalled frame never causes a burst of steps.
      const stepIndex = introStepIndex(plan, now);
      if (now < plan.walkTime && stepIndex > lastStep.current) {
        lastStep.current = stepIndex;
        sfx.step(stepIndex);
      }
      if (now >= plan.duration + 0.7 && !done.current) {
        done.current = true;
        sfx.bell();
        finish.current();
      }
    };
    raf = requestAnimationFrame(loop);
    const key = (e: KeyboardEvent) => {
      if ((e.key === "Enter" || e.key === "Escape" || e.code === "Space") && !done.current) {
        e.preventDefault();
        done.current = true;
        finish.current();
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", key);
    };
  }, [plan, startedAt]);

  const teacher = snap.level.teachers[0]?.name ?? "The invigilator";
  const lines: { from: number; to: number; text: React.ReactNode }[] = [
    { from: 0.3, to: 2.6, text: <span className="text-white/80">Exam day · {snap.level.subtitle}</span> },
    { from: 2.6, to: plan.walkTime * 0.6, text: "Find your seat. Keep your head down." },
    {
      from: plan.walkTime * 0.6,
      to: plan.walkTime + 0.3,
      text: (
        <>
          <b className="text-amber">{teacher}:</b> “Phones off, bags at the front. Eyes on your own paper.”
        </>
      ),
    },
    { from: plan.walkTime + 0.3, to: plan.duration + 1, text: <b>You sit down. The exam begins.</b> },
  ];
  const line = lines.find((l) => t >= l.from && t < l.to);
  const bars = Math.min(1, t / 0.6) * (t > plan.duration + 0.2 ? Math.max(0, 1 - (t - plan.duration - 0.2) / 0.5) : 1);
  const fade = Math.max(0, 1 - t / 0.9);

  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      <div className="absolute inset-0 bg-black" style={{ opacity: fade }} />
      <div className="absolute inset-x-0 top-0 bg-black" style={{ height: `${bars * 11}%` }} />
      <div className="absolute inset-x-0 bottom-0 bg-black" style={{ height: `${bars * 13}%` }} />

      <div className="absolute inset-x-0 top-[3%] text-center" style={{ opacity: Math.min(1, t / 0.8) * (t < 3 ? 1 : Math.max(0, 1 - (t - 3) / 0.6)) }}>
        <div className="text-xs font-bold uppercase tracking-[0.35em] text-amber">Exam {snap.level.id}</div>
        <div className="text-3xl font-black tracking-tight text-white sm:text-4xl">{snap.level.name}</div>
      </div>

      {line && (
        <div className="absolute inset-x-0 bottom-[4%] flex justify-center px-6">
          <div key={line.from} className="toast-in max-w-2xl text-center text-base font-medium text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] sm:text-lg">
            {line.text}
          </div>
        </div>
      )}

      <button
        onClick={() => {
          if (done.current) return;
          done.current = true;
          finish.current();
        }}
        className="pointer-events-auto absolute bottom-[3%] right-4 rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur hover:bg-white/25"
      >
        Skip ▸ <span className="text-white/50">Enter</span>
      </button>
    </div>
  );
}
