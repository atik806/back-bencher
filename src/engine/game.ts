import { createRng } from "./rng";
import { angleTo, clamp, coneTest, dist, turnToward, wrapAngle } from "./geometry";
import { besideSeat, buildRoom, buildRoute, findPath, nearestNode, seatPos, STEP_LENGTH } from "./room";
import { computeResult } from "./scoring";
import { ANSWER_CONTACTS } from "./types";
import type {
  Action,
  Difficulty,
  GameState,
  LevelConfig,
  NewGameEvent,
  Option,
  Perks,
  PhoneState,
  Question,
  Student,
  Teacher,
  TeacherConfig,
  TeacherGoal,
  Vec,
} from "./types";

// ---------------------------------------------------------------- tuning

export const SUSPICIOUS_AT = 40;
export const CAUGHT_AT = 100;
export const BASE_RATE = 55;
export const CCTV_FACTOR = 0.55;
export const PROXIMITY = 1.25;
export const PROXIMITY_RATE = 30;
export const DECAY_RATE = 4;
export const DECAY_GRACE = 1.5;
export const TELEGRAPH = 0.8;
export const INVESTIGATE_TIME = 2.6;
export const INVESTIGATE_RELIEF = 30;
export const INVESTIGATE_COOLDOWN = 7;
export const HELP_TIME = 3.2;
export const ALERT_TIME = 1.3;
export const HEARING = 11;
export const RELOCK_AFTER = 6;
export const FOCUS_TIME = 1.1;
export const SNITCH_TRIGGER = 1.4;
export const SNITCH_PENALTY = 25;
/** Turning your head further than this looks like you're copying a neighbour. */
export const LOOK_LIMIT = 1.0;
export const LOOK_EXPOSURE = 0.2;
export const MAX_YAW = 2.0;
/** Staring at a classmate this long makes them react. */
export const GAZE_TRIGGER = 0.9;
/** Classmates within this distance notice you looking at them. */
export const GAZE_RANGE = 3.6;
/** How close to the centre of your view they must be (radians). */
export const GAZE_CONE = 0.45;
/** A quick glance is fine; your head has to actually be turned. */
export const GAZE_MIN_YAW = 0.45;
export const COMPLAINT_PENALTY = 15;

export const CLASSMATE_LINES: Record<1 | 2 | 3, string[]> = {
  1: ["I'm not going to help you.", "Don't look at my sheet!", "Eyes on your own paper.", "Nope. Do your own exam.", "Stop copying me!", "Cover your eyes, not my paper."],
  2: ["Seriously, stop looking!", "I'll tell the teacher!", "Back off! Shh!", "You'll get us BOTH caught!"],
  3: ["SIR! They keep copying me!", "MA'AM! This one is cheating!", "Teacher! Look, they're copying!"],
};

export const NOISE = { ring: 42, buzz: 8, shutter: 34, ping: 16, softBuzz: 3 } as const;

const DOWN = Math.PI / 2;
const UP = -Math.PI / 2;
const DEG = Math.PI / 180;

const MESSAGES: [string, string][] = [
  ["Mom", "did u eat breakfast?? 🥺"],
  ["Mom", "call me when exam finishes"],
  ["Rafi", "bro which answer for Q3"],
  ["Rafi", "yo are u in the exam rn 😂"],
  ["Pizza Palace", "🍕 50% OFF today only!"],
  ["Bank", "Your OTP is 448812. Do not share."],
  ["Class Group", "@everyone is the exam open book?"],
  ["Dad", "Good luck beta 👍"],
  ["Telco", "Your data pack expires in 2 days."],
  ["Nadia", "did u finish the assignment"],
];

// ---------------------------------------------------------------- setup

export interface CreateOptions {
  seed?: number;
  pool: Question[];
  perks?: Partial<Perks>;
}

export function pickQuestions(level: LevelConfig, pool: Question[], rand: ReturnType<typeof createRng>): Question[] {
  const picked: Question[] = [];
  const order: Difficulty[] = ["easy", "medium", "hard", "absurd"];
  for (const d of order) {
    const want = level.difficultyMix[d] ?? 0;
    picked.push(...rand.shuffle(pool.filter((q) => q.difficulty === d)).slice(0, want));
  }
  // Top up from anything left if the mix asked for more than the pool holds.
  if (picked.length < level.questionCount) {
    const rest = rand.shuffle(pool.filter((q) => !picked.includes(q)));
    picked.push(...rest.slice(0, level.questionCount - picked.length));
  }
  return rand.shuffle(picked.slice(0, level.questionCount));
}

function makeTeacher(s: GameState, cfg: TeacherConfig, index: number): Teacher {
  const { room } = s;
  const base: Teacher = {
    id: `t${index}`,
    name: cfg.name,
    kind: cfg.kind,
    pos: { ...room.nodes[room.seatNode] },
    facing: DOWN,
    lookTarget: DOWN,
    state: "reading",
    timer: 0,
    timerTotal: 0,
    goal: { type: "desk" },
    path: [],
    walked: 0,
    footfalls: 0,
    route: [],
    routeIndex: 0,
    speed: cfg.speed,
    fov: cfg.fov * DEG,
    range: cfg.range,
    wait: cfg.wait,
    glance: cfg.glance ?? 2.4,
    sweepBase: DOWN,
    alert: { time: 0, angle: 0 },
    seesPlayer: false,
  };
  if (cfg.kind === "seated") {
    // A grace period at the start so the tutorial isn't instantly hostile.
    base.timer = s.rng.range(cfg.wait[0], cfg.wait[1]) + 2;
    return base;
  }
  base.route = buildRoute(room, cfg.route ?? "snake");
  base.pos = { ...room.nodes[base.route[0]] };
  base.state = "pausing";
  base.goal = { type: "patrol" };
  base.timer = base.timerTotal = s.rng.range(cfg.wait[0], cfg.wait[1]) + 1.5;
  base.sweepBase = base.pos.y <= room.frontY + 0.1 ? DOWN : UP;
  base.facing = base.lookTarget = base.sweepBase;
  base.routeIndex = 1 % base.route.length;
  return base;
}

export function createGame(level: LevelConfig, opts: CreateOptions): GameState {
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const rng = createRng(seed);
  const room = buildRoom(level.cols, level.rows);
  const perks: Perks = { faceUnlock: false, brainPro: false, ...opts.perks };
  const questions = pickQuestions(level, opts.pool, rng);

  const students: Student[] = [];
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) {
      const isPlayer = c === level.playerSeat.c && r === level.playerSeat.r;
      students.push({
        seat: { c, r },
        pos: seatPos(room, { c, r }),
        isPlayer,
        snitch: !isPlayer && !!level.snitches?.some((s) => s.c === c && s.r === r),
        hand: 0,
        peek: 0,
        peekCooldown: rng.range(4, 9),
        snitchMeter: 0,
        gaze: 0,
        annoyed: 0,
        speechCooldown: 0,
        speech: null,
        hue: rng.int(0, 359),
        phase: rng.range(0, Math.PI * 2),
      });
    }
  }

  const phone: PhoneState = {
    out: false,
    locked: true,
    hiddenFor: 0,
    app: "lock",
    silent: level.startSilent,
    dnd: level.startDnd,
    brightness: "high",
    battery: level.battery,
    dead: false,
    signal: level.signal,
    aimOnTarget: false,
    aimQuestion: 0,
    focus: 0,
    attachment: null,
    requests: [],
    replies: [],
    notifications: [],
    messages: [],
    unread: 0,
    timeOut: 0,
  };

  const range = (r?: [number, number]) => (r ? rng.range(r[0], r[1]) : Infinity);

  const s: GameState = {
    level,
    perks,
    rng,
    seed,
    room,
    status: "briefing",
    paused: false,
    time: 0,
    timeLeft: level.duration,
    teachers: [],
    students,
    cctv: (level.cctv ?? []).map((c) => ({ ...c, facing: c.centre * DEG, seesPlayer: false })),
    playerPos: seatPos(room, level.playerSeat),
    headYaw: 0,
    questions,
    answers: questions.map(() => null),
    phone,
    suspicion: 0,
    maxSuspicion: 0,
    seenThisTick: false,
    lastSeenAt: -Infinity,
    everSeen: false,
    phoneEverOut: false,
    investigateCooldown: 0,
    timers: { distraction: range(level.distractions), sneeze: range(level.sneezes), notification: range(level.notifications) },
    squadSpawned: false,
    events: [],
    eventSeq: 0,
    nextId: 1,
  };
  s.teachers = level.teachers.map((cfg, i) => makeTeacher(s, cfg, i));
  return s;
}

// ---------------------------------------------------------------- helpers

function emit(s: GameState, e: NewGameEvent) {
  s.events.push({ ...e, id: ++s.eventSeq, t: s.time } as GameState["events"][number]);
  if (s.events.length > 60) s.events.splice(0, s.events.length - 60);
}

export function phoneExposure(p: PhoneState): number {
  if (!p.out || p.dead) return 0;
  return (p.app === "camera" ? 1.4 : 1) * (p.brightness === "high" ? 1.15 : 0.8);
}

export function coneActive(t: Teacher): boolean {
  if (t.state === "gone") return false;
  if (t.alert.time > 0) return true;
  if (t.state === "reading") return false;
  if (t.state === "glancing") return t.timerTotal - t.timer > TELEGRAPH;
  return true;
}

/** True while a seated teacher is about to look up (the ❗ warning). */
export const isTelegraphing = (t: Teacher) => t.state === "glancing" && t.timerTotal - t.timer <= TELEGRAPH && t.alert.time <= 0;

function goTo(s: GameState, t: Teacher, target: Vec, goal: TeacherGoal) {
  const from = nearestNode(s.room, t.pos);
  const to = nearestNode(s.room, target);
  const path = findPath(s.room, from, to).map((i) => ({ ...s.room.nodes[i] }));
  if (path.length && dist(path[0], t.pos) < 0.05) path.shift();
  const last = path[path.length - 1];
  if (!last || dist(last, target) > 0.01) path.push({ ...target });
  t.path = path;
  t.walked = 0;
  t.footfalls = 0;
  t.goal = goal;
  t.state = "walking";
}

function resume(s: GameState, t: Teacher) {
  if (t.kind === "seated") return goTo(s, t, s.room.nodes[s.room.seatNode], { type: "desk" });
  if (t.kind === "squad" && t.leaveAt !== undefined && s.time >= t.leaveAt) {
    return goTo(s, t, s.room.nodes[s.room.doorNode], { type: "leave" });
  }
  goTo(s, t, s.room.nodes[t.route[t.routeIndex]], { type: "patrol" });
}

function arrive(s: GameState, t: Teacher) {
  const g = t.goal;
  switch (g.type) {
    case "desk":
      t.state = "reading";
      t.lookTarget = DOWN;
      t.timer = s.rng.range(t.wait[0], t.wait[1]) * 0.7;
      break;
    case "patrol":
      t.state = "pausing";
      t.timer = t.timerTotal = s.rng.range(t.wait[0], t.wait[1]);
      t.sweepBase = t.pos.y <= s.room.frontY + 0.1 ? DOWN : t.pos.y >= s.room.backY - 0.1 ? UP : t.facing;
      t.routeIndex = (t.routeIndex + 1) % t.route.length;
      break;
    case "investigate":
      t.state = "investigating";
      t.timer = t.timerTotal = INVESTIGATE_TIME;
      break;
    case "help":
      t.state = "distracted";
      t.timer = t.timerTotal = HELP_TIME;
      break;
    case "leave":
      t.state = "gone";
      break;
  }
}

function moveAlong(s: GameState, t: Teacher, dt: number) {
  const speed = t.goal.type === "investigate" ? t.speed * 1.35 : t.speed;
  let budget = speed * dt;
  let moved = 0;
  while (budget > 0 && t.path.length) {
    const next = t.path[0];
    const d = dist(t.pos, next);
    if (d > 1e-6) t.lookTarget = angleTo(t.pos, next);
    if (d <= budget) {
      t.pos = { ...next };
      t.path.shift();
      budget -= d;
      moved += d;
    } else {
      t.pos = { x: t.pos.x + ((next.x - t.pos.x) / d) * budget, y: t.pos.y + ((next.y - t.pos.y) / d) * budget };
      moved += budget;
      budget = 0;
    }
  }
  t.walked += moved;
  const footfall = Math.floor(t.walked / STEP_LENGTH + 1e-6);
  if (footfall > t.footfalls) {
    t.footfalls = footfall;
    if (s.status === "playing") emit(s, { kind: "footstep", teacher: t.id, pos: { ...t.pos }, footfall });
  }
  if (!t.path.length) arrive(s, t);
}

function caught(s: GameState, reason: string) {
  if (s.status !== "playing") return;
  s.status = "caught";
  s.caughtReason = reason;
  s.phone.out = false;
  s.result = computeResult(s);
  emit(s, { kind: "caught", reason });
}

function finish(s: GameState) {
  if (s.status !== "playing") return;
  s.status = "finished";
  s.phone.out = false;
  s.result = computeResult(s);
  emit(s, { kind: "finished" });
}

function nearestTeacher(s: GameState, p: Vec, filter: (t: Teacher) => boolean): Teacher | undefined {
  let best: Teacher | undefined;
  for (const t of s.teachers) {
    if (t.state === "gone" || !filter(t)) continue;
    if (!best || dist(t.pos, p) < dist(best.pos, p)) best = t;
  }
  return best;
}

function sendToInvestigate(s: GameState, reason: string) {
  if (s.teachers.some((t) => t.goal.type === "investigate" && t.state !== "gone")) return;
  const t = nearestTeacher(s, s.playerPos, () => true);
  if (!t) return;
  const seat = s.level.playerSeat;
  const right = Math.abs(t.pos.x - s.room.laneX[seat.c + 1]) < Math.abs(t.pos.x - s.room.laneX[seat.c]);
  t.alert.time = 0;
  goTo(s, t, besideSeat(s.room, seat, right), { type: "investigate" });
  emit(s, { kind: "investigate", teacher: t.name, reason });
}

/** A sound in the room. Teachers in earshot turn toward it; player noise also raises suspicion. */
export function makeNoise(s: GameState, pos: Vec, loud: number, label: string, source: "player" | "npc") {
  emit(s, { kind: "noise", source, label, pos: { ...pos }, loud });
  let heard = false;
  for (const t of s.teachers) {
    if (t.state === "gone") continue;
    const d = dist(t.pos, pos);
    if (d > HEARING || loud <= 0) continue;
    if (loud < 6 && d > 3) continue; // a soft buzz only carries a few desks
    heard = true;
    if (t.state !== "investigating") t.alert = { time: ALERT_TIME, angle: angleTo(t.pos, pos) };
  }
  if (source === "player" && heard) {
    const nearest = nearestTeacher(s, pos, () => true);
    const d = nearest ? dist(nearest.pos, pos) : HEARING;
    s.suspicion = clamp(s.suspicion + loud * clamp(1 - d / 14, 0.25, 1));
  }
}

function aiReply(s: GameState, qi: number) {
  const q = s.questions[qi];
  let answer: Option = q.ai.answer;
  let confidence = q.ai.confidence;
  let note = q.ai.note;
  const weight = { easy: 0.3, medium: 0.7, hard: 1.3, absurd: 1 }[q.difficulty];
  if (answer === q.correct && s.rng.next() < s.level.aiErrorBoost * weight) {
    const wrong = ([0, 1, 2, 3] as Option[]).filter((o) => o !== q.correct);
    answer = s.rng.pick(wrong);
    confidence = s.rng.int(64, 92);
    note = undefined;
  } else if (answer !== q.correct && s.perks.brainPro && s.rng.next() < 0.6) {
    answer = q.correct;
    confidence = Math.max(confidence, 82);
    note = undefined;
  }
  confidence = clamp(Math.round(confidence + s.rng.range(-3, 3)), 5, 99);
  const L = "ABCD"[answer];
  const opt = q.options[answer];
  const lead =
    confidence >= 85 ? `Easy. The answer is ${L}) ${opt}.` : confidence >= 60 ? `I'm fairly sure it's ${L}) ${opt}.` : `Honestly not sure… maybe ${L}) ${opt}?`;
  return { answer, confidence, text: note ? `${lead} ${note}` : lead, correct: answer === q.correct };
}

// ---------------------------------------------------------------- actions

export function dispatch(s: GameState, a: Action) {
  if (a.type === "intro") {
    if (s.status === "briefing") s.status = "intro";
    return;
  }
  if (a.type === "start") {
    if (s.status === "briefing" || s.status === "intro") s.status = "playing";
    return;
  }
  if (s.status !== "playing") return;
  if (a.type === "pause") {
    s.paused = a.paused;
    return;
  }
  if (s.paused) return;
  const p = s.phone;
  const usable = p.out && !p.dead;

  switch (a.type) {
    case "togglePhone":
      return dispatch(s, { type: "phone", out: !p.out });
    case "phone":
      if (a.out) {
        if (p.dead) return;
        p.out = true;
        s.phoneEverOut = true;
        if (p.locked && s.perks.faceUnlock) {
          p.locked = false;
          p.app = "home";
        }
      } else {
        p.out = false;
        p.focus = 0;
        p.aimOnTarget = false;
      }
      return;
    case "unlock":
      if (usable && p.locked) {
        p.locked = false;
        p.app = "home";
      }
      return;
    case "openApp":
      if (usable && !p.locked) {
        p.app = a.app;
        p.focus = 0;
        if (a.app === "messages") p.unread = 0;
      }
      return;
    case "setting":
      if (usable && !p.locked) p[a.key] = a.value;
      return;
    case "brightness":
      if (usable && !p.locked) p.brightness = a.value;
      return;
    case "aim": {
      const q = clamp(a.question, 0, s.questions.length - 1);
      if (q !== p.aimQuestion) p.focus = 0;
      p.aimQuestion = q;
      p.aimOnTarget = a.onTarget;
      return;
    }
    case "snap":
      if (!usable || p.locked || p.app !== "camera" || p.focus < 1) return;
      p.attachment = p.aimQuestion;
      p.focus = 0;
      emit(s, { kind: "shutter", silent: p.silent });
      if (!p.silent) makeNoise(s, s.playerPos, NOISE.shutter, "Shutter click!", "player");
      return;
    case "send": {
      if (!usable || p.locked || p.attachment === null) return;
      const total = 2.2 + 5.5 * (1 - p.signal) + s.rng.range(0, 1);
      p.requests.push({ id: s.nextId++, question: p.attachment, remaining: total, total });
      p.attachment = null;
      return;
    }
    case "messageAnswer": {
      if (!usable || p.locked || p.app !== "messages") return;
      if (!ANSWER_CONTACTS.includes(a.to) || !Number.isInteger(a.question) || !Number.isInteger(a.option)) return;
      if (a.question < 0 || a.question >= s.questions.length || a.option < 0 || a.option > 3) return;
      p.messages.push({
        id: s.nextId++,
        from: "You",
        to: a.to,
        text: `Q${a.question + 1}: ${"ABCD"[a.option]}) ${s.questions[a.question].options[a.option]}`,
        at: s.time,
        question: a.question,
        answer: a.option,
      });
      return;
    }
    case "answer":
      if (a.question < 0 || a.question >= s.answers.length) return;
      s.answers[a.question] = a.option;
      emit(s, { kind: "answer" });
      return;
    case "look":
      s.headYaw = clamp(a.yaw, -MAX_YAW, MAX_YAW);
      return;
    case "submit":
      finish(s);
      return;
  }
}

// ---------------------------------------------------------------- simulation

function updatePhone(s: GameState, dt: number) {
  const p = s.phone;
  if (p.out && !p.dead) {
    p.timeOut += dt;
    p.hiddenFor = 0;
    const before = p.battery;
    p.battery -= s.level.drain * dt * (p.app === "camera" ? 1.4 : 1) * (p.brightness === "high" ? 1.15 : 0.8);
    if (before > 15 && p.battery <= 15) emit(s, { kind: "battery", level: "low" });
    if (p.battery <= 0) {
      p.battery = 0;
      p.dead = true;
      p.out = false;
      emit(s, { kind: "battery", level: "dead" });
    }
    if (p.app === "camera" && p.aimOnTarget) p.focus = Math.min(1, p.focus + dt / FOCUS_TIME);
    else if (p.focus < 1) p.focus = Math.max(0, p.focus - dt * 1.5);
  } else {
    p.hiddenFor += dt;
    p.focus = 0;
    if (!p.locked && p.hiddenFor >= RELOCK_AFTER && !s.perks.faceUnlock) {
      p.locked = true;
      p.app = "lock";
    }
  }

  // BrainGPT keeps thinking while the phone is in your pocket.
  for (const r of p.requests.slice()) {
    r.remaining -= dt;
    if (r.remaining > 0) continue;
    p.requests.splice(p.requests.indexOf(r), 1);
    if (p.dead) continue;
    p.replies.push({ id: r.id, question: r.question, ...aiReply(s, r.question) });
    emit(s, { kind: "aiReply", question: r.question, audible: p.silent ? "buzz" : "ping" });
    makeNoise(s, s.playerPos, p.silent ? NOISE.softBuzz : NOISE.ping, p.silent ? "bzz" : "Ding!", "player");
  }
}

function updateTeacher(s: GameState, t: Teacher, dt: number) {
  if (t.state === "gone") return;
  if (t.alert.time > 0) {
    t.alert.time -= dt;
    t.lookTarget = t.alert.angle;
    t.facing = turnToward(t.facing, t.lookTarget, 9 * dt);
    return;
  }

  switch (t.state) {
    case "reading":
      t.lookTarget = DOWN;
      t.timer -= dt;
      if (t.timer <= 0) {
        t.state = "glancing";
        t.timer = t.timerTotal = TELEGRAPH + t.glance;
        t.sweepBase = DOWN + s.rng.range(-0.3, 0.3);
      }
      break;
    case "glancing": {
      t.timer -= dt;
      const el = t.timerTotal - t.timer - TELEGRAPH;
      if (el > 0) t.lookTarget = t.sweepBase + Math.sin(el * 1.7) * 0.6;
      if (t.timer <= 0) {
        t.state = "reading";
        t.timer = s.rng.range(t.wait[0], t.wait[1]);
      }
      break;
    }
    case "walking":
      moveAlong(s, t, dt);
      break;
    case "pausing": {
      t.timer -= dt;
      t.lookTarget = t.sweepBase + Math.sin((t.timerTotal - t.timer) * 1.5) * 0.9;
      if (t.timer <= 0) resume(s, t);
      break;
    }
    case "distracted": {
      const g = t.goal;
      const st = g.type === "help" ? s.students[g.student] : undefined;
      if (st) t.lookTarget = angleTo(t.pos, st.pos);
      t.timer -= dt;
      if (t.timer <= 0) {
        if (st) st.hand = 0;
        resume(s, t);
      }
      break;
    }
    case "investigating":
      t.lookTarget = angleTo(t.pos, s.playerPos);
      if (s.phone.out) return caught(s, `${t.name} was standing at your desk and saw the phone in your hand.`);
      t.timer -= dt;
      if (t.timer <= 0) {
        s.suspicion = Math.max(0, s.suspicion - INVESTIGATE_RELIEF);
        s.investigateCooldown = INVESTIGATE_COOLDOWN;
        emit(s, { kind: "cleared", teacher: t.name });
        resume(s, t);
      }
      break;
  }
  t.facing = turnToward(t.facing, t.lookTarget, (t.state === "walking" ? 6 : 3.5) * dt);
}

/** The classmate you're staring at right now (head turned, near the centre of your view), if any. */
export function gazedStudent(s: GameState): Student | null {
  if (Math.abs(s.headYaw) < GAZE_MIN_YAW) return null;
  const view = -Math.PI / 2 + s.headYaw;
  let best: Student | null = null;
  let bestOff = GAZE_CONE;
  for (const st of s.students) {
    if (st.isPlayer || dist(st.pos, s.playerPos) > GAZE_RANGE) continue;
    const off = Math.abs(wrapAngle(angleTo(s.playerPos, st.pos) - view));
    if (off < bestOff) {
      bestOff = off;
      best = st;
    }
  }
  return best;
}

/** Stare at a neighbour and they'll tell you off; keep doing it and they call the teacher. */
function updateGaze(s: GameState, dt: number) {
  const target = gazedStudent(s);
  for (const st of s.students) {
    st.speechCooldown = Math.max(0, st.speechCooldown - dt);
    if (st.speech && s.time > st.speech.at + st.speech.dur) st.speech = null;
    st.gaze = st === target ? st.gaze + dt : Math.max(0, st.gaze - dt * 2);
    if (st.gaze < GAZE_TRIGGER || st.speechCooldown > 0) continue;
    st.gaze = 0;
    st.annoyed++;
    const level = Math.min(3, st.annoyed) as 1 | 2 | 3;
    const text = s.rng.pick(CLASSMATE_LINES[level]);
    st.speech = { text, at: s.time, dur: level === 3 ? 3.2 : 2.6, level };
    st.speechCooldown = 4;
    emit(s, { kind: "classmate", text, level });
    if (level === 2) {
      makeNoise(s, st.pos, 5, "Shh!", "npc");
    } else if (level === 3) {
      // Said out loud: every teacher in earshot turns round, and it's about you.
      makeNoise(s, st.pos, 24, "SIR!", "npc");
      s.suspicion = clamp(s.suspicion + COMPLAINT_PENALTY);
      s.lastSeenAt = s.time;
    }
  }
}

function updateStudents(s: GameState, dt: number) {
  const exposed = phoneExposure(s.phone) > 0;
  updateGaze(s, dt);
  for (const st of s.students) {
    st.phase += dt;
    if (st.hand > 0 && !s.teachers.some((t) => t.goal.type === "help" && t.goal.student === s.students.indexOf(st))) {
      st.hand = Math.max(0, st.hand - dt);
    }
    if (!st.snitch) continue;
    if (st.peek > 0) {
      st.peek -= dt;
      if (exposed) st.snitchMeter += dt;
      if (st.snitchMeter >= SNITCH_TRIGGER) {
        st.snitchMeter = 0;
        st.peek = 0;
        st.peekCooldown = 22;
        st.hand = 4;
        s.suspicion = clamp(s.suspicion + SNITCH_PENALTY);
        emit(s, { kind: "snitch" });
        s.investigateCooldown = 0;
        sendToInvestigate(s, "A classmate raised their hand and pointed at you.");
      }
    } else {
      st.snitchMeter = Math.max(0, st.snitchMeter - dt * 0.4);
      st.peekCooldown -= dt;
      if (st.peekCooldown <= 0) {
        st.peek = 2.2;
        st.peekCooldown = s.rng.range(5, 10);
      }
    }
  }
}

function updateRoomEvents(s: GameState, dt: number) {
  const L = s.level;
  const others = s.students.map((st, i) => ({ st, i })).filter(({ st }) => !st.isPlayer && !st.snitch);

  if (L.distractions && (s.timers.distraction -= dt) <= 0) {
    s.timers.distraction = s.rng.range(L.distractions[0], L.distractions[1]);
    const cand = others.filter(({ st }) => st.hand === 0);
    if (cand.length) {
      const { st, i } = s.rng.pick(cand);
      const t = nearestTeacher(s, st.pos, (x) => x.kind !== "squad" && x.goal.type !== "investigate" && x.goal.type !== "help");
      if (t) {
        st.hand = 8;
        const right = Math.abs(t.pos.x - s.room.laneX[st.seat.c + 1]) < Math.abs(t.pos.x - s.room.laneX[st.seat.c]);
        goTo(s, t, besideSeat(s.room, st.seat, right), { type: "help", student: i });
        emit(s, { kind: "distraction", student: i });
      }
    }
  }

  if (L.sneezes && (s.timers.sneeze -= dt) <= 0) {
    s.timers.sneeze = s.rng.range(L.sneezes[0], L.sneezes[1]);
    if (others.length) makeNoise(s, s.rng.pick(others).st.pos, 20, "Achoo!", "npc");
  }

  if (L.notifications && (s.timers.notification -= dt) <= 0) {
    s.timers.notification = s.rng.range(L.notifications[0], L.notifications[1]);
    const p = s.phone;
    if (!p.dead && !p.dnd) {
      const [from, text] = s.rng.pick(MESSAGES);
      const message = { id: s.nextId++, from, text, at: s.time };
      p.notifications.push(message);
      p.messages.push({ ...message, to: "You" });
      p.unread++;
      emit(s, { kind: "notification", from, text, audible: p.silent ? "buzz" : "ring" });
      makeNoise(s, s.playerPos, p.silent ? NOISE.buzz : NOISE.ring, p.silent ? "Bzzzt" : "♪ Ringtone ♪", "player");
    }
  }

  if (L.squad && !s.squadSpawned && s.time >= L.duration * L.squad.at) {
    s.squadSpawned = true;
    const t = makeTeacher(s, { name: "Flying Squad", kind: "patrol", speed: 1.55, fov: 95, range: 8.5, wait: [0.5, 1.1], route: "snake" }, s.teachers.length);
    t.kind = "squad";
    t.pos = { ...s.room.nodes[s.room.doorNode] };
    t.leaveAt = s.time + L.squad.duration;
    t.routeIndex = 0;
    goTo(s, t, s.room.nodes[t.route[0]], { type: "patrol" });
    s.teachers.push(t);
    emit(s, { kind: "squad" });
  }
}

function updateDetection(s: GameState, dt: number) {
  const phoneOut = phoneExposure(s.phone);
  const craning = Math.abs(s.headYaw) > LOOK_LIMIT;
  // Craning round at other people's papers is mildly suspicious on its own.
  const exposure = phoneOut > 0 ? phoneOut : craning ? LOOK_EXPOSURE : 0;
  let rate = 0;
  let worst = { name: "", rate: 0 };
  for (const t of s.teachers) {
    t.seesPlayer = false;
    if (t.state === "gone" || exposure === 0) continue;
    let r = 0;
    if (coneActive(t)) {
      const hit = coneTest(t.pos, t.facing, t.fov, t.range, s.playerPos);
      if (hit.inside) r = BASE_RATE * exposure * hit.centre * hit.near * s.level.detection;
    }
    if (t.state !== "reading" && dist(t.pos, s.playerPos) < PROXIMITY) r = Math.max(r, PROXIMITY_RATE * exposure);
    if (r > 0) {
      t.seesPlayer = true;
      rate += r;
      if (r > worst.rate) worst = { name: t.name, rate: r };
    }
  }
  for (const c of s.cctv) {
    c.facing = (c.centre + c.sweep * Math.sin((s.time / c.period) * Math.PI * 2)) * DEG;
    c.seesPlayer = false;
    if (exposure === 0) continue;
    const hit = coneTest(c, c.facing, c.fov * DEG, c.range, s.playerPos);
    if (!hit.inside) continue;
    const r = BASE_RATE * CCTV_FACTOR * exposure * hit.centre * hit.near * s.level.detection;
    c.seesPlayer = true;
    rate += r;
    if (r > worst.rate) worst = { name: "The CCTV camera", rate: r };
  }

  s.seenThisTick = rate > 0;
  if (rate > 0) {
    s.suspicion = clamp(s.suspicion + rate * dt);
    s.lastSeenAt = s.time;
    s.everSeen = true;
  } else if (s.time - s.lastSeenAt > DECAY_GRACE) {
    // Nerves only settle once the phone is actually put away.
    s.suspicion = clamp(s.suspicion - (exposure > 0 ? DECAY_RATE * 0.25 : DECAY_RATE) * dt);
  }
  s.maxSuspicion = Math.max(s.maxSuspicion, s.suspicion);

  if (s.suspicion >= CAUGHT_AT) {
    if (phoneOut === 0) caught(s, `${worst.name || "The invigilator"} caught you twisting round to read other people's papers.`);
    else caught(s, worst.name ? `${worst.name} saw you using your phone. That's enough evidence.` : "Too many people noticed your phone.");
  }
}

/** Advance the simulation by `dt` seconds. Mutates `s`. */
export function step(s: GameState, dt: number) {
  // Walking in: the room is alive (classmates writing) but the exam hasn't started.
  if (s.status === "intro") {
    for (const st of s.students) st.phase += dt;
    return;
  }
  if (s.status !== "playing" || s.paused) return;
  s.time += dt;
  s.timeLeft -= dt;
  s.investigateCooldown = Math.max(0, s.investigateCooldown - dt);

  updatePhone(s, dt);
  for (const t of s.teachers) {
    updateTeacher(s, t, dt);
    if (s.status !== "playing") return;
  }
  updateStudents(s, dt);
  updateRoomEvents(s, dt);
  updateDetection(s, dt);
  if (s.status !== "playing") return;

  if (s.suspicion >= SUSPICIOUS_AT && s.investigateCooldown <= 0) sendToInvestigate(s, "Something about you looks off.");
  if (s.timeLeft <= 0) {
    s.timeLeft = 0;
    finish(s);
  }
}

export const FIXED_DT = 1 / 60;
