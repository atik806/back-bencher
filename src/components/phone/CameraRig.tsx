"use client";

import { useEffect, useRef, useState } from "react";
import { useGame, type Snapshot } from "@/store/game-store";
import { apply } from "@/render/homography";
import { paperGeometry } from "@/components/desk/paperGeometry";
import { PAPER_H, PAPER_W, PaperPage, questionAt } from "@/components/desk/PaperPage";
import { Hands } from "./Hands";
import { PhoneFrame, PHONE_H, PHONE_W } from "./Phone";

// Phone screen size inside the 300×620 frame (12px bezel).
const SCR_W = PHONE_W - 24;
const SCR_H = PHONE_H - 24;
/** Optical zoom of the viewfinder relative to the paper. */
const ZOOM = 0.95;

/**
 * Camera mode: you lift the phone above the desk and hold it over the paper. Move the mouse
 * (or drag a finger) to move the phone; the viewfinder shows the part of the paper under it.
 * Hold it over a question until it focuses, then click/tap to take the photo.
 */
export function CameraRig({ snap }: { snap: Snapshot }) {
  const act = useGame((s) => s.act);
  const layer = useRef<HTMLDivElement>(null);
  const rig = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const target = useRef<{ x: number; y: number } | null>(null);
  const pos = useRef<{ x: number; y: number } | null>(null);
  const aim = useRef<{ q: number | null }>({ q: null });
  const [scale, setScale] = useState(0.5);
  const [flash, setFlash] = useState(0);
  const live = useRef(snap);
  useEffect(() => {
    live.current = snap;
  });

  const p = snap.phone;
  const ready = p.focus >= 1;

  useEffect(() => {
    const fit = () => setScale(Math.max(0.32, Math.min(0.56, (window.innerHeight * 0.58) / PHONE_H)));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const el = layer.current;
      if (!el) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      // Start over the middle of the paper.
      if (!target.current) {
        const H = paperGeometry.H;
        const c = H ? apply(H, PAPER_W / 2, PAPER_H * 0.55) : [w / 2, h * 0.6];
        target.current = { x: c[0], y: c[1] };
      }
      pos.current ??= { ...target.current };
      const t = (now - t0) / 1000;
      // Nervous hands: the shake grows with suspicion.
      const amp = 3 + live.current.suspicion * 0.16;
      pos.current.x += (target.current.x - pos.current.x) * 0.16;
      pos.current.y += (target.current.y - pos.current.y) * 0.16;
      const x = pos.current.x + Math.sin(t * 2.3) * amp + Math.sin(t * 5.1 + 1) * amp * 0.4;
      const y = pos.current.y + Math.cos(t * 1.9) * amp * 0.8 + Math.sin(t * 4.4) * amp * 0.3;
      if (rig.current) rig.current.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${Math.sin(t * 1.3) * 1.5 - 3}deg)`;

      // What's under the lens?
      const inv = paperGeometry.inv;
      if (!inv) return;
      const [u, v] = apply(inv, x, y);
      if (page.current) page.current.style.transform = `translate(${SCR_W / 2 - u * ZOOM}px, ${SCR_H / 2 - v * ZOOM}px) scale(${ZOOM})`;
      const q = questionAt(paperGeometry.page, live.current.questions.length, u, v, 12);
      if (q !== aim.current.q) {
        aim.current.q = q;
        act({ type: "aim", onTarget: q !== null, question: q ?? live.current.phone.aimQuestion });
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      act({ type: "aim", onTarget: false, question: live.current.phone.aimQuestion });
    };
  }, [act]);

  // Q / right-click puts the phone back under the desk.
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "q") act({ type: "openApp", app: "home" });
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [act]);

  const move = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    target.current = { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const shoot = () => {
    if (live.current.phone.focus < 1) return;
    act({ type: "snap" });
    setFlash((f) => f + 1);
    // Photo taken: bring the phone back down under the desk and straight into BrainGPT.
    setTimeout(() => {
      if (useGame.getState().snap?.phone.attachment !== null) act({ type: "openApp", app: "brain" });
    }, 280);
  };

  const q = p.aimOnTarget ? p.aimQuestion : null;
  return (
    <div
      ref={layer}
      className="absolute inset-0 z-30 cursor-none touch-none"
      onPointerMove={move}
      onPointerDown={move}
      onClick={shoot}
      onContextMenu={(e) => {
        e.preventDefault();
        act({ type: "openApp", app: "home" });
      }}
      aria-label="Camera: move the phone over a question and click to take a photo"
    >
      <div ref={rig} className="pointer-events-none absolute left-0 top-0" style={{ width: PHONE_W * scale, height: PHONE_H * scale }}>
        <div className="absolute left-0 top-0 origin-top-left" style={{ width: PHONE_W, height: PHONE_H, transform: `scale(${scale})` }}>
          <Hands layer="back" spread={0.5} />
          <PhoneFrame>
            <div className="absolute inset-0 overflow-hidden bg-[#1a1a1a]">
              <div style={{ filter: ready ? undefined : `blur(${(1 - p.focus) * 3.5}px)` }}>
                <PaperPage ref={page} title={snap.level.name} questions={snap.questions} answers={snap.answers} page={paperGeometry.page} />
              </div>
              {/* focus frame */}
              <div className="absolute left-1/2 top-1/2 h-[150px] w-[230px] -translate-x-1/2 -translate-y-1/2">
                {["left-0 top-0 border-l-4 border-t-4", "right-0 top-0 border-r-4 border-t-4", "left-0 bottom-0 border-l-4 border-b-4", "right-0 bottom-0 border-r-4 border-b-4"].map((c) => (
                  <span key={c} className={`absolute h-8 w-8 ${c} ${ready ? "border-ok" : p.aimOnTarget ? "border-amber" : "border-white"}`} />
                ))}
              </div>
              <div className="absolute inset-x-0 top-9 text-center text-[20px] font-bold">
                {ready ? (
                  <span className="rounded-lg bg-ok px-3 py-1 text-black">Q{(q ?? 0) + 1} FOCUSED · CLICK</span>
                ) : q !== null ? (
                  <span className="rounded-lg bg-amber px-3 py-1 text-black">Focusing Q{q + 1}… {Math.round(p.focus * 100)}%</span>
                ) : (
                  <span className="rounded-lg bg-black/70 px-3 py-1">Hold over a question</span>
                )}
              </div>
              <div className="absolute inset-x-0 bottom-6 flex justify-center">
                <span className="grid h-[86px] w-[86px] place-items-center rounded-full border-[6px] border-white/90" style={{ background: `conic-gradient(#30d158 ${p.focus * 360}deg, transparent 0)` }}>
                  <span className={`h-[64px] w-[64px] rounded-full ${ready ? "bg-white" : "bg-white/40"}`} />
                </span>
              </div>
              {flash > 0 && <div key={flash} className="shutter-flash absolute inset-0 bg-white" />}
            </div>
          </PhoneFrame>
          <Hands layer="front" />
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          act({ type: "openApp", app: "home" });
        }}
        className="absolute bottom-4 left-4 z-10 cursor-pointer rounded-full bg-black/75 px-4 py-2 text-sm font-semibold text-white"
      >
        ⬇ Lower phone (Q)
      </button>
      {!p.silent && <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-danger px-3 py-1 text-xs font-bold text-white">🔊 Shutter sound is ON</div>}
    </div>
  );
}
