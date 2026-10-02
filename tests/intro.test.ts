import { describe, expect, it } from "vitest";
import { createGame, dispatch, step, FIXED_DT } from "@/engine/game";
import { LEVELS } from "@/data/levels";
import { QUESTIONS } from "@/data/questions";
import { introPose, introStepIndex, planIntro, SEATED_EYE, STAND_EYE, WALK_SPEED, STEP_LENGTH } from "@/render/intro";

describe("walk-in intro", () => {
  it.each(LEVELS.map((l) => [l.id, l] as const))("level %i: walks from the door to your seat and sits", (_, l) => {
    const s = createGame(l, { seed: 3, pool: QUESTIONS });
    const plan = planIntro(s);
    expect(plan.total).toBeGreaterThan(2);
    expect(plan.duration).toBeLessThan(20);
    const first = introPose(plan, 0);
    expect(first.z).toBeCloseTo(STAND_EYE, 1);
    expect(Math.abs(first.x - s.room.nodes[s.room.doorNode].x)).toBeLessThan(0.3);
    const last = introPose(plan, plan.duration);
    expect(last.z).toBeCloseTo(SEATED_EYE, 2);
    expect(last.x).toBeCloseTo(s.playerPos.x, 2);
    expect(last.yaw).toBeCloseTo(-Math.PI / 2, 2);
    // every pose stays inside the room
    for (let t = 0; t <= plan.duration; t += 0.25) {
      const p = introPose(plan, t);
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(s.room.width);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(s.room.height);
    }
  });

  it("the exam clock doesn't run during the intro, but classmates do", () => {
    const s = createGame(LEVELS[1], { seed: 3, pool: QUESTIONS });
    dispatch(s, { type: "intro" });
    expect(s.status).toBe("intro");
    const phase = s.students[0].phase;
    for (let i = 0; i < 120; i++) step(s, FIXED_DT);
    expect(s.timeLeft).toBe(LEVELS[1].duration);
    expect(s.students[0].phase).toBeGreaterThan(phase);
    dispatch(s, { type: "start" });
    expect(s.status).toBe("playing");
  });

  it("places footfalls at fixed walking distances and stops at the seat", () => {
    const s = createGame(LEVELS[0], { seed: 3, pool: QUESTIONS });
    const plan = planIntro(s);
    const stepTime = STEP_LENGTH / WALK_SPEED;
    expect(introStepIndex(plan, 0)).toBe(0);
    expect(introStepIndex(plan, stepTime - 0.001)).toBe(0);
    expect(introStepIndex(plan, stepTime + 0.001)).toBe(1);
    expect(introStepIndex(plan, stepTime * 2 + 0.001)).toBe(2);
    expect(introStepIndex(plan, plan.walkTime + 0.5)).toBe(introStepIndex(plan, plan.walkTime));
    expect(introPose(plan, stepTime).z).toBeLessThan(introPose(plan, stepTime / 2).z);
  });
});
