import { describe, expect, it } from "vitest";
import { createGame, dispatch, step, FIXED_DT, isTelegraphing } from "@/engine/game";
import { coneTest, dist } from "@/engine/geometry";
import { LEVELS } from "@/data/levels";
import { QUESTIONS } from "@/data/questions";
import type { GameState } from "@/engine/types";

/** Would the phone be risky to have out right now? A cautious-player heuristic. */
function danger(s: GameState): boolean {
  for (const t of s.teachers) {
    if (t.state === "gone") continue;
    if (isTelegraphing(t) || t.goal.type === "investigate" || t.alert.time > 0) return true;
    if (dist(t.pos, s.playerPos) < 2.6) return true;
    if (t.state === "reading") continue;
    // Pad the cone: teachers sweep their gaze while standing.
    if (coneTest(t.pos, t.facing, t.fov + 0.8, t.range + 1, s.playerPos).inside) return true;
  }
  for (const c of s.cctv) if (coneTest(c, c.facing, ((c.fov + 12) * Math.PI) / 180, c.range + 1, s.playerPos).inside) return true;
  if (s.students.some((st) => st.snitch && st.peek > 0)) return true;
  return false;
}

/** Plays a whole exam: silences the phone, then photographs and asks about every question. */
function playBot(s: GameState) {
  dispatch(s, { type: "start" });
  let settled = false;
  let next = 0;
  // Easy questions: a real player just knows these.
  s.questions.forEach((q, i) => q.difficulty === "easy" && dispatch(s, { type: "answer", question: i, option: q.correct }));
  const skip = () => {
    while (next < s.questions.length && s.answers[next] !== null) next++;
  };
  while (s.status === "playing") {
    const p = s.phone;
    if (danger(s)) {
      if (p.out) dispatch(s, { type: "phone", out: false });
    } else if (!p.dead) {
      if (!p.out) dispatch(s, { type: "phone", out: true });
      if (p.locked) dispatch(s, { type: "unlock" });
      if (!settled) {
        dispatch(s, { type: "openApp", app: "settings" });
        dispatch(s, { type: "setting", key: "silent", value: true });
        dispatch(s, { type: "setting", key: "dnd", value: true });
        dispatch(s, { type: "brightness", value: "low" });
        settled = true;
      }
      if (p.attachment !== null) {
        dispatch(s, { type: "openApp", app: "brain" });
        dispatch(s, { type: "send" });
        next++;
      } else if ((skip(), next < s.questions.length)) {
        if (p.app !== "camera") dispatch(s, { type: "openApp", app: "camera" });
        dispatch(s, { type: "aim", onTarget: true, question: next });
        if (p.focus >= 1) dispatch(s, { type: "snap" });
      } else if (p.out) {
        dispatch(s, { type: "phone", out: false });
      }
    }
    // Bubble whatever BrainGPT said.
    for (const r of p.replies) if (s.answers[r.question] === null) dispatch(s, { type: "answer", question: r.question, option: r.answer });
    if (next >= s.questions.length && p.requests.length === 0 && s.answers.every((a) => a !== null)) dispatch(s, { type: "submit" });
    step(s, FIXED_DT);
  }
  return s;
}

describe("a careful player can win", () => {
  it.each(LEVELS.map((l) => [l.id, l] as const))("level %i is beatable without getting caught", (_, l) => {
    const outcomes = [11, 22, 33, 44].map((seed) => playBot(createGame(l, { seed, pool: QUESTIONS })));
    const passed = outcomes.filter((s) => s.status === "finished" && (s.result?.percent ?? 0) >= 50);
    // Not every run has to be clean, but a careful player should usually make it.
    expect(passed.length, outcomes.map((s) => `${s.status}:${s.result?.percent}% ans=${s.result?.answered}/${s.questions.length} aiWrong=${s.result?.aiWrongTrusted} batt=${Math.round(s.phone.battery)} left=${Math.round(s.timeLeft)} out=${Math.round(s.phone.timeOut)}:${s.caughtReason ?? ""}`).join(" | ")).toBeGreaterThanOrEqual(3);
  });
});
