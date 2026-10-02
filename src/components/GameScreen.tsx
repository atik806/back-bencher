"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getEngine, useGame } from "@/store/game-store";
import { PovCanvas } from "@/render/PovCanvas";
import { invert, rectToQuad, toCss } from "@/render/homography";
import type { Quad } from "@/render/pov";
import { Hud } from "./Hud";
import { Phone } from "./phone/Phone";
import { CameraRig } from "./phone/CameraRig";
import { PAPER_H, PAPER_W, PaperPage, pageCount } from "./desk/PaperPage";
import { paperGeometry } from "./desk/paperGeometry";
import { Briefing, PauseMenu, Results, Toasts, tutorialHint } from "./Overlays";
import { useHeadLook } from "./useHeadLook";
import { IntroOverlay } from "./IntroOverlay";
import { introPose, planIntro, type IntroPlan } from "@/render/intro";
import { sfx } from "@/audio/sfx";

export function GameScreen() {
  const snap = useGame((s) => s.snap);
  const act = useGame((s) => s.act);
  const [radar, setRadar] = useState(true);
  const [down, setDown] = useState(false);
  const [page, setPage] = useState(0);
  const [confirm, setConfirm] = useState(false);
  // Closing the tips hides them until the next exam starts.
  const [tipsOff, setTipsOff] = useState(false);
  const briefing = snap?.status === "briefing";
  const [wasBriefing, setWasBriefing] = useState(briefing);
  if (briefing !== wasBriefing) {
    setWasBriefing(briefing);
    if (briefing) setTipsOff(false);
  }
  const playing = snap?.status === "playing" && !snap.paused;
  const p = snap?.phone;
  const raised = !!p && p.out && !p.locked && !p.dead && p.app === "camera" && playing;
  const inLap = !!p && p.out && !raised && playing;
  // Raising the camera means looking down over the paper too.
  const look = useHeadLook(act, playing, down || raised, inLap);
  const paperRef = useRef<HTMLDivElement>(null);
  // Walk-in cutscene: where the camera walks, and when it started.
  const [intro, setIntro] = useState<{ plan: IntroPlan; startedAt: number } | null>(null);
  const introRef = useRef(intro);
  useEffect(() => {
    introRef.current = intro;
  });
  const beginIntro = () => {
    const eng = getEngine();
    if (!eng || eng.status !== "briefing") return;
    sfx.door();
    act({ type: "intro" });
    setIntro({ plan: planIntro(eng), startedAt: performance.now() });
  };
  const getPose = useCallback(() => {
    const i = introRef.current;
    return i ? introPose(i.plan, Math.min(i.plan.duration, (performance.now() - i.startedAt) / 1000)) : null;
  }, []);
  const downRef = useRef(down);
  // Opening the phone moves the viewpoint beneath the desktop.
  const [lapSeen, setLapSeen] = useState(false);
  if (inLap !== lapSeen) {
    setLapSeen(inLap);
    if (inLap) setDown(false);
  }
  useEffect(() => {
    downRef.current = down;
    paperGeometry.page = page;
  });

  useEffect(() => {
    const isSpace = (e: KeyboardEvent) => e.code === "Space" || e.key === " ";
    const keydown = (e: KeyboardEvent) => {
      const s = useGame.getState().snap;
      if (!s || s.status !== "playing") return;
      if (e.target instanceof HTMLElement && e.target.closest("input, select, textarea, [contenteditable='true']")) return;
      const k = e.key.toLowerCase();
      if (isSpace(e)) {
        e.preventDefault();
        if (!e.repeat && !s.paused) act({ type: "togglePhone" });
      } else if (e.key === "Escape") {
        act({ type: "pause", paused: !s.paused });
      } else if (k === "m" && !e.repeat) {
        setRadar((r) => !r);
      } else if (k === "s" || k === "arrowdown") {
        e.preventDefault();
        setDown(true);
      } else if (k === "w" || k === "arrowup") {
        e.preventDefault();
        setDown(false);
      }
    };
    // Stop Space from also "clicking" whatever button has focus.
    const keyup = (e: KeyboardEvent) => {
      if (isSpace(e) && useGame.getState().snap?.status === "playing" && !(e.target instanceof HTMLElement && e.target.closest("input, select, textarea, [contenteditable='true']"))) e.preventDefault();
    };
    // Switching tabs mid-exam pauses instead of silently freezing the clock.
    const hidden = () => {
      const s = useGame.getState().snap;
      if (document.hidden && s?.status === "playing" && !s.paused) act({ type: "pause", paused: true });
    };
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [act]);

  /** Every frame: pin the DOM paper onto the desk where the 3D view drew it. */
  const onPaper = useCallback((quad: Quad | null) => {
    const el = paperRef.current;
    const H = quad ? rectToQuad(PAPER_W, PAPER_H, quad) : null;
    paperGeometry.H = H;
    paperGeometry.inv = H ? invert(H) : null;
    if (!el) return;
    if (!H) {
      el.style.visibility = "hidden";
      return;
    }
    el.style.visibility = "visible";
    el.style.transform = toCss(H);
  }, []);

  if (!snap || !p) return null;
  const hint = tutorialHint(snap, down || raised);
  const ready = p.replies.some((r) => snap.answers[r.question] === null);
  const answered = snap.answers.filter((a) => a !== null).length;
  const total = snap.questions.length;

  const dragLook = (e: React.PointerEvent<HTMLElement>) => {
    if (raised || downRef.current) return;
    if (e.buttons !== 1 && e.pointerType === "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    look.setDrag(((e.clientX - r.left) / r.width - 0.5) * 2.4);
  };

  const holdBtn = (dir: "left" | "right", label: string) => (
    <button
      aria-label={`Look ${dir} (hold, or ${dir === "left" ? "A" : "D"})`}
      onPointerDown={(e) => {
        e.stopPropagation();
        look.setHold(dir, true);
      }}
      onPointerUp={() => look.setHold(dir, false)}
      onPointerLeave={() => look.setHold(dir, false)}
      onPointerCancel={() => look.setHold(dir, false)}
      className={`absolute top-[38%] z-20 grid h-16 w-10 -translate-y-1/2 touch-none select-none place-items-center rounded-xl bg-black/35 text-xl text-white/80 backdrop-blur hover:bg-black/55 ${dir === "left" ? "left-2" : "right-2"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Hud snap={snap} />

      {/* Everything you see, in first person: the hall, your desk, your paper, your hands. */}
      <section
        className="relative min-h-0 flex-1 touch-none overflow-hidden bg-[#2a1f17]"
        onPointerDown={(e) => {
          if (raised || down) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          dragLook(e);
        }}
        onPointerMove={dragLook}
        onPointerUp={() => look.setDrag(null)}
        onPointerCancel={() => look.setDrag(null)}
      >
        <PovCanvas source={getEngine} yaw={look.getYaw} look={look.getLook} duck={look.getDuck} pose={getPose} onPaper={onPaper} className="absolute inset-0 h-full w-full" />

        {/* Your question paper, lying on your desk (projected into the 3D view). */}
        <div
          className="absolute left-0 top-0 z-10"
          style={{ visibility: "hidden" }}
          ref={paperRef}
          onPointerDown={(e) => e.stopPropagation()}
          onClickCapture={(e) => {
            // Glancing at it from the room view just tilts your head down to read.
            if (!downRef.current) {
              e.stopPropagation();
              e.preventDefault();
              setDown(true);
            }
          }}
        >
          <PaperPage
            title={snap.level.name}
            questions={snap.questions}
            answers={snap.answers}
            page={Math.min(page, pageCount(total) - 1)}
            disabled={!playing}
            onAnswer={(question, option) => act({ type: "answer", question, option })}
            onPage={setPage}
            footer={
              confirm ? (
                <span className="flex gap-1">
                  <button
                    disabled={!playing}
                    onClick={(e) => {
                      e.stopPropagation();
                      act({ type: "submit" });
                    }}
                    className="rounded-md bg-[#1d2433] px-3 py-1 font-bold text-white"
                  >
                    {answered < total ? `Submit (${total - answered} blank)` : "Yes, submit"}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirm(false);
                    }}
                    className="px-2"
                    aria-label="Cancel submit"
                  >
                    ✕
                  </button>
                </span>
              ) : (
                <button
                  disabled={!playing}
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirm(true);
                  }}
                  className="rounded-md bg-[#1d2433] px-4 py-1 font-bold text-white disabled:opacity-40"
                >
                  Submit paper
                </button>
              )
            }
          />
        </div>

        {playing && !raised && !inLap && holdBtn("left", "‹")}
        {playing && !raised && !inLap && holdBtn("right", "›")}

        {radar && snap.status !== "intro" && (
          <div className="pointer-events-none absolute right-14 top-2 z-20 overflow-hidden rounded-xl border border-white/20 bg-black/50 shadow-xl backdrop-blur">
            <div className="flex items-center justify-between px-2 pt-1 text-[10px] font-bold uppercase tracking-wider text-white/70">
              <span>Radar</span>
              <span className="text-white/40">M</span>
            </div>
            <PovCanvas source={getEngine} yaw={look.getYaw} duck={look.getDuck} mode="radar" className="h-[92px] w-[92px] sm:h-[150px] sm:w-[150px]" />
          </div>
        )}

        {/* look up / down */}
        {playing && !raised && !inLap && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setDown((d) => !d)}
            className="absolute left-2 top-2 z-20 rounded-xl bg-black/60 px-3 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-black/75"
          >
            {down ? "👀 Look up (W)" : "📄 Look at paper (S)"}
          </button>
        )}

        {raised && <CameraRig snap={snap} />}

        {snap.status === "intro" && intro && (
          <IntroOverlay
            snap={snap}
            plan={intro.plan}
            startedAt={intro.startedAt}
            onDone={() => {
              setIntro(null);
              act({ type: "start" });
            }}
          />
        )}

        <Toasts />
        {/* Tips: a small card on the left, closable for the rest of this exam. */}
        {hint && !tipsOff && (
          <div
            role="note"
            aria-label="Tip"
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute left-2 top-[7.5rem] z-20 flex w-[min(300px,calc(100%-7rem))] items-start gap-2 rounded-xl border border-amber/50 bg-black/80 py-2 pl-3 pr-1.5 text-left text-sm font-medium text-amber shadow-lg backdrop-blur"
          >
            <span aria-hidden>💡</span>
            <span className="flex-1 leading-snug">{hint}</span>
            <button
              onClick={() => setTipsOff(true)}
              aria-label="Close tips"
              title="Hide tips for this exam"
              className="-mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md text-white/60 hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}
        {snap.investigating && (
          <div className="pointer-events-none absolute inset-x-0 top-14 z-20 flex justify-center">
            <div className="pulse-danger rounded-xl bg-danger px-4 py-2 text-sm font-black text-white">👀 {snap.investigating} is checking your desk</div>
          </div>
        )}
      </section>

      {snap.status === "playing" && !p.out && (
        <button
          onClick={() => act({ type: "phone", out: true })}
          disabled={p.dead || snap.paused}
          className="fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-full border border-white/15 bg-[#111] py-2 pl-3 pr-4 font-bold text-white shadow-2xl disabled:opacity-40"
          aria-label="Take phone out under the desk (Space)"
        >
          <span className="relative text-2xl">
            📱
            {(p.unread > 0 || ready) && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-danger" />}
          </span>
          <span className="text-left leading-tight">
            <span className="block text-sm">{p.dead ? "Dead" : "Phone"}</span>
            <span className="block text-[10px] font-normal text-white/50">{p.requests.length ? "✦ AI thinking…" : ready ? "✦ Answer ready" : "Space"}</span>
          </span>
        </button>
      )}

      <Phone snap={snap} />

      {snap.status === "briefing" && <Briefing snap={snap} onStart={beginIntro} />}
      {snap.status === "playing" && snap.paused && <PauseMenu />}
      {(snap.status === "caught" || snap.status === "finished") && <Results snap={snap} />}
    </div>
  );
}
