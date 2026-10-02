"use client";

import { useEffect, useRef } from "react";
import type { GameState } from "@/engine/types";
import { drawPov, setBoardLogo, setPovHandFont, type Quad } from "./pov";
import { drawHall, setHandFont } from "./draw";
import type { CamPose } from "./intro";

interface Props {
  source: () => GameState | null;
  /** Current head turn in radians, read every frame. */
  yaw?: () => number;
  /** 0 = looking at the room, 1 = looking down at the paper. */
  look?: () => number;
  /** 0 = seated upright, 1 = ducked below the desktop. */
  duck?: () => number;
  /** Scripted camera for the walk-in intro (null = normal seated camera). */
  pose?: () => CamPose | null;
  /** Where your paper is on screen this frame (CSS px), for the DOM overlay. */
  onPaper?: (quad: Quad | null, w: number, h: number) => void;
  demo?: boolean;
  /** "pov" = first person; "radar" = the top-down minimap. */
  mode?: "pov" | "radar";
  className?: string;
  label?: string;
}

export function PovCanvas({ source, yaw, look, duck, pose, onPaper, demo, mode = "pov", className, label }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef({ source, yaw, look, duck, pose, onPaper });
  useEffect(() => {
    live.current = { source, yaw, look, duck, pose, onPaper };
  });

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const family = getComputedStyle(document.body).getPropertyValue("--font-hand");
    setPovHandFont(family);
    const logo = new Image();
    logo.src = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/aiub-logo.png`;
    setBoardLogo(logo);
    setHandFont(family);

    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const s = live.current.source();
      if (!s) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const y = live.current.yaw?.() ?? 0;
      if (mode === "radar") drawHall(ctx, s, w, h, { demo, viewYaw: y, duck: live.current.duck?.() ?? 0 });
      else {
        const quad = drawPov(ctx, s, w, h, { yaw: y, look: live.current.look?.() ?? 0, duck: live.current.duck?.() ?? 0, pose: live.current.pose?.() ?? null, demo });
        live.current.onPaper?.(quad, w, h);
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [demo, mode]);

  return <canvas ref={ref} className={className} role="img" aria-label={label ?? (mode === "radar" ? "Radar: the exam hall from above" : "Your view from your seat")} />;
}
