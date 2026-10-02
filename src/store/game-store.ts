"use client";

import { create } from "zustand";
import { createGame, dispatch as engineDispatch, step, FIXED_DT, isTelegraphing } from "@/engine/game";
import type { Action, GameEvent, GameState, PhoneState, Question, Result, LevelConfig, Option, Perks } from "@/engine/types";
import { getLevel } from "@/data/levels";
import { QUESTIONS } from "@/data/questions";
import { loadProgress, perksFrom, recordResult, saveProgress, type Progress } from "@/lib/progress";
import { setMuted, sfx } from "@/audio/sfx";

export type Screen = "title" | "levels" | "game";

/** The slice of engine state React renders. Published ~20×/s, not every frame. */
export interface Snapshot {
  status: GameState["status"];
  paused: boolean;
  time: number;
  timeLeft: number;
  suspicion: number;
  seen: boolean;
  investigating: string | null;
  telegraph: boolean;
  phone: PhoneState;
  answers: (Option | null)[];
  questions: Question[];
  level: LevelConfig;
  perks: Perks;
  result?: Result;
}

export interface Toast {
  id: number;
  tone: "info" | "warn" | "danger" | "good";
  text: string;
}

interface Store {
  screen: Screen;
  levelId: number;
  snap: Snapshot | null;
  progress: Progress;
  muted: boolean;
  toasts: Toast[];
  hydrated: boolean;
  hydrate(): void;
  go(screen: Screen): void;
  startLevel(id: number): void;
  act(a: Action): void;
  toggleMute(): void;
  dismissToast(id: number): void;
}

let engine: GameState | null = null;
let raf = 0;
let lastFrame = 0;
let acc = 0;
let lastPublish = 0;
let lastEventSeen = 0;
let nextBeat = 0;
let recordedFor: GameState | null = null;

export const getEngine = () => engine;

function snapshot(s: GameState): Snapshot {
  const investigator = s.teachers.find((t) => t.goal.type === "investigate" && t.state !== "gone");
  return {
    status: s.status,
    paused: s.paused,
    time: s.time,
    timeLeft: s.timeLeft,
    suspicion: s.suspicion,
    seen: s.seenThisTick,
    investigating: investigator ? investigator.name : null,
    telegraph: s.teachers.some(isTelegraphing),
    phone: {
      ...s.phone,
      requests: s.phone.requests.map((r) => ({ ...r })),
      replies: s.phone.replies.slice(),
      notifications: s.phone.notifications.slice(),
      messages: s.phone.messages.slice(),
    },
    answers: s.answers.slice(),
    questions: s.questions,
    level: s.level,
    perks: s.perks,
    result: s.result,
  };
}

let toastSeq = 0;

export const useGame = create<Store>((set, get) => {
  const pushToast = (tone: Toast["tone"], text: string) => {
    const id = ++toastSeq;
    set((st) => ({ toasts: [...st.toasts.slice(-3), { id, tone, text }] }));
    setTimeout(() => get().dismissToast(id), tone === "danger" ? 4200 : 3200);
  };

  const handleEvent = (e: GameEvent) => {
    switch (e.kind) {
      case "notification":
        if (e.audible === "ring") {
          sfx.ring();
          pushToast("danger", `♪ Your phone is RINGING: ${e.from}: “${e.text}”`);
        } else {
          sfx.buzz();
          pushToast("info", `📳 ${e.from}: ${e.text}`);
        }
        break;
      case "aiReply":
        if (e.audible === "ping") {
          sfx.ping();
          pushToast("warn", `🔔 BrainGPT pinged out loud: Q${e.question + 1} answered`);
        } else {
          sfx.buzz();
          pushToast("good", `✦ BrainGPT answered Q${e.question + 1}`);
        }
        break;
      case "shutter":
        if (e.silent) sfx.shutterQuiet();
        else {
          sfx.shutter();
          pushToast("danger", "📸 CLICK! The shutter sound echoed through the hall.");
        }
        break;
      case "investigate":
        sfx.alert();
        pushToast("danger", `👀 ${e.teacher} is coming to your desk. HIDE THE PHONE!`);
        break;
      case "cleared":
        pushToast("good", `${e.teacher} found nothing and moved on.`);
        break;
      case "classmate":
        if (e.level === 3) {
          sfx.alert();
          pushToast("danger", `🗣️ A classmate shouted: “${e.text}”`);
        } else if (e.level === 2) {
          sfx.buzz();
          pushToast("warn", `💬 “${e.text}” Stop staring at your neighbours.`);
        } else {
          sfx.tap();
        }
        break;
      case "snitch":
        sfx.alert();
        pushToast("danger", "✋ A classmate raised their hand and is pointing at you!");
        break;
      case "squad":
        sfx.siren();
        pushToast("danger", "🚨 FLYING SQUAD has entered the hall!");
        break;
      case "distraction":
        pushToast("info", "✋ A student asked for extra paper, so the teacher is busy for a few seconds.");
        break;
      case "battery":
        pushToast(e.level === "dead" ? "danger" : "warn", e.level === "dead" ? "🪫 Your phone died." : "🔋 Battery low (15%).");
        break;
      case "noise":
        if (e.source === "npc" && e.label === "Achoo!") pushToast("info", `🤧 Someone sneezed. Heads turn toward them.`);
        break;
      case "footstep": {
        if (!engine || engine.status !== "playing" || engine.paused) break;
        const dx = e.pos.x - engine.playerPos.x;
        const distance = Math.hypot(dx, e.pos.y - engine.playerPos.y);
        const volume = Math.max(0, 1 - distance / 6) * 0.5;
        if (volume > 0.05) sfx.step(e.footfall, volume, Math.max(-0.35, Math.min(0.35, dx / 5)));
        break;
      }
      case "answer":
        sfx.pencil();
        break;
      case "caught":
        sfx.caught();
        break;
      case "finished":
        sfx.win();
        break;
    }
  };

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    if (!engine) return;
    const dt = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;
    acc += dt;
    while (acc >= FIXED_DT) {
      step(engine, FIXED_DT);
      acc -= FIXED_DT;
    }
    for (const e of engine.events) {
      if (e.id <= lastEventSeen) continue;
      lastEventSeen = e.id;
      handleEvent(e);
    }
    // Heartbeat speeds up with suspicion.
    if (engine.status === "playing" && !engine.paused && engine.suspicion > 30 && now > nextBeat) {
      sfx.heartbeat(Math.min(1, engine.suspicion / 100));
      nextBeat = now + 1100 - engine.suspicion * 6.5;
    }
    if (now - lastPublish > 50 || engine.status !== get().snap?.status) {
      lastPublish = now;
      set({ snap: snapshot(engine) });
      if (engine.result && recordedFor !== engine) {
        recordedFor = engine;
        const progress = recordResult(get().progress, engine.level.id, engine.result);
        saveProgress(progress);
        set({ progress });
      }
    }
  };

  const ensureLoop = () => {
    if (raf || typeof window === "undefined") return;
    lastFrame = performance.now();
    raf = requestAnimationFrame(frame);
  };

  return {
    screen: "title",
    levelId: 1,
    snap: null,
    progress: { levels: {} },
    muted: false,
    toasts: [],
    hydrated: false,
    hydrate() {
      if (get().hydrated) return;
      let muted = false;
      try {
        muted = localStorage.getItem("back-bencher:muted") === "1";
      } catch {}
      setMuted(muted);
      set({ progress: loadProgress(), muted, hydrated: true });
    },
    go(screen) {
      if (screen !== "game") {
        engine = null;
        set({ snap: null, toasts: [] });
      }
      set({ screen });
    },
    startLevel(id) {
      const level = getLevel(id);
      engine = createGame(level, { pool: QUESTIONS, perks: perksFrom(get().progress) });
      lastEventSeen = 0;
      acc = 0;
      set({ screen: "game", levelId: id, snap: snapshot(engine), toasts: [] });
      ensureLoop();
    },
    act(a) {
      if (!engine) return;
      engineDispatch(engine, a);
      set({ snap: snapshot(engine) });
    },
    toggleMute() {
      const muted = !get().muted;
      setMuted(muted);
      try {
        localStorage.setItem("back-bencher:muted", muted ? "1" : "0");
      } catch {}
      set({ muted });
    },
    dismissToast(id) {
      set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) }));
    },
  };
});
