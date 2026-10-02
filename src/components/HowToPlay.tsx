"use client";

import { useEffect } from "react";

const STEPS = [
  ["📄", "Your paper", "It's on your desk in front of you. Press S to look down and read it and fill in the bubbles, W to look back up at the room."],
  ["📱", "Phone under the desk", "SPACE slips the phone out into your lap, below the desk edge. SPACE again hides it instantly: that's your panic button."],
  ["📸", "Take the picture", "Open Camera and you lift the phone over your paper with both hands. Move it over a question, hold it still until it focuses, then click. Silent mode or the shutter CLICKS."],
  ["✦", "Ask BrainGPT", "The phone drops back under the desk into BrainGPT. Send the photo. It thinks for a while, even in your pocket, and it can be wrong."],
  ["✏️", "Fill it in", "Look down at the paper (S) and fill in the answer. Easy questions? Just answer them yourself."],
  ["💬", "Share an answer", "Open Messages, choose Rafi, Nadia, or Class Group, then pick a question and answer to send. Your marked answer or latest BrainGPT reply is suggested."],
] as const;

const DANGER = [
  ["Your view", "You see the hall from your seat. A glowing patch on the floor shows where a teacher is looking, and it turns red when they can see your phone."],
  ["Glancing around", "Hold A / D (or drag the view) to turn your head. The radar (M) shows the room from above. Twisting right round while a teacher watches looks like copying."],
  ["Staring at classmates", "Look at a neighbour for too long and they turn round: “I'm not going to help you.” Keep doing it and they shout for the teacher."],
  ["❗ over a seated teacher", "They're about to look up. Hide the phone."],
  ["Suspicion meter", "At 40% a teacher walks over to check your desk. At 100% you're expelled."],
  ["Noise", "Ringtones, shutter clicks and AI pings make teachers turn toward you. Use Settings: Silent + Do Not Disturb."],
  ["Snitches", "A classmate marked SNITCH glances at you (👀). If they see the phone, they raise their hand."],
  ["Brightness", "A bright screen is easier to spot. Low brightness is safer and saves battery."],
] as const;

export function HowToPlay({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="howto-title" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-panel p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <h2 id="howto-title" className="text-2xl font-bold">How to cheat (in this game)</h2>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-xl text-white/60 hover:bg-white/10" aria-label="Close">
            ✕
          </button>
        </div>
        <ol className="mt-5 grid gap-3">
          {STEPS.map(([icon, title, body], i) => (
            <li key={title} className="flex gap-3 rounded-xl bg-white/5 p-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/10 text-xl">{icon}</span>
              <div>
                <div className="font-semibold">
                  <span className="text-amber">{i + 1}.</span> {title}
                </div>
                <div className="text-sm text-white/70">{body}</div>
              </div>
            </li>
          ))}
        </ol>
        <h3 className="mt-6 text-lg font-bold text-danger">What gets you caught</h3>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {DANGER.map(([t, b]) => (
            <li key={t} className="rounded-xl border border-line p-3 text-sm">
              <div className="font-semibold">{t}</div>
              <div className="text-white/65">{b}</div>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-xs text-white/45">
          Back Bencher is a comedy game. Real invigilators don&apos;t come with handy vision cones, and real exams are better passed by
          studying. BrainGPT is fictional: its answers are pre-written in the game.
        </p>
      </div>
    </div>
  );
}
