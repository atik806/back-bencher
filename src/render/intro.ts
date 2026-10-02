import type { GameState, Vec } from "@/engine/types";
import { besideSeat, findPath, nearestNode, STEP_LENGTH } from "@/engine/room";
import { dist, wrapAngle } from "@/engine/geometry";

/** A first-person camera pose (world metres, radians). */
export interface CamPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

export const WALK_SPEED = 1.45;
export { STEP_LENGTH };
export const STAND_EYE = 1.64;
export const SEATED_EYE = 1.34;
export const SIT_TIME = 1.6;
/** Matches pov.ts's room view: sitting back, slight downward tilt. */
const ROOM_PITCH = 0.27;
const SEAT_BACK = 0.45;

export interface IntroPlan {
  path: Vec[];
  lengths: number[];
  total: number;
  walkTime: number;
  duration: number;
  seat: Vec;
  /** Middle of the class: you glance across it as you walk in. */
  look: Vec;
}

/** Door → front aisle → down the lane beside your seat → your chair. */
export function planIntro(s: GameState): IntroPlan {
  const { room } = s;
  const seat = s.playerPos;
  const ps = s.level.playerSeat;
  const door = room.nodes[room.doorNode];
  // Enter on whichever side of your desk is nearer the door.
  const right = Math.abs(room.laneX[ps.c + 1] - door.x) <= Math.abs(room.laneX[ps.c] - door.x);
  const beside = besideSeat(room, ps, right);
  const nodes = findPath(room, room.doorNode, nearestNode(room, beside)).map((i) => room.nodes[i]);
  const path: Vec[] = [{ x: door.x + 0.1, y: door.y }, ...nodes.slice(1), beside, { x: seat.x, y: seat.y + 0.15 }];
  // drop duplicate points
  const clean = path.filter((p, i) => i === 0 || dist(p, path[i - 1]) > 0.05);
  const lengths = clean.slice(1).map((p, i) => dist(clean[i], p));
  const total = lengths.reduce((a, b) => a + b, 0);
  const walkTime = total / WALK_SPEED;
  return { path: clean, lengths, total, walkTime, duration: walkTime + SIT_TIME, seat, look: { x: room.width / 2, y: room.rowY[0] } };
}

function pointAt(plan: IntroPlan, d: number): Vec {
  let left = Math.max(0, Math.min(plan.total, d));
  for (let i = 0; i < plan.lengths.length; i++) {
    const L = plan.lengths[i];
    if (left <= L || i === plan.lengths.length - 1) {
      const a = plan.path[i];
      const b = plan.path[i + 1];
      const t = L > 0 ? Math.min(1, left / L) : 1;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    left -= L;
  }
  return plan.path[plan.path.length - 1];
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Camera pose `t` seconds into the walk-in. */
export function introPose(plan: IntroPlan, t: number): CamPose {
  const facingBoard = -Math.PI / 2;
  if (t < plan.walkTime) {
    const d = t * WALK_SPEED;
    const here = pointAt(plan, d);
    // Look where you're going: a point a little further along the path.
    const ahead = pointAt(plan, d + 1.6);
    const travel = dist(here, ahead) > 0.01 ? Math.atan2(ahead.y - here.y, ahead.x - here.x) : facingBoard;
    // ...but glance across the class (and the teacher) rather than at the wall in front of you.
    const toClass = Math.atan2(plan.look.y - here.y, plan.look.x - here.x);
    let yaw = travel + wrapAngle(toClass - travel) * 0.55;
    // Over the last couple of metres, turn toward the board ready to sit.
    const remain = plan.total - d;
    if (remain < 1.4) yaw = yaw + wrapAngle(facingBoard - yaw) * smooth(1 - remain / 1.4);
    const stepPhase = (d / STEP_LENGTH) * Math.PI * 2;
    return {
      x: here.x + Math.cos(yaw + Math.PI / 2) * Math.sin(stepPhase / 2) * 0.018,
      y: here.y + Math.sin(yaw + Math.PI / 2) * Math.sin(stepPhase / 2) * 0.018,
      z: STAND_EYE + Math.abs(Math.sin(stepPhase / 2)) * 0.03 - 0.015,
      yaw,
      pitch: 0.1 + 0.03 * Math.sin(stepPhase),
    };
  }
  // Sit down: drop to seated eye height, settle back in the chair, look at the desk.
  const k = smooth(Math.min(1, (t - plan.walkTime) / SIT_TIME));
  const end = plan.path[plan.path.length - 1];
  return {
    x: end.x + (plan.seat.x - end.x) * k,
    y: end.y + (plan.seat.y + SEAT_BACK - end.y) * k,
    z: STAND_EYE + (SEATED_EYE - STAND_EYE) * k - Math.sin(k * Math.PI) * 0.06,
    yaw: facingBoard,
    pitch: 0.1 + (ROOM_PITCH - 0.1) * k,
  };
}

/** Distance walked at time t (for footstep sounds). */
export const introDistance = (plan: IntroPlan, t: number) => Math.min(plan.total, t * WALK_SPEED);

/** Count completed footfalls from distance, independent of render frame timing. */
export const introStepIndex = (plan: IntroPlan, t: number) => Math.floor(introDistance(plan, Math.max(0, t)) / STEP_LENGTH + 1e-6);
