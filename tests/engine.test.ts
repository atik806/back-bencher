import { describe, expect, it } from "vitest";
import { createGame, dispatch, step, FIXED_DT, coneActive, isTelegraphing, SUSPICIOUS_AT, INVESTIGATE_TIME, NOISE, gazedStudent, CLASSMATE_LINES } from "@/engine/game";
import { coneTest, wrapAngle, turnToward } from "@/engine/geometry";
import { buildRoom, buildRoute, findPath, nearestNode, seatPos } from "@/engine/room";
import { gradeFor, starsFor } from "@/engine/scoring";
import { createRng } from "@/engine/rng";
import { LEVELS, getLevel } from "@/data/levels";
import { QUESTIONS } from "@/data/questions";
import type { GameState, LevelConfig } from "@/engine/types";

const run = (s: GameState, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / FIXED_DT); i++) step(s, FIXED_DT);
};

function game(level: LevelConfig | number = 1, seed = 42) {
  const s = createGame(typeof level === "number" ? getLevel(level) : level, { seed, pool: QUESTIONS });
  dispatch(s, { type: "start" });
  return s;
}

/** A quiet level with one seated teacher whose next glance is far away. */
function quietLevel(over: Partial<LevelConfig> = {}): LevelConfig {
  return { ...getLevel(1), teachers: [{ name: "T", kind: "seated", speed: 1, fov: 70, range: 30, wait: [999, 999], glance: 2 }], ...over };
}

describe("geometry", () => {
  it("wraps angles", () => {
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapAngle(-3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapAngle(0.5)).toBeCloseTo(0.5);
  });
  it("turns the short way round", () => {
    expect(turnToward(3, -3, 0.1)).toBeGreaterThan(3);
    expect(turnToward(0, 1, 5)).toBeCloseTo(1);
  });
  it("cone hit / miss / range", () => {
    const o = { x: 0, y: 0 };
    expect(coneTest(o, 0, Math.PI / 2, 10, { x: 5, y: 0 }).inside).toBe(true);
    expect(coneTest(o, 0, Math.PI / 2, 10, { x: 5, y: 0 }).centre).toBeCloseTo(1);
    expect(coneTest(o, 0, Math.PI / 2, 10, { x: -5, y: 0 }).inside).toBe(false);
    expect(coneTest(o, 0, Math.PI / 2, 10, { x: 11, y: 0 }).inside).toBe(false);
    expect(coneTest(o, 0, Math.PI / 2, 10, { x: 5, y: 5.1 }).inside).toBe(false);
  });
});

describe("room + pathing", () => {
  const room = buildRoom(5, 5);
  it("every node is reachable from the teacher's chair", () => {
    room.nodes.forEach((_, i) => {
      const p = findPath(room, room.seatNode, i);
      expect(p[0]).toBe(room.seatNode);
      expect(p[p.length - 1]).toBe(i);
    });
  });
  it("paths only step along graph edges", () => {
    const p = findPath(room, room.seatNode, nearestNode(room, { x: room.laneX[0], y: room.backY }));
    for (let i = 1; i < p.length; i++) expect(room.adj[p[i - 1]]).toContain(p[i]);
  });
  it("routes are non-empty for every kind", () => {
    for (const k of ["snake", "snake-reverse", "perimeter", "left-half", "right-half"] as const) {
      expect(buildRoute(room, k).length).toBeGreaterThan(2);
    }
  });
});

describe("rng determinism", () => {
  it("same seed, same game", () => {
    const a = game(3, 7);
    const b = game(3, 7);
    expect(a.questions.map((q) => q.id)).toEqual(b.questions.map((q) => q.id));
    run(a, 30);
    run(b, 30);
    expect(a.teachers.map((t) => t.pos)).toEqual(b.teachers.map((t) => t.pos));
  });
  it("shuffle keeps every item", () => {
    const r = createRng(1);
    expect(r.shuffle([1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("levels", () => {
  it.each(LEVELS.map((l) => [l.id, l] as const))("level %i picks the right number of unique questions", (_, l) => {
    const s = createGame(l, { seed: 1, pool: QUESTIONS });
    expect(s.questions).toHaveLength(l.questionCount);
    expect(new Set(s.questions.map((q) => q.id)).size).toBe(l.questionCount);
    expect(s.students.filter((x) => x.isPlayer)).toHaveLength(1);
  });
  it.each(LEVELS.map((l) => [l.id, l] as const))("level %i: an idle player with a silenced phone stays clean for 60s", (_, l) => {
    const s = game({ ...l, startSilent: true, startDnd: true });
    run(s, 60);
    expect(s.status).toBe("playing");
    expect(s.suspicion).toBe(0);
  });
  it.each(LEVELS.map((l) => [l.id, l] as const))("level %i: seated teachers can see the player's seat from their chair", (_, l) => {
    const s = createGame(l, { seed: 1, pool: QUESTIONS });
    for (const t of s.teachers.filter((x) => x.kind === "seated")) {
      expect(Math.hypot(t.pos.x - s.playerPos.x, t.pos.y - s.playerPos.y)).toBeLessThan(t.range);
    }
  });
  it.each(LEVELS.map((l) => [l.id, l] as const))("level %i: leaving the phone out the whole exam gets you caught", (_, l) => {
    for (const seed of [1, 2, 3]) {
      const s = createGame({ ...l, battery: 1000 }, { seed, pool: QUESTIONS });
      dispatch(s, { type: "start" });
      dispatch(s, { type: "phone", out: true });
      run(s, l.duration);
      expect(s.status).toBe("caught");
    }
  });
  it("question bank answers are in range", () => {
    for (const q of QUESTIONS) {
      expect(q.options).toHaveLength(4);
      expect(q.correct).toBeGreaterThanOrEqual(0);
      expect(q.correct).toBeLessThan(4);
      expect(q.ai.answer).toBeLessThan(4);
    }
  });
});

describe("seated teacher", () => {
  it("reads (cone off), telegraphs, then looks up", () => {
    const s = game(quietLevel({ teachers: [{ name: "T", kind: "seated", speed: 1, fov: 70, range: 30, wait: [1, 1], glance: 2 }] }));
    const t = s.teachers[0];
    expect(t.state).toBe("reading");
    expect(coneActive(t)).toBe(false);
    run(s, t.timer + 0.1);
    expect(isTelegraphing(t)).toBe(true);
    expect(coneActive(t)).toBe(false);
    run(s, 1);
    expect(coneActive(t)).toBe(true);
  });
});

describe("teacher footsteps", () => {
  it("emits footsteps from distance walked and stops when the teacher stops", () => {
    const s = game(quietLevel({ teachers: [{ name: "Walker", kind: "patrol", speed: 1, fov: 70, range: 8, wait: [999, 999], route: "snake" }] }));
    const t = s.teachers[0];
    t.state = "walking";
    t.path = [{ x: t.pos.x, y: t.pos.y + 2 }];
    t.walked = 0;
    t.footfalls = 0;

    run(s, 2.1);
    const footsteps = s.events.filter((event) => event.kind === "footstep");
    expect(footsteps.map((event) => event.footfall)).toEqual([1, 2]);
    expect(footsteps[0].pos.y).toBeGreaterThan(s.room.frontY);

    t.state = "pausing";
    t.timer = 999;
    run(s, 1);
    expect(s.events.filter((event) => event.kind === "footstep")).toHaveLength(2);
  });
});

describe("detection", () => {
  it("phone hidden → no suspicion even in plain sight", () => {
    const s = game(quietLevel());
    s.teachers[0].state = "pausing";
    s.teachers[0].timer = 999;
    s.teachers[0].pos = { ...s.playerPos, y: s.playerPos.y - 3 };
    s.teachers[0].facing = Math.PI / 2;
    run(s, 2);
    expect(s.suspicion).toBe(0);
  });

  it("phone out in the cone fills suspicion; out of the cone does not", () => {
    const s = game(quietLevel());
    const t = s.teachers[0];
    t.state = "pausing";
    t.timer = t.timerTotal = 999;
    t.sweepBase = Math.PI / 2;
    t.pos = { x: s.playerPos.x, y: s.playerPos.y - 4 };
    t.facing = -Math.PI / 2; // facing away
    dispatch(s, { type: "phone", out: true });
    // Facing away: the sweep keeps it pointed down the room, so turn it hard away and pin it.
    t.sweepBase = -Math.PI / 2;
    run(s, 0.5);
    expect(s.suspicion).toBe(0);
    t.sweepBase = Math.PI / 2;
    t.facing = Math.PI / 2;
    run(s, 0.5);
    expect(s.suspicion).toBeGreaterThan(0);
  });

  it("an unsilenced phone ringing in your pocket raises suspicion", () => {
    const s = game(quietLevel({ notifications: [1, 1], startSilent: false, startDnd: false }));
    s.teachers[0].pos = { x: s.playerPos.x, y: s.playerPos.y - 3 };
    run(s, 1.5);
    expect(s.suspicion).toBeGreaterThan(0);
  });

  it("standing right next to you sees the phone regardless of facing", () => {
    const s = game(quietLevel());
    const t = s.teachers[0];
    t.state = "pausing";
    t.timer = t.timerTotal = 999;
    t.sweepBase = -Math.PI / 2;
    t.facing = -Math.PI / 2;
    t.pos = { x: s.playerPos.x + 0.8, y: s.playerPos.y };
    dispatch(s, { type: "phone", out: true });
    run(s, 0.2);
    expect(s.suspicion).toBeGreaterThan(0);
  });

  it("craning your neck in a teacher's view is suspicious; a small glance is not", () => {
    const setup = (yaw: number) => {
      const s = game(quietLevel());
      const t = s.teachers[0];
      t.state = "pausing";
      t.timer = t.timerTotal = 999;
      t.sweepBase = Math.PI / 2;
      t.pos = { x: s.playerPos.x, y: s.playerPos.y - 4 };
      t.facing = Math.PI / 2;
      dispatch(s, { type: "look", yaw });
      run(s, 1);
      return s;
    };
    expect(setup(0.5).suspicion).toBe(0);
    const craning = setup(1.6);
    expect(craning.suspicion).toBeGreaterThan(0);
    // ...but far slower than holding a phone.
    expect(craning.suspicion).toBeLessThan(20);
  });

  it("head yaw is clamped", () => {
    const s = game(quietLevel());
    dispatch(s, { type: "look", yaw: 99 });
    expect(s.headYaw).toBeLessThanOrEqual(2);
  });

  it("suspicion decays after the grace period", () => {
    const s = game(quietLevel());
    s.suspicion = 30;
    s.lastSeenAt = 0;
    run(s, 1);
    expect(s.suspicion).toBe(30);
    run(s, 3);
    expect(s.suspicion).toBeLessThan(30);
  });

  it("100 suspicion = caught, and the result is EXPELLED with zero score", () => {
    const s = game(quietLevel());
    s.answers = s.questions.map((q) => q.correct);
    const t = s.teachers[0];
    t.state = "pausing";
    t.timer = t.timerTotal = 999;
    t.sweepBase = Math.PI / 2;
    t.facing = Math.PI / 2;
    t.pos = { x: s.playerPos.x, y: s.playerPos.y - 2 };
    dispatch(s, { type: "phone", out: true });
    run(s, 10);
    expect(s.status).toBe("caught");
    expect(s.result?.grade).toBe("EXPELLED");
    expect(s.result?.correct).toBe(0);
    expect(s.result?.stars).toBe(0);
  });
});

describe("investigation", () => {
  it("crossing the threshold sends a teacher to your desk; hiding clears you", () => {
    const s = game(quietLevel());
    s.suspicion = SUSPICIOUS_AT + 1;
    s.lastSeenAt = s.time;
    run(s, FIXED_DT * 2);
    const t = s.teachers[0];
    expect(t.goal.type).toBe("investigate");
    run(s, 40);
    expect(s.status).toBe("playing");
    expect(s.events.some((e) => e.kind === "cleared")).toBe(true);
  });

  it("phone out while the teacher stands at your desk = caught", () => {
    const s = game(quietLevel());
    s.suspicion = SUSPICIOUS_AT + 1;
    s.lastSeenAt = s.time;
    for (let i = 0; i < 60 * 40 && s.teachers[0].state !== "investigating"; i++) step(s, FIXED_DT);
    expect(s.teachers[0].state).toBe("investigating");
    dispatch(s, { type: "phone", out: true });
    run(s, FIXED_DT);
    expect(s.status).toBe("caught");
  });

  it("investigation lasts INVESTIGATE_TIME", () => {
    expect(INVESTIGATE_TIME).toBeGreaterThan(1);
  });
});

describe("phone flow", () => {
  it("must be out + unlocked to open apps", () => {
    const s = game(quietLevel());
    dispatch(s, { type: "openApp", app: "camera" });
    expect(s.phone.app).toBe("lock");
    dispatch(s, { type: "phone", out: true });
    dispatch(s, { type: "openApp", app: "camera" });
    expect(s.phone.app).toBe("lock");
    dispatch(s, { type: "unlock" });
    dispatch(s, { type: "openApp", app: "camera" });
    expect(s.phone.app).toBe("camera");
  });

  it("camera focuses only while on target, then snaps → send → reply", () => {
    const s = game(quietLevel());
    dispatch(s, { type: "phone", out: true });
    dispatch(s, { type: "unlock" });
    dispatch(s, { type: "openApp", app: "camera" });
    dispatch(s, { type: "aim", onTarget: false, question: 2 });
    run(s, 2);
    expect(s.phone.focus).toBe(0);
    dispatch(s, { type: "snap" });
    expect(s.phone.attachment).toBeNull();
    dispatch(s, { type: "aim", onTarget: true, question: 2 });
    run(s, 1.3);
    expect(s.phone.focus).toBe(1);
    dispatch(s, { type: "snap" });
    expect(s.phone.attachment).toBe(2);
    dispatch(s, { type: "openApp", app: "brain" });
    dispatch(s, { type: "send" });
    expect(s.phone.requests).toHaveLength(1);
    // The request keeps going with the phone hidden.
    dispatch(s, { type: "phone", out: false });
    run(s, 10);
    expect(s.phone.replies).toHaveLength(1);
    expect(s.phone.replies[0].question).toBe(2);
  });

  it("hiding the phone resets camera focus and relocks after a while", () => {
    const s = game(quietLevel());
    dispatch(s, { type: "phone", out: true });
    dispatch(s, { type: "unlock" });
    dispatch(s, { type: "openApp", app: "camera" });
    dispatch(s, { type: "aim", onTarget: true, question: 0 });
    run(s, 0.5);
    expect(s.phone.focus).toBeGreaterThan(0);
    dispatch(s, { type: "phone", out: false });
    run(s, FIXED_DT);
    expect(s.phone.focus).toBe(0);
    run(s, 7);
    expect(s.phone.locked).toBe(true);
  });

  it("face unlock perk skips the lock screen", () => {
    const s = createGame(quietLevel(), { seed: 1, pool: QUESTIONS, perks: { faceUnlock: true } });
    dispatch(s, { type: "start" });
    dispatch(s, { type: "phone", out: true });
    expect(s.phone.locked).toBe(false);
  });

  it("battery drains only while out and kills the phone at 0", () => {
    const s = game(quietLevel({ battery: 1, drain: 1 }));
    run(s, 3);
    expect(s.phone.battery).toBe(1);
    dispatch(s, { type: "phone", out: true });
    run(s, 2);
    expect(s.phone.dead).toBe(true);
    expect(s.phone.out).toBe(false);
    dispatch(s, { type: "phone", out: true });
    expect(s.phone.out).toBe(false);
  });

  it("shutter is silent only in silent mode", () => {
    const loud = game(quietLevel({ startSilent: false }));
    const t = loud.teachers[0];
    t.pos = { x: loud.playerPos.x, y: loud.playerPos.y - 4 };
    dispatch(loud, { type: "phone", out: true });
    dispatch(loud, { type: "unlock" });
    dispatch(loud, { type: "openApp", app: "camera" });
    loud.phone.focus = 1;
    dispatch(loud, { type: "snap" });
    expect(loud.suspicion).toBeGreaterThan(NOISE.shutter / 2);
    expect(t.alert.time).toBeGreaterThan(0);

    const quiet = game(quietLevel({ startSilent: true }));
    dispatch(quiet, { type: "phone", out: true });
    dispatch(quiet, { type: "unlock" });
    dispatch(quiet, { type: "openApp", app: "camera" });
    quiet.phone.focus = 1;
    dispatch(quiet, { type: "snap" });
    expect(quiet.suspicion).toBe(0);
  });

  it("do-not-disturb blocks notifications", () => {
    const s = game(quietLevel({ notifications: [1, 1], startDnd: true }));
    run(s, 5);
    expect(s.phone.notifications).toHaveLength(0);
    const loud = game(quietLevel({ notifications: [1, 1], startDnd: false }));
    run(loud, 2.5);
    expect(loud.phone.notifications.length).toBeGreaterThan(0);
  });

  it("sends a selected answer to a classmate from Messages, even with DND enabled", () => {
    const s = game(quietLevel({ startDnd: true }));
    dispatch(s, { type: "phone", out: true });
    dispatch(s, { type: "unlock" });
    dispatch(s, { type: "openApp", app: "messages" });
    dispatch(s, { type: "messageAnswer", to: "Rafi", question: 0, option: 2 });

    expect(s.phone.messages).toEqual([
      expect.objectContaining({
        from: "You",
        to: "Rafi",
        question: 0,
        answer: 2,
        text: `Q1: C) ${s.questions[0].options[2]}`,
      }),
    ]);
    expect(s.phone.notifications).toHaveLength(0);
    expect(s.phone.unread).toBe(0);
  });

  it("keeps incoming notifications in the Messages conversation history", () => {
    const s = game(quietLevel({ notifications: [1, 1], startDnd: false }));
    run(s, 2.5);
    expect(s.phone.messages.length).toBeGreaterThan(0);
    expect(s.phone.messages[0]).toEqual({
      ...s.phone.notifications[0],
      to: "You",
    });
  });

  it("does not send while locked, outside Messages, or with an invalid answer", () => {
    const s = game(quietLevel());
    dispatch(s, { type: "phone", out: true });
    dispatch(s, { type: "messageAnswer", to: "Nadia", question: 0, option: 1 });
    dispatch(s, { type: "unlock" });
    dispatch(s, { type: "messageAnswer", to: "Nadia", question: 0, option: 1 });
    dispatch(s, { type: "openApp", app: "messages" });
    dispatch(s, { type: "messageAnswer", to: "Nadia", question: -1, option: 1 });
    dispatch(s, { type: "messageAnswer", to: "Nadia", question: s.questions.length, option: 1 });
    dispatch(s, { type: "messageAnswer", to: "Nadia", question: 0, option: 4 as 0 });
    expect(s.phone.messages).toHaveLength(0);
  });

  it("brainPro perk fixes most wrong AI answers", () => {
    const wrongQs = QUESTIONS.filter((q) => q.ai.answer !== q.correct);
    let fixed = 0;
    for (let seed = 0; seed < 20; seed++) {
      const s = createGame(quietLevel({ questionCount: wrongQs.length, difficultyMix: {} }), { seed, pool: wrongQs, perks: { brainPro: true } });
      dispatch(s, { type: "start" });
      dispatch(s, { type: "phone", out: true });
      dispatch(s, { type: "unlock" });
      s.phone.attachment = 0;
      dispatch(s, { type: "send" });
      run(s, 10);
      if (s.phone.replies[0].correct) fixed++;
    }
    expect(fixed).toBeGreaterThan(5);
  });
});

describe("staring at classmates", () => {
  // Player sits at (4,3) in quietLevel; (3,3) is the neighbour directly to the left.
  const lookLeft = (s: GameState) => dispatch(s, { type: "look", yaw: -Math.PI / 2 });
  const neighbour = (s: GameState) => s.students.find((x) => x.seat.c === 3 && x.seat.r === 3)!;

  it("finds the classmate you're looking at, but not on a small glance", () => {
    const s = game(quietLevel());
    expect(gazedStudent(s)).toBeNull();
    dispatch(s, { type: "look", yaw: -0.3 });
    expect(gazedStudent(s)).toBeNull();
    lookLeft(s);
    expect(gazedStudent(s)).toBe(neighbour(s));
  });

  it("a neighbour you stare at tells you off", () => {
    const s = game(quietLevel());
    lookLeft(s);
    run(s, 0.5);
    expect(neighbour(s).speech).toBeNull();
    run(s, 0.6);
    const sp = neighbour(s).speech!;
    expect(sp.level).toBe(1);
    expect(CLASSMATE_LINES[1]).toContain(sp.text);
    expect(s.events.some((e) => e.kind === "classmate")).toBe(true);
    expect(s.suspicion).toBe(0); // first time is just a telling-off
  });

  it("keep staring and they escalate to calling the teacher", () => {
    const s = game(quietLevel());
    s.teachers[0].pos = { x: s.playerPos.x, y: s.playerPos.y - 5 };
    lookLeft(s);
    run(s, 12);
    const n = neighbour(s);
    expect(n.annoyed).toBeGreaterThanOrEqual(3);
    expect(s.events.some((e) => e.kind === "classmate" && e.level === 3)).toBe(true);
    expect(s.maxSuspicion).toBeGreaterThanOrEqual(15);
  });

  it("looking away lets the stare meter drain", () => {
    const s = game(quietLevel());
    lookLeft(s);
    run(s, 0.6);
    dispatch(s, { type: "look", yaw: 0 });
    run(s, 1);
    expect(neighbour(s).gaze).toBe(0);
    expect(neighbour(s).speech).toBeNull();
  });
});

describe("snitch", () => {
  it("a peeking snitch who sees the phone sends a teacher", () => {
    const l = quietLevel({ snitches: [{ c: 4, r: 2 }] }); // directly in front of the player seat (4,3)
    const s = game(l);
    const sn = s.students.find((x) => x.snitch)!;
    sn.peek = 5;
    dispatch(s, { type: "phone", out: true });
    run(s, 2);
    expect(s.events.some((e) => e.kind === "snitch")).toBe(true);
    expect(s.teachers[0].goal.type).toBe("investigate");
  });
});

describe("timer + scoring", () => {
  it("time running out finishes the exam and grades it", () => {
    const s = game(quietLevel({ duration: 3 }));
    s.questions.forEach((q, i) => dispatch(s, { type: "answer", question: i, option: q.correct }));
    run(s, 4);
    expect(s.status).toBe("finished");
    expect(s.result?.percent).toBe(100);
    expect(s.result?.honest).toBe(true);
  });

  it("grades and stars", () => {
    expect(gradeFor(95)).toBe("A+");
    expect(gradeFor(50)).toBe("D");
    expect(gradeFor(10)).toBe("F");
    expect(starsFor(90, false, 10)).toBe(3);
    expect(starsFor(90, false, 70)).toBe(2);
    expect(starsFor(55, false, 0)).toBe(1);
    expect(starsFor(100, true, 0)).toBe(0);
  });

  it("counts wrong AI answers the player trusted", () => {
    const s = game(quietLevel());
    s.phone.replies.push({ id: 1, question: 0, answer: ((s.questions[0].correct + 1) % 4) as 0, confidence: 90, text: "", correct: false });
    dispatch(s, { type: "answer", question: 0, option: s.phone.replies[0].answer });
    dispatch(s, { type: "submit" });
    expect(s.result?.aiWrongTrusted).toBe(1);
  });

  it("seat positions sit inside the room", () => {
    const room = buildRoom(6, 6);
    const p = seatPos(room, { c: 5, r: 5 });
    expect(p.x).toBeLessThan(room.width);
    expect(p.y).toBeLessThan(room.backY);
  });
});

describe("flying squad", () => {
  it("spawns, patrols, and leaves", () => {
    const s = game(quietLevel({ squad: { at: 0.01, duration: 5 }, duration: 400 }));
    run(s, 5);
    const squad = s.teachers.find((t) => t.kind === "squad");
    expect(squad).toBeDefined();
    run(s, 120);
    expect(squad!.state).toBe("gone");
  });
});
