"use client";

import { useGame, type Snapshot } from "@/store/game-store";
import { SUSPICIOUS_AT } from "@/engine/game";

export const fmtTime = (s: number) => {
  const t = Math.max(0, Math.ceil(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

function suspicionLabel(v: number) {
  if (v < 15) return "Calm";
  if (v < SUSPICIOUS_AT) return "Noticed";
  if (v < 75) return "Suspicious";
  return "DANGER";
}

export function Hud({ snap }: { snap: Snapshot }) {
  const act = useGame((s) => s.act);
  const muted = useGame((s) => s.muted);
  const toggleMute = useGame((s) => s.toggleMute);
  const v = snap.suspicion;
  const low = snap.timeLeft < 30;
  const barColor = v < 15 ? "bg-ok" : v < SUSPICIOUS_AT ? "bg-amber" : "bg-danger";

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-panel px-3 py-2 sm:px-4">
      <div className="min-w-0">
        <div className="truncate text-sm font-bold leading-tight sm:text-base">{snap.level.name}</div>
        <div className="truncate text-[11px] text-white/50">{snap.level.subtitle}</div>
      </div>

      <div className={`rounded-lg bg-black/40 px-3 py-1 font-mono text-lg font-bold tabular-nums sm:text-xl ${low ? "text-danger" : ""}`} aria-label={`Time left ${fmtTime(snap.timeLeft)}`}>
        ⏱ {fmtTime(snap.timeLeft)}
      </div>

      <div className="order-last flex min-w-[220px] flex-1 items-center gap-2 sm:order-none" aria-live="polite">
        <span className={`text-lg ${snap.seen ? "shake" : ""}`} aria-hidden>
          {snap.seen ? "👁️" : "😐"}
        </span>
        <div className="flex-1">
          <div className="flex justify-between text-[11px] font-semibold uppercase tracking-wide">
            <span className={v >= SUSPICIOUS_AT ? "text-danger" : "text-white/70"}>
              Suspicion: {suspicionLabel(v)}
              {snap.seen && <span className="ml-2 text-danger">SEEN!</span>}
            </span>
            <span className="tabular-nums text-white/60">{Math.round(v)}%</span>
          </div>
          <div className={`relative mt-1 h-2.5 overflow-hidden rounded-full bg-white/10 ${snap.seen ? "pulse-danger" : ""}`}>
            <div className={`h-full rounded-full transition-[width] duration-100 ${barColor}`} style={{ width: `${v}%` }} />
            <div className="absolute inset-y-0 w-0.5 bg-white/50" style={{ left: `${SUSPICIOUS_AT}%` }} title="A teacher comes to check" />
          </div>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1 text-sm">
        <span className={`rounded-md px-2 py-1 ${snap.phone.battery <= 15 ? "bg-danger/20 text-danger" : "bg-white/5"}`} title="Battery">
          🔋 {Math.ceil(snap.phone.battery)}%
        </span>
        <span className={`rounded-md px-2 py-1 ${snap.phone.silent ? "bg-white/5" : "bg-danger/20 text-danger"}`} title={snap.phone.silent ? "Phone on silent" : "Phone ringer ON"}>
          {snap.phone.silent ? "🔕" : "🔔"}
        </span>
        <button onClick={toggleMute} className="rounded-md px-2 py-1 hover:bg-white/10" aria-label={muted ? "Unmute game sound" : "Mute game sound"}>
          {muted ? "🔇" : "🔊"}
        </button>
        <button onClick={() => act({ type: "pause", paused: true })} className="rounded-md px-2 py-1 hover:bg-white/10" aria-label="Pause (Esc)">
          ⏸
        </button>
      </div>
    </header>
  );
}
