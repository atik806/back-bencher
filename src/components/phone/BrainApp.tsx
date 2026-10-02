"use client";

import { useEffect, useRef } from "react";
import { useGame, type Snapshot } from "@/store/game-store";

export function BrainApp({ snap }: { snap: Snapshot }) {
  const act = useGame((s) => s.act);
  const p = snap.phone;
  const end = useRef<HTMLDivElement>(null);

  const thread = [
    ...p.replies.map((r) => ({ id: r.id, question: r.question, reply: r, pending: undefined })),
    ...p.requests.map((r) => ({ id: r.id, question: r.question, reply: undefined, pending: r })),
  ].sort((a, b) => a.id - b.id);

  const count = thread.length;
  const done = p.replies.length;
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [count, done]);

  return (
    <div className="flex h-full flex-col bg-[#0f0b1a]">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 pb-2 pt-1">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brain to-[#4c1d95] text-lg">✦</span>
        <div className="leading-tight">
          <div className="text-sm font-bold">BrainGPT{snap.perks.brainPro && <span className="ml-1 rounded bg-amber px-1 text-[9px] text-black">PRO</span>}</div>
          <div className="text-[10px] text-white/50">{p.signal < 0.6 ? "📶 Weak signal, replies are slow" : "Answers anything. Mostly correctly."}</div>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3 no-scrollbar">
        {thread.length === 0 && (
          <div className="mt-6 text-center text-xs text-white/45">
            <div className="text-3xl">✦</div>
            Snap a question with the Camera and send it here.
          </div>
        )}
        {thread.map((m) => (
          <div key={m.id} className="space-y-2">
            <div className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-brain px-3 py-2 text-xs">
              <div className="mb-1 grid h-12 w-20 place-items-center rounded-md bg-[#fbf7ec] text-[9px] font-bold text-black/60">📄 Q{m.question + 1}</div>
              What&apos;s the answer?
            </div>
            {m.reply ? (
              <div className="w-fit max-w-[88%] rounded-2xl rounded-bl-md bg-white/10 px-3 py-2 text-xs">
                <div className="text-[10px] font-semibold text-white/50">Q{m.question + 1}</div>
                <div className="mt-0.5 leading-snug">{m.reply.text}</div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full ${m.reply.confidence >= 85 ? "bg-ok" : m.reply.confidence >= 60 ? "bg-amber" : "bg-danger"}`}
                      style={{ width: `${m.reply.confidence}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-white/60">{m.reply.confidence}% sure</span>
                </div>
                <div className="mt-1 text-center text-2xl font-black text-amber">{"ABCD"[m.reply.answer]}</div>
              </div>
            ) : (
              <div className="w-fit rounded-2xl rounded-bl-md bg-white/10 px-3 py-2 text-xs">
                <div className="typing flex gap-1 text-lg leading-none">
                  <span>•</span>
                  <span>•</span>
                  <span>•</span>
                </div>
                <div className="mt-1 h-1 w-28 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full bg-brain" style={{ width: `${(1 - m.pending!.remaining / m.pending!.total) * 100}%` }} />
                </div>
                <div className="mt-1 text-[10px] text-white/45">Thinking… (keeps going if you hide the phone)</div>
              </div>
            )}
          </div>
        ))}
        <div ref={end} />
      </div>

      <div className="border-t border-white/10 p-3 pb-8">
        {p.attachment !== null ? (
          <div className="flex items-center gap-2">
            <div className="grid h-10 w-14 place-items-center rounded-md bg-[#fbf7ec] text-[9px] font-bold text-black/60">📄 Q{p.attachment + 1}</div>
            <div className="flex-1 text-[11px] text-white/60">Photo ready</div>
            <button onClick={() => act({ type: "send" })} className="rounded-full bg-brain px-4 py-2 text-sm font-bold">
              Send ➤
            </button>
          </div>
        ) : (
          <button onClick={() => act({ type: "openApp", app: "camera" })} className="w-full rounded-full bg-white/10 py-2 text-sm">
            📸 Take a photo of a question
          </button>
        )}
      </div>
    </div>
  );
}
