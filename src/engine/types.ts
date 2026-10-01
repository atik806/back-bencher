import type { Rng } from "./rng";

export type Vec = { x: number; y: number };
export type Option = 0 | 1 | 2 | 3;
export type Difficulty = "easy" | "medium" | "hard" | "absurd";

export interface Question {
  id: string;
  subject: string;
  difficulty: Difficulty;
  prompt: string;
  options: [string, string, string, string];
  correct: Option;
  /** What BrainGPT says. May be wrong on purpose. */
  ai: { answer: Option; confidence: number; note?: string };
}

export type Seat = { c: number; r: number };

export interface Room {
  cols: number;
  rows: number;
  width: number;
  height: number;
  laneX: number[];
  rowY: number[];
  frontY: number;
  backY: number;
  teacherDesk: Vec;
  nodes: Vec[];
  adj: number[][];
  seatNode: number;
  doorNode: number;
}

// ---------------------------------------------------------------- level config

export type RouteKind = "snake" | "snake-reverse" | "perimeter" | "left-half" | "right-half";

export interface TeacherConfig {
  name: string;
  kind: "seated" | "patrol";
  speed: number;
  fov: number; // degrees
  range: number;
  /** seated: seconds between glances. patrol: seconds paused at each stop. */
  wait: [number, number];
  glance?: number; // seated: seconds spent looking up
  route?: RouteKind;
}

export interface CctvConfig {
  x: number;
  y: number;
  /** centre angle in degrees, sweep amplitude in degrees */
  centre: number;
  sweep: number;
  period: number;
  fov: number;
  range: number;
}

export interface LevelConfig {
  id: number;
  name: string;
  subtitle: string;
  briefing: string[];
  newThing: string;
  duration: number;
  questionCount: number;
  difficultyMix: Partial<Record<Difficulty, number>>;
  cols: number;
  rows: number;
  playerSeat: Seat;
  teachers: TeacherConfig[];
  cctv?: CctvConfig[];
  battery: number;
  drain: number;
  signal: number;
  startSilent: boolean;
  startDnd: boolean;
  notifications?: [number, number];
  distractions?: [number, number];
  sneezes?: [number, number];
  snitches?: Seat[];
  aiErrorBoost: number;
  squad?: { at: number; duration: number };
  detection: number;
}

export interface Perks {
  faceUnlock: boolean;
  brainPro: boolean;
}

// ---------------------------------------------------------------- runtime state

export type TeacherState =
  | "reading"
  | "glancing"
  | "walking"
  | "pausing"
  | "distracted"
  | "investigating"
  | "gone";

export type TeacherGoal =
  | { type: "desk" }
  | { type: "patrol" }
  | { type: "investigate" }
  | { type: "help"; student: number }
  | { type: "leave" };

export interface Teacher {
  id: string;
  name: string;
  kind: "seated" | "patrol" | "squad";
  pos: Vec;
  facing: number;
  lookTarget: number;
  state: TeacherState;
  timer: number;
  timerTotal: number;
  goal: TeacherGoal;
  path: Vec[];
  /** Distance travelled in the current walk, used for gait and footfalls. */
  walked: number;
  footfalls: number;
  route: number[];
  routeIndex: number;
  speed: number;
  fov: number; // radians
  range: number;
  wait: [number, number];
  glance: number;
  sweepBase: number;
  /** Turned toward a sound: overrides movement while > 0. */
  alert: { time: number; angle: number };
  /** Seconds the cone has been on the player this frame (for the renderer). */
  seesPlayer: boolean;
  leaveAt?: number;
}

export interface Student {
  seat: Seat;
  pos: Vec;
  isPlayer: boolean;
  snitch: boolean;
  /** seconds left with hand raised */
  hand: number;
  /** snitch: >0 while peeking at the player */
  peek: number;
  peekCooldown: number;
  snitchMeter: number;
  hue: number;
  phase: number;
  /** Seconds the player has been staring at this classmate. */
  gaze: number;
  /** How many times they've caught you looking (escalates their reaction). */
  annoyed: number;
  speechCooldown: number;
  /** What they're saying out loud right now, if anything. */
  speech: { text: string; at: number; dur: number; level: 1 | 2 | 3 } | null;
}

export interface Cctv extends CctvConfig {
  facing: number;
  seesPlayer: boolean;
}

export type PhoneApp = "lock" | "home" | "settings" | "camera" | "brain" | "messages";

export interface AiRequest {
  id: number;
  question: number;
  remaining: number;
  total: number;
}

export interface AiReply {
  id: number;
  question: number;
  answer: Option;
  confidence: number;
  text: string;
  correct: boolean;
}

export interface PhoneNotification {
  id: number;
  from: string;
  text: string;
  at: number;
}

export const ANSWER_CONTACTS = ["Rafi", "Nadia", "Class Group"] as const;
export type AnswerContact = (typeof ANSWER_CONTACTS)[number];

export interface PhoneMessage {
  id: number;
  from: string;
  to: string;
  text: string;
  at: number;
  question?: number;
  answer?: Option;
}

export interface PhoneState {
  out: boolean;
  locked: boolean;
  hiddenFor: number;
  app: PhoneApp;
  silent: boolean;
  dnd: boolean;
  brightness: "low" | "high";
  battery: number;
  dead: boolean;
  signal: number;
  aimOnTarget: boolean;
  aimQuestion: number;
  focus: number;
  attachment: number | null;
  requests: AiRequest[];
  replies: AiReply[];
  notifications: PhoneNotification[];
  messages: PhoneMessage[];
  unread: number;
  timeOut: number;
}

export type GameEvent = { id: number; t: number } & (
  | { kind: "noise"; source: "player" | "npc"; label: string; pos: Vec; loud: number }
  | { kind: "notification"; from: string; text: string; audible: "ring" | "buzz" | "none" }
  | { kind: "aiReply"; question: number; audible: "ping" | "buzz" }
  | { kind: "shutter"; silent: boolean }
  | { kind: "investigate"; teacher: string; reason: string }
  | { kind: "cleared"; teacher: string }
  | { kind: "snitch" }
  | { kind: "classmate"; text: string; level: 1 | 2 | 3 }
  | { kind: "squad" }
  | { kind: "distraction"; student: number }
  | { kind: "battery"; level: "low" | "dead" }
  | { kind: "caught"; reason: string }
  | { kind: "finished" }
  | { kind: "answer" }
  | { kind: "footstep"; teacher: string; pos: Vec; footfall: number }
);

/** Distributes Omit over the event union so each variant keeps its own fields. */
export type NewGameEvent = GameEvent extends infer E ? (E extends GameEvent ? Omit<E, "id" | "t"> : never) : never;

/** briefing → intro (walking to your seat, clock stopped) → playing → caught | finished */
export type Status = "briefing" | "intro" | "playing" | "caught" | "finished";

export interface Result {
  correct: number;
  total: number;
  answered: number;
  percent: number;
  grade: string;
  stars: number;
  caught: boolean;
  caughtReason?: string;
  ghost: boolean;
  honest: boolean;
  aiAnswersUsed: number;
  aiWrongTrusted: number;
  maxSuspicion: number;
  timeLeft: number;
}

export interface GameState {
  level: LevelConfig;
  perks: Perks;
  rng: Rng;
  seed: number;
  room: Room;
  status: Status;
  paused: boolean;
  time: number;
  timeLeft: number;
  teachers: Teacher[];
  students: Student[];
  cctv: Cctv[];
  playerPos: Vec;
  /** Player's head turn relative to facing the board, radians (+ = right). */
  headYaw: number;
  questions: Question[];
  answers: (Option | null)[];
  phone: PhoneState;
  suspicion: number;
  maxSuspicion: number;
  seenThisTick: boolean;
  lastSeenAt: number;
  everSeen: boolean;
  phoneEverOut: boolean;
  investigateCooldown: number;
  timers: { distraction: number; sneeze: number; notification: number };
  squadSpawned: boolean;
  events: GameEvent[];
  eventSeq: number;
  nextId: number;
  caughtReason?: string;
  result?: Result;
}

export type Action =
  | { type: "start" }
  | { type: "intro" }
  | { type: "pause"; paused: boolean }
  | { type: "phone"; out: boolean }
  | { type: "togglePhone" }
  | { type: "unlock" }
  | { type: "openApp"; app: Exclude<PhoneApp, "lock"> }
  | { type: "setting"; key: "silent" | "dnd"; value: boolean }
  | { type: "brightness"; value: "low" | "high" }
  | { type: "aim"; onTarget: boolean; question: number }
  | { type: "snap" }
  | { type: "send" }
  | { type: "messageAnswer"; to: AnswerContact; question: number; option: Option }
  | { type: "answer"; question: number; option: Option | null }
  | { type: "look"; yaw: number }
  | { type: "submit" };
