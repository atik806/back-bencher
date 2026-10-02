"use client";

import { useEffect, useRef, useState } from "react";
import { useGame, type Snapshot } from "@/store/game-store";
import { ANSWER_CONTACTS, type AnswerContact, type Option, type PhoneApp } from "@/engine/types";
import { sfx } from "@/audio/sfx";
import { Hands } from "./Hands";
import { BrainApp } from "./BrainApp";

export const PHONE_W = 300;
export const PHONE_H = 620;

/** Scale factor so the fixed-size phone fits the viewport. */
function usePhoneScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => {
      // Phones/tablets: keep the top of the room visible so you can still watch the teacher.
      const maxH = window.innerHeight * 0.6;
      setScale(Math.min(1, maxH / PHONE_H, (window.innerWidth - 40) / PHONE_W));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return scale;
}

/** Bezel + notch around whatever screen content is passed in. */
export function PhoneFrame({ children, dim }: { children: React.ReactNode; dim?: boolean }) {
  return (
    <div className="relative z-10 h-full w-full rounded-[44px] bg-[#111] p-3 shadow-[0_30px_80px_rgba(0,0,0,0.6),inset_0_0_0_2px_#333]">
      <div className="absolute left-1/2 top-4 z-20 h-6 w-24 -translate-x-1/2 rounded-full bg-black" />
      <div className="relative h-full w-full overflow-hidden rounded-[34px] bg-[#0b0d12] text-white" style={{ filter: dim ? "brightness(0.6)" : undefined }}>
        {children}
      </div>
    </div>
  );
}

/**
 * The phone in your lap, under the desk: held in both hands, just below the desk's front edge.
 * (When the Camera is open the phone is lifted over the paper instead: see CameraRig.)
 */
export function Phone({ snap }: { snap: Snapshot }) {
  const act = useGame((s) => s.act);
  const scale = usePhoneScale();
  const p = snap.phone;
  const raised = p.out && !p.locked && !p.dead && p.app === "camera";
  const out = p.out && !raised && snap.status === "playing" && !snap.paused;

  return (
    <div
      className="pointer-events-none fixed bottom-0 left-1/2 z-30 -translate-x-1/2"
      style={{ width: PHONE_W * scale, height: PHONE_H * scale }}
      aria-hidden={!out}
      inert={!out}
    >
      <div
        className={`phone-wrap absolute left-0 top-0 origin-top-left ${out ? "" : "phone-hidden"}`}
        style={{ width: PHONE_W, height: PHONE_H, transform: out ? `scale(${scale})` : undefined }}
      >
        <button
          onClick={() => act({ type: "phone", out: false })}
          className="pointer-events-auto absolute -top-10 left-1/2 z-40 -translate-x-1/2 rounded-full bg-danger px-5 py-2 text-sm font-black tracking-wide text-white shadow-lg"
        >
          ⬇ HIDE <span className="opacity-70">(Space)</span>
        </button>
        <Hands layer="back" />
        <div className="pointer-events-auto absolute inset-0 [transform:perspective(1100px)_rotateX(9deg)]">
          <PhoneFrame dim={p.brightness === "low"}>
            {p.dead ? (
              <div className="grid h-full place-items-center text-center text-white/40">
                <div>
                  <div className="text-5xl">🪫</div>
                  <div className="mt-2 text-sm">0%</div>
                </div>
              </div>
            ) : (
              <>
                {/* top strip sits behind the desk edge, so content starts a little lower */}
                <StatusBar snap={snap} />
                <div className="absolute inset-x-0 bottom-0 top-12">{p.locked ? <LockScreen snap={snap} /> : <AppView snap={snap} />}</div>
                {!p.locked && p.app !== "home" && (
                  <button
                    aria-label="Home"
                    onClick={() => act({ type: "openApp", app: "home" })}
                    className="absolute bottom-1.5 left-1/2 z-20 h-5 w-32 -translate-x-1/2 rounded-full"
                  >
                    <span className="mx-auto block h-1.5 w-28 rounded-full bg-white/70" />
                  </button>
                )}
              </>
            )}
          </PhoneFrame>
        </div>
        <Hands layer="front" />
      </div>
    </div>
  );
}

function StatusBar({ snap }: { snap: Snapshot }) {
  const p = snap.phone;
  const minutes = 10 * 60 + 5 + Math.floor(snap.time / 60) * 1; // a believable morning clock
  const clock = `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
  const bars = Math.max(1, Math.round(p.signal * 4));
  return (
    <div className="absolute inset-x-0 top-0 z-10 flex h-9 items-center justify-between px-6 text-[12px] font-semibold">
      <span>{clock}</span>
      <span className="flex items-center gap-1.5">
        {p.silent && <span title="Silent">🔕</span>}
        {p.dnd && <span title="Do Not Disturb">🌙</span>}
        <span className="flex items-end gap-[2px]" aria-label={`Signal ${bars} of 4`}>
          {[1, 2, 3, 4].map((i) => (
            <span key={i} className={`w-[3px] rounded-sm ${i <= bars ? "bg-white" : "bg-white/25"}`} style={{ height: 3 + i * 2 }} />
          ))}
        </span>
        <span className={p.battery <= 15 ? "text-danger" : ""}>{Math.ceil(p.battery)}%</span>
      </span>
    </div>
  );
}

function LockScreen({ snap }: { snap: Snapshot }) {
  const act = useGame((s) => s.act);
  const track = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const [x, setX] = useState(0);
  const notes = snap.phone.notifications.slice(-3).reverse();
  const max = 196;

  const onMove = (e: React.PointerEvent) => {
    if (drag === null || !track.current) return;
    const r = track.current.getBoundingClientRect();
    const scale = r.width / 248;
    setX(Math.max(0, Math.min(max, (e.clientX - drag) / scale)));
  };
  const onUp = () => {
    if (x > max * 0.85) {
      sfx.unlock();
      act({ type: "unlock" });
    }
    setDrag(null);
    setX(0);
  };

  return (
    <div className="flex h-full flex-col items-center bg-[radial-gradient(circle_at_30%_20%,#3b2a6b,#0b0d12_70%)] px-4 pt-8">
      <div className="text-6xl font-light tracking-tight">10:{String(5 + Math.floor(snap.time / 60)).padStart(2, "0")}</div>
      <div className="mt-1 text-sm text-white/60">Exam day 😬</div>
      <div className="mt-6 w-full space-y-2">
        {notes.map((n) => (
          <div key={n.id} className="rounded-2xl bg-white/12 p-3 text-xs backdrop-blur">
            <div className="font-semibold">{n.from}</div>
            <div className="text-white/75">{n.text}</div>
          </div>
        ))}
      </div>
      <div className="mt-auto mb-12 w-full">
        <div ref={track} className="relative mx-auto h-[52px] w-[248px] rounded-full bg-white/12 backdrop-blur" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <span className="absolute inset-0 grid place-items-center pl-10 text-sm text-white/60">slide to unlock →</span>
          <button
            aria-label="Unlock phone (slide right, or press Enter)"
            className="absolute left-1 top-1 grid h-[44px] w-[44px] touch-none place-items-center rounded-full bg-white text-lg text-black"
            style={{ transform: `translateX(${x}px)` }}
            onPointerDown={(e) => {
              (e.currentTarget.parentElement as HTMLElement).setPointerCapture(e.pointerId);
              setDrag(e.clientX - x);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                sfx.unlock();
                act({ type: "unlock" });
              }
            }}
          >
            🔓
          </button>
        </div>
      </div>
    </div>
  );
}

function AppView({ snap }: { snap: Snapshot }) {
  switch (snap.phone.app) {
    case "brain":
      return <BrainApp snap={snap} />;
    case "settings":
      return <SettingsApp snap={snap} />;
    case "messages":
      return <MessagesApp snap={snap} />;
    default:
      return <HomeScreen snap={snap} />;
  }
}

function HomeScreen({ snap }: { snap: Snapshot }) {
  const act = useGame((s) => s.act);
  const p = snap.phone;
  const pending = p.requests.length;
  const open = (app: Exclude<PhoneApp, "lock">) => {
    sfx.tap();
    act({ type: "openApp", app });
  };
  const apps: { app: Exclude<PhoneApp, "lock">; label: string; icon: string; bg: string; badge?: string | number }[] = [
    { app: "camera", label: "Camera", icon: "📷", bg: "bg-[#2a2d34]" },
    { app: "brain", label: "BrainGPT", icon: "✦", bg: "bg-gradient-to-br from-brain to-[#4c1d95]", badge: pending ? "…" : p.attachment !== null ? 1 : undefined },
    { app: "messages", label: "Messages", icon: "💬", bg: "bg-[#30d158]", badge: p.unread || undefined },
    { app: "settings", label: "Settings", icon: "⚙️", bg: "bg-[#636366]" },
  ];
  const risky = !p.silent || !p.dnd;
  return (
    <div className="flex h-full flex-col bg-[linear-gradient(160deg,#1e3a5f,#0b0d12_65%)] px-5 pt-6">
      {risky && (
        <button onClick={() => open("settings")} className="mb-5 rounded-2xl border border-danger/50 bg-danger/15 p-3 text-left text-xs">
          <div className="font-bold text-danger">⚠ Your phone can make noise</div>
          <div className="text-white/70">
            {!p.silent && "Ringer is ON. "}
            {!p.dnd && "Notifications are ON. "}Tap to fix in Settings.
          </div>
        </button>
      )}
      <div className="grid grid-cols-4 gap-x-3 gap-y-5">
        {apps.map((a) => (
          <button key={a.app} onClick={() => open(a.app)} className="flex flex-col items-center gap-1">
            <span className={`relative grid h-14 w-14 place-items-center rounded-2xl text-2xl shadow-lg ${a.bg}`}>
              {a.icon}
              {a.badge !== undefined && (
                <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[11px] font-bold">{a.badge}</span>
              )}
            </span>
            <span className="text-[11px] text-white/85">{a.label}</span>
          </button>
        ))}
      </div>
      <div className="mt-auto mb-8 rounded-3xl bg-white/8 p-4 text-xs text-white/70">
        <div className="font-semibold text-white">Today</div>
        <div className="mt-1">📝 {snap.level.name}, {snap.questions.length} questions</div>
        <div>✦ BrainGPT: {p.replies.length} answers so far</div>
      </div>
    </div>
  );
}

function Toggle({ on, onChange, label, desc }: { on: boolean; onChange: (v: boolean) => void; label: string; desc: string }) {
  return (
    <button onClick={() => onChange(!on)} role="switch" aria-checked={on} className="flex w-full items-center gap-3 border-b border-white/8 px-4 py-3 text-left">
      <div className="flex-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-[11px] text-white/50">{desc}</div>
      </div>
      <span className={`relative h-7 w-12 rounded-full transition ${on ? "bg-ok" : "bg-white/20"}`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

function SettingsApp({ snap }: { snap: Snapshot }) {
  const act = useGame((s) => s.act);
  const p = snap.phone;
  return (
    <div className="h-full bg-[#000] pt-2">
      <h2 className="px-4 pb-3 text-2xl font-bold">Settings</h2>
      <div className="mx-3 overflow-hidden rounded-xl bg-[#1c1c1e]">
        <Toggle on={p.silent} onChange={(v) => act({ type: "setting", key: "silent", value: v })} label="🔕 Silent mode" desc="No ringtone, no shutter click, no AI ping" />
        <Toggle on={p.dnd} onChange={(v) => act({ type: "setting", key: "dnd", value: v })} label="🌙 Do Not Disturb" desc="Blocks incoming messages completely" />
        <Toggle
          on={p.brightness === "low"}
          onChange={(v) => act({ type: "brightness", value: v ? "low" : "high" })}
          label="🔅 Low brightness"
          desc="Less glow under the desk, slower battery drain"
        />
      </div>
      <p className="px-5 pt-4 text-[11px] leading-relaxed text-white/40">
        Battery {Math.ceil(p.battery)}% · Signal {Math.round(p.signal * 100)}%
        {p.signal < 0.6 && " (weak: BrainGPT will be slow)"}
      </p>
    </div>
  );
}

function MessagesApp({ snap }: { snap: Snapshot }) {
  const act = useGame((s) => s.act);
  const history = useRef<HTMLDivElement>(null);
  const [to, setTo] = useState<AnswerContact>("Rafi");
  const [question, setQuestion] = useState(0);
  const [choice, setChoice] = useState<Option | null>(null);
  const selectedQuestion = Math.min(question, snap.questions.length - 1);
  const latestAiAnswer = snap.phone.replies.findLast((reply) => reply.question === selectedQuestion)?.answer ?? null;
  const answer = choice ?? snap.answers[selectedQuestion] ?? latestAiAnswer;
  const answerSource = choice !== null ? "Your choice" : snap.answers[selectedQuestion] !== null ? "Marked on your paper" : latestAiAnswer !== null ? "BrainGPT suggestion — check it first" : "Choose an answer to send";
  useEffect(() => {
    history.current?.scrollTo({ top: history.current.scrollHeight });
  }, [snap.phone.messages.length]);
  return (
    <div className="flex h-full flex-col bg-black">
      <div className="border-b border-white/10 px-4 pb-2 pt-2">
        <h2 className="text-2xl font-bold">Messages</h2>
        <p className="text-[11px] text-white/50">Send a question answer to a classmate.</p>
      </div>
      <div ref={history} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3 no-scrollbar" aria-label="Message history">
        {snap.phone.messages.length === 0 && <p className="mt-6 text-center text-xs text-white/45">No messages yet. You can send the first answer.</p>}
        {snap.phone.messages.map((message) => {
          const outgoing = message.from === "You";
          const contact = ANSWER_CONTACTS.find((name) => name === message.from);
          return (
            <div key={message.id} className={`w-fit max-w-[90%] rounded-2xl px-3 py-2 text-xs ${outgoing ? "ml-auto rounded-br-md bg-[#236a40]" : "rounded-bl-md bg-[#1c1c1e]"}`}>
              <div className="mb-1 text-[10px] font-semibold text-white/60">{outgoing ? `You → ${message.to}` : message.from}</div>
              <div className="leading-snug">{message.text}</div>
              {contact && (
                <button
                  type="button"
                  className="mt-2 text-[10px] font-semibold text-[#7be8a0] underline underline-offset-2"
                  onClick={() => {
                    setTo(contact);
                    const asked = Number(message.text.match(/\bQ(\d+)\b/i)?.[1]);
                    if (asked >= 1 && asked <= snap.questions.length) {
                      setQuestion(asked - 1);
                      setChoice(null);
                    }
                  }}
                >
                  Reply with answer
                </button>
              )}
            </div>
          );
        })}
      </div>
      <form
        className="space-y-2 border-t border-white/10 bg-[#101114] px-3 pb-7 pt-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (answer === null) return;
          sfx.tap();
          act({ type: "messageAnswer", to, question: selectedQuestion, option: answer });
        }}
      >
        <label className="flex items-center gap-2 text-xs">
          <span className="w-12 shrink-0 text-white/60">To</span>
          <select value={to} onChange={(event) => setTo(event.target.value as AnswerContact)} className="min-w-0 flex-1 rounded-lg border border-white/15 bg-[#25272c] px-2 py-2 text-white">
            {ANSWER_CONTACTS.map((contact) => <option key={contact} value={contact}>{contact}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs">
          <span className="w-12 shrink-0 text-white/60">Question</span>
          <select value={selectedQuestion} onChange={(event) => { setQuestion(Number(event.target.value)); setChoice(null); }} className="min-w-0 flex-1 rounded-lg border border-white/15 bg-[#25272c] px-2 py-2 text-white">
            {snap.questions.map((_, index) => <option key={index} value={index}>Q{index + 1}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs">
          <span className="w-12 shrink-0 text-white/60">Answer</span>
          <select value={answer === null ? "" : answer} onChange={(event) => setChoice(event.target.value === "" ? null : Number(event.target.value) as Option)} className="min-w-0 flex-1 rounded-lg border border-white/15 bg-[#25272c] px-2 py-2 text-white">
            <option value="">Select A–D</option>
            {snap.questions[selectedQuestion].options.map((option, index) => <option key={index} value={index}>{"ABCD"[index]}) {option}</option>)}
          </select>
        </label>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-white/45">{answerSource}</span>
          <button type="submit" disabled={answer === null} className="shrink-0 rounded-full bg-[#30d158] px-4 py-2 text-xs font-bold text-black disabled:opacity-40">Send answer</button>
        </div>
      </form>
    </div>
  );
}
