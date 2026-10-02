"use client";

import { useEffect } from "react";
import { useGame, type Snapshot } from "@/store/game-store";
import { LEVELS } from "@/data/levels";
import { Stars } from "./LevelSelect";
import { fmtTime } from "./Hud";

function Modal({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={label}>
      <div className="w-full max-w-lg rounded-2xl border border-line bg-panel p-6 shadow-2xl">{children}</div>
    </div>
  );
}

export function Briefing({ snap, onStart }: { snap: Snapshot; onStart: () => void }) {
  const go = useGame((s) => s.go);
  const L = snap.level;
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onStart();
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onStart]);

  return (
    <Modal label="Exam briefing">
      <div className="text-xs font-bold uppercase tracking-widest text-amber">Exam {L.id} · Briefing</div>
      <h2 className="mt-1 text-3xl font-black">{L.name}</h2>
      <div className="text-sm text-white/55">{L.subtitle}</div>
      <ul className="mt-4 space-y-2 text-sm text-white/85">
        {L.briefing.map((b) => (
          <li key={b} className="flex gap-2">
            <span className="text-amber">›</span>
            {b}
          </li>
        ))}
      </ul>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-white/5 p-2">
          <div className="text-lg font-bold">{fmtTime(L.duration)}</div>time
        </div>
        <div className="rounded-lg bg-white/5 p-2">
          <div className="text-lg font-bold">{L.questionCount}</div>questions
        </div>
        <div className="rounded-lg bg-white/5 p-2">
          <div className="text-lg font-bold">{L.battery}%</div>battery
        </div>
      </div>
      {(snap.perks.faceUnlock || snap.perks.brainPro) && (
        <div className="mt-3 text-xs text-ok">
          Upgrades: {[snap.perks.faceUnlock && "Face Unlock", snap.perks.brainPro && "BrainGPT Pro"].filter(Boolean).join(" · ")}
        </div>
      )}
      <div className="mt-4 rounded-lg border border-line p-3 text-xs text-white/60">
        <b className="text-white">Controls:</b> <kbd className="rounded bg-white/10 px-1">S</kbd>/<kbd className="rounded bg-white/10 px-1">W</kbd> look down at your paper
        / up at the room · <kbd className="rounded bg-white/10 px-1">Space</kbd> phone out under the desk / hide · Camera app lifts the phone over the paper:
        move it over a question, <b>click</b> to snap, <kbd className="rounded bg-white/10 px-1">Q</kbd> lowers it · <kbd className="rounded bg-white/10 px-1">A</kbd>/
        <kbd className="rounded bg-white/10 px-1">D</kbd> glance around · <kbd className="rounded bg-white/10 px-1">M</kbd> radar ·{" "}
        <kbd className="rounded bg-white/10 px-1">Esc</kbd> pause. Glowing patches on the floor show where teachers are looking.
      </div>
      <div className="mt-5 flex gap-2">
        <button onClick={onStart} className="flex-1 rounded-xl bg-amber py-3 text-lg font-bold text-ink">
          Start exam ▶
        </button>
        <button onClick={() => go("levels")} className="rounded-xl border border-line px-4">
          Back
        </button>
      </div>
    </Modal>
  );
}

export function PauseMenu() {
  const act = useGame((s) => s.act);
  const go = useGame((s) => s.go);
  const startLevel = useGame((s) => s.startLevel);
  const levelId = useGame((s) => s.levelId);
  return (
    <Modal label="Paused">
      <h2 className="text-center text-3xl font-black">Paused</h2>
      <p className="mt-1 text-center text-sm text-white/50">Time has stopped. If only real exams did that.</p>
      <div className="mt-6 grid gap-2">
        <button autoFocus onClick={() => act({ type: "pause", paused: false })} className="rounded-xl bg-amber py-3 font-bold text-ink">
          Resume
        </button>
        <button onClick={() => startLevel(levelId)} className="rounded-xl border border-line py-3">
          Restart exam
        </button>
        <button onClick={() => go("levels")} className="rounded-xl border border-line py-3">
          Quit to exam list
        </button>
      </div>
    </Modal>
  );
}

export function Results({ snap }: { snap: Snapshot }) {
  const go = useGame((s) => s.go);
  const startLevel = useGame((s) => s.startLevel);
  const r = snap.result;
  if (!r) return null;
  const hasNext = snap.level.id < LEVELS.length && r.stars >= 1;

  return (
    <Modal label={r.caught ? "Caught" : "Results"}>
      {r.caught ? (
        <div className="text-center">
          <div className="stamp mx-auto inline-block rounded-lg border-[6px] border-danger px-6 py-2 text-5xl font-black tracking-widest text-danger">EXPELLED</div>
          <p className="mt-5 text-lg font-semibold">You got caught.</p>
          <p className="mt-1 text-sm text-white/65">{r.caughtReason}</p>
          <p className="mt-3 text-xs text-white/40">
            Your paper was confiscated. Score: 0. Your parents have been informed. Your phone is in a drawer until the end of term.
          </p>
        </div>
      ) : (
        <div className="text-center">
          <div className="text-xs font-bold uppercase tracking-widest text-white/50">{snap.level.name} · Result</div>
          <div className="stamp mx-auto mt-3 grid h-28 w-28 place-items-center rounded-full border-[5px] border-amber text-5xl font-black text-amber">{r.grade}</div>
          <div className="mt-3">
            <Stars n={r.stars} size="text-3xl" />
          </div>
          <p className="mt-2 text-lg font-semibold">
            {r.correct} / {r.total} correct · {r.percent}%
          </p>
          {r.percent < 50 && <p className="text-sm text-danger">Below 50%: failed. Not caught, though, so that&apos;s something.</p>}
        </div>
      )}

      <dl className="mt-5 grid grid-cols-2 gap-2 text-sm">
        <Stat k="Answered" v={`${r.answered} / ${r.total}`} />
        <Stat k="Peak suspicion" v={`${r.maxSuspicion}%`} warn={r.maxSuspicion >= 50} />
        <Stat k="Used BrainGPT's answer" v={`${r.aiAnswersUsed}×`} />
        <Stat k="…and it was wrong" v={`${r.aiWrongTrusted}×`} warn={r.aiWrongTrusted > 0} />
        {!r.caught && <Stat k="Time left" v={fmtTime(r.timeLeft)} />}
      </dl>

      {(r.ghost || r.honest) && (
        <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs">
          {r.ghost && <span className="rounded-full bg-brain/25 px-3 py-1 font-semibold">👻 Ghost: phone never seen</span>}
          {r.honest && <span className="rounded-full bg-ok/20 px-3 py-1 font-semibold">😇 Honest Hero: passed without the phone</span>}
        </div>
      )}
      {!r.caught && r.stars < 3 && r.percent >= 50 && (
        <p className="mt-3 text-center text-xs text-white/45">★★★ needs 80%+ with peak suspicion under 50%.</p>
      )}

      <div className="mt-6 grid gap-2 sm:grid-cols-3">
        <button autoFocus onClick={() => startLevel(snap.level.id)} className="rounded-xl border border-line py-3 font-semibold">
          ↻ Retry
        </button>
        <button onClick={() => go("levels")} className="rounded-xl border border-line py-3 font-semibold">
          Exams
        </button>
        <button disabled={!hasNext} onClick={() => startLevel(snap.level.id + 1)} className="rounded-xl bg-amber py-3 font-bold text-ink disabled:opacity-30">
          Next ▶
        </button>
      </div>
    </Modal>
  );
}

function Stat({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <div className="rounded-lg bg-white/5 px-3 py-2">
      <dt className="text-[11px] text-white/50">{k}</dt>
      <dd className={`font-bold ${warn ? "text-danger" : ""}`}>{v}</dd>
    </div>
  );
}

export function Toasts() {
  const toasts = useGame((s) => s.toasts);
  const tone = {
    info: "border-white/15 bg-black/75",
    warn: "border-amber/60 bg-[#3a2a00]/90",
    danger: "border-danger/70 bg-[#3a0d0a]/90",
    good: "border-ok/60 bg-[#0b2e17]/90",
  };
  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-20 flex flex-col items-center gap-1.5 px-2" aria-live="assertive">
      {toasts.map((t) => (
        <div key={t.id} className={`toast-in max-w-md rounded-xl border px-3 py-2 text-center text-sm font-medium shadow-lg backdrop-blur ${tone[t.tone]}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function tutorialHint(snap: Snapshot, lookingDown: boolean): string | null {
  if (snap.level.id !== 1 || snap.status !== "playing") return null;
  const p = snap.phone;
  if (snap.investigating) return "A teacher is coming to check your desk. Keep the phone hidden until they leave.";
  if (snap.telegraph) return p.out ? "❗ Mr. Dozy is about to look up. HIDE THE PHONE NOW (Space)!" : "❗ He's about to look up. Good thing your phone is away.";
  const pending = p.replies.find((r) => snap.answers[r.question] === null);
  if (!p.out) {
    if (p.requests.length) return "BrainGPT keeps thinking in your pocket. Slip the phone out again when it's safe.";
    if (pending) return lookingDown ? `BrainGPT said ${"ABCD"[pending.answer]} for Q${pending.question + 1}. Fill in that bubble.` : `BrainGPT said ${"ABCD"[pending.answer]} for Q${pending.question + 1}. Look down at your paper (S) and fill it in.`;
    if (p.timeOut === 0) return lookingDown ? "This is your paper. Easy ones you can answer yourself. For the hard ones press SPACE to slip the phone out under the desk." : "Press S to look down at your paper. Mr. Dozy is reading his newspaper 📰. SPACE slips your phone out under the desk.";
    return lookingDown ? "Answer what you know. Look up (W) now and then to check on the teacher." : "Hard question? SPACE slips the phone out under the desk.";
  }
  if (p.locked) return "Under the desk: slide to unlock.";
  if (p.app === "camera") return p.focus >= 1 ? "Focused. CLICK to take the photo!" : "Move the phone over a question and hold it still until it focuses.";
  if (p.attachment !== null) return p.app === "brain" ? "Back under the desk. Send the photo to BrainGPT." : "Photo taken. Open BrainGPT (✦) and send it.";
  if (p.requests.length) return "BrainGPT is thinking. Hide the phone (Space) while you wait. It keeps working.";
  if (pending) return `BrainGPT says ${"ABCD"[pending.answer]} for Q${pending.question + 1}. Hide the phone and fill in the bubble.`;
  if (p.app === "home") return "Open the Camera to lift the phone over your paper.";
  return null;
}
