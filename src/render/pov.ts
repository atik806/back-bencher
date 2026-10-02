import type { GameState, Student, Teacher, Vec } from "@/engine/types";
import { coneActive, isTelegraphing } from "@/engine/game";
import { wrapAngle } from "@/engine/geometry";
import { DESK_H, DESK_W, STEP_LENGTH, deskPos } from "@/engine/room";
import type { CamPose } from "./intro";
import { drawStudentBack, drawStudentFront, drawStudentSide, drawTeacherFigure, studentLook, TEACHER_LOOKS, type StudentLook, type TeacherPose } from "./characters";

/**
 * First-person view from the player's seat. The engine stays a flat 2D world;
 * this projects it with a simple pinhole camera (floor = z 0, heights in metres-ish).
 */

const EYE = 1.34; // seated eye height (sitting up straight, so you can see over heads)
const NEAR = 0.08;
const WALL_H = 3.2;
const DESK_TOP = 0.74;
/** Slight downward tilt in the room view: the room above, your desk + paper along the bottom. */
const PITCH_ROOM = 0.27;

/** u = height relative to the eye after pitch; f = depth; r = right. */
type P3 = { f: number; r: number; u: number };

interface Cam {
  x: number;
  y: number;
  ez: number;
  yaw: number;
  pitch: number; // + = looking down
  F: number;
  W: number;
  H: number;
  cy: number;
}

/** Yaw-only (horizontal) camera coords, for bearings. */
const flat = (c: Cam, wx: number, wy: number) => {
  const dx = wx - c.x;
  const dy = wy - c.y;
  const cs = Math.cos(c.yaw);
  const sn = Math.sin(c.yaw);
  return { f: dx * cs + dy * sn, r: -dx * sn + dy * cs };
};

const toCam = (c: Cam, wx: number, wy: number, z = 0): P3 => {
  const { f: f0, r } = flat(c, wx, wy);
  const u0 = z - c.ez;
  const cp = Math.cos(c.pitch);
  const sp = Math.sin(c.pitch);
  return { f: f0 * cp - u0 * sp, r, u: u0 * cp + f0 * sp };
};

const proj = (c: Cam, p: P3) => ({ x: c.W / 2 + (p.r / p.f) * c.F, y: c.cy - (p.u / p.f) * c.F });

/** Clip a camera-space polygon against the near plane (Sutherland–Hodgman, one plane). */
function clipNear(pts: P3[]): P3[] {
  const out: P3[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const ain = a.f >= NEAR;
    const bin = b.f >= NEAR;
    if (ain) out.push(a);
    if (ain !== bin) {
      const t = (NEAR - a.f) / (b.f - a.f);
      out.push({ f: NEAR, r: a.r + (b.r - a.r) * t, u: a.u + (b.u - a.u) * t });
    }
  }
  return out;
}

function poly(ctx: CanvasRenderingContext2D, c: Cam, world: [number, number, number][], fill: string, stroke?: string) {
  const pts = clipNear(world.map(([x, y, z]) => toCam(c, x, y, z)));
  if (pts.length < 3) return;
  ctx.beginPath();
  pts.forEach((p, i) => {
    const s = proj(c, p);
    if (i) ctx.lineTo(s.x, s.y);
    else ctx.moveTo(s.x, s.y);
  });
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function line(ctx: CanvasRenderingContext2D, c: Cam, a: [number, number, number], b: [number, number, number]) {
  let p = toCam(c, a[0], a[1], a[2]);
  let q = toCam(c, b[0], b[1], b[2]);
  if (p.f < NEAR && q.f < NEAR) return;
  if (p.f < NEAR || q.f < NEAR) {
    const t = (NEAR - p.f) / (q.f - p.f);
    const m = { f: NEAR, r: p.r + (q.r - p.r) * t, u: p.u + (q.u - p.u) * t };
    if (p.f < NEAR) p = m;
    else q = m;
  }
  const s = proj(c, p);
  const e = proj(c, q);
  ctx.beginPath();
  ctx.moveTo(s.x, s.y);
  ctx.lineTo(e.x, e.y);
  ctx.stroke();
}

export interface PovOptions {
  yaw: number;
  /** 0 = looking at the room, 1 = looking down at your paper */
  look?: number;
  /** 0 = seated upright, 1 = ducked below your desk with the phone. */
  duck?: number;
  /** Scripted camera (the walk-in intro). Overrides the seated camera. */
  pose?: CamPose | null;
  demo?: boolean;
}

/** Screen-space corners of your question paper: far-left, far-right, near-right, near-left. */
export type Quad = [number, number][];

// Your paper on your desk, in metres relative to the desk centre (x right, y toward you).
export const PAPER = { cx: -0.1, cy: 0.04, w: 0.36, d: 0.44, tilt: -0.02 };

function paperCorners(desk: Vec): [number, number][] {
  const { cx, cy, w, d, tilt } = PAPER;
  const cs = Math.cos(tilt);
  const sn = Math.sin(tilt);
  return (
    [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
      [w / 2, d / 2],
      [-w / 2, d / 2],
    ] as [number, number][]
  ).map(([x, y]) => [desk.x + cx + x * cs - y * sn, desk.y + cy + x * sn + y * cs]);
}

/** Draws the view and returns where your paper landed on screen (for the DOM overlay). */
export function drawPov(ctx: CanvasRenderingContext2D, s: GameState, W: number, H: number, opts: PovOptions): Quad | null {
  const look = Math.max(0, Math.min(1, opts.look ?? 0));
  const ease = look * look * (3 - 2 * look);
  const duck = Math.max(0, Math.min(1, opts.duck ?? 0));
  const crouch = duck * duck * (3 - 2 * duck);
  const myDesk = deskPos(s.room, s.level.playerSeat);
  // Eye: sit up for the room, lean in over the desk to read.
  const bob = opts.demo ? 0 : Math.sin(s.time * 1.4) * 0.004;
  // Lean over the paper (sideways too) so you look down on it squarely, not at an angle.
  const ex = s.playerPos.x + (myDesk.x + PAPER.cx - s.playerPos.x) * ease;
  // Room view: sitting back in the chair so your whole desk is in front of you at the bottom of the screen.
  const ey = s.playerPos.y + 0.45 - ease * 0.8;
  const ez = EYE - ease * 0.12 + bob;
  // Looking down aims straight at the paper and zooms so it fills the screen on any device.
  const pcx = myDesk.x + PAPER.cx;
  const pcy = myDesk.y + PAPER.cy;
  const horiz = Math.hypot(pcx - ex, pcy - ey);
  const vert = ez - DESK_TOP;
  const yawRoom = -Math.PI / 2 + opts.yaw;
  const pitchDown = Math.atan2(vert, horiz);
  const distP = Math.hypot(horiz, vert);
  const fRoom = Math.max(W / 2 / Math.tan((45 * Math.PI) / 180), H / 2 / Math.tan((34 * Math.PI) / 180));
  const fDown = Math.min((0.9 * W * distP) / PAPER.w, (0.84 * H * distP) / (PAPER.d * Math.sin(pitchDown)));
  const paperYaw = yawRoom + wrapAngle(-Math.PI / 2 - yawRoom) * ease;
  const paperPitch = PITCH_ROOM + (pitchDown - PITCH_ROOM) * ease;
  const paperFocal = fRoom + (fDown - fRoom) * ease;
  const c: Cam = {
    x: ex + (myDesk.x - ex) * crouch,
    y: ey + (myDesk.y + 0.4 - ey) * crouch,
    ez: ez + (0.53 - ez) * crouch,
    yaw: paperYaw + wrapAngle(yawRoom - paperYaw) * crouch,
    pitch: paperPitch + (-0.1 - paperPitch) * crouch,
    F: paperFocal + (fRoom * 0.86 - paperFocal) * crouch,
    W,
    H,
    cy: H * 0.5,
  };
  if (opts.pose) {
    c.x = opts.pose.x;
    c.y = opts.pose.y;
    c.ez = opts.pose.z;
    c.yaw = opts.pose.yaw;
    c.pitch = opts.pose.pitch;
    c.F = fRoom;
  }

  // ceiling
  ctx.fillStyle = "#e9e4d8";
  ctx.fillRect(0, 0, W, H);

  drawRoomShell(ctx, s, c);
  drawFloorCones(ctx, s, c);
  drawNoiseRings(ctx, s, c);

  // Everything solid, painter's order (far → near).
  type D = { d: number; draw: () => void };
  const items: D[] = [];
  // Sort by true distance, not forward depth: when looking sideways a desk and its student
  // have almost the same forward depth and would otherwise swap order.
  const depth = (p: Vec) => {
    const q = flat(c, p.x, p.y);
    return Math.hypot(q.f, q.r) * (q.f > -0.3 ? 1 : -1);
  };
  const ps = s.level.playerSeat;

  const td = s.room.teacherDesk;
  items.push({ d: depth(td), draw: () => box(ctx, c, td.x, td.y, 2.7, 0.84, 0, 0.8, "#6e4526", "#845532", "#5a371d") });
  for (const st of s.students) {
    const mine = st.seat.c === ps.c && st.seat.r === ps.r;
    const dp = deskPos(s.room, st.seat);
    if (mine) {
      if (!opts.demo) items.push({ d: 0.001, draw: () => drawOwnDesk(ctx, c, dp) });
      continue;
    }
    items.push({ d: depth(dp), draw: () => drawDesk(ctx, c, dp) });
    if (!st.isPlayer) items.push({ d: depth(st.pos) - 0.01, draw: () => drawStudent(ctx, c, s, st) });
  }
  for (const t of s.teachers) if (t.state !== "gone") items.push({ d: depth(t.pos), draw: () => drawTeacher(ctx, c, s, t) });
  for (const cam of s.cctv) items.push({ d: depth(cam), draw: () => drawCctv(ctx, c, s, cam) });

  items.sort((a, b) => b.d - a.d);
  for (const it of items) if (it.d > 0) it.draw();

  if (crouch > 0) {
    ctx.fillStyle = `rgba(10, 13, 20, ${0.28 * crouch})`;
    ctx.fillRect(0, 0, W, H);
  }

  drawNoiseLabels(ctx, s, c);
  if (opts.demo) return null;
  if (!opts.pose) {
    drawEdgeArrows(ctx, s, c);
    drawVignette(ctx, s, W, H);
  }

  const quad = paperCorners(myDesk).map(([x, y]) => toCam(c, x, y, DESK_TOP + 0.003));
  if (c.ez < DESK_TOP || quad.some((q) => q.f < NEAR)) return null;
  return quad.map((q) => {
    const p = proj(c, q);
    return [p.x, p.y] as [number, number];
  });
}

/** Your own desk: big, close, with a pencil and eraser. The paper itself is a DOM overlay. */
function drawOwnDesk(ctx: CanvasRenderingContext2D, c: Cam, p: Vec) {
  ctx.strokeStyle = "#3a2c20";
  ctx.lineWidth = 6;
  for (const [dx, dy] of [
    [-0.6, -0.26],
    [0.6, -0.26],
  ]) line(ctx, c, [p.x + dx, p.y + dy, 0], [p.x + dx, p.y + dy, DESK_TOP]);
  box(ctx, c, p.x, p.y, DESK_W, DESK_H, DESK_TOP - 0.05, DESK_TOP, "#a9814f", "#d8b57d", "#8f6a3e");
  if (c.ez < DESK_TOP) return;
  // wood grain
  ctx.strokeStyle = "rgba(120,80,40,0.18)";
  ctx.lineWidth = 1.5;
  for (let i = -5; i <= 5; i++) line(ctx, c, [p.x + i * 0.12, p.y - DESK_H / 2, DESK_TOP + 0.001], [p.x + i * 0.12 + 0.02, p.y + DESK_H / 2, DESK_TOP + 0.001]);
  // soft shadow where the paper sits
  const pc = paperCorners(p).map(([x, y]) => [x + 0.008, y + 0.01, DESK_TOP + 0.001] as [number, number, number]);
  poly(ctx, c, pc, "rgba(60,35,15,0.25)");
  // pencil + eraser to the right of the paper
  const z = DESK_TOP + 0.006;
  poly(ctx, c, [[p.x + 0.2, p.y - 0.12, z], [p.x + 0.215, p.y - 0.125, z], [p.x + 0.29, p.y + 0.16, z], [p.x + 0.275, p.y + 0.165, z]], "#f2b81b");
  poly(ctx, c, [[p.x + 0.275, p.y + 0.165, z], [p.x + 0.29, p.y + 0.16, z], [p.x + 0.293, p.y + 0.19, z]], "#e7c9a0");
  poly(ctx, c, [[p.x + 0.3, p.y - 0.2, z], [p.x + 0.36, p.y - 0.2, z], [p.x + 0.36, p.y - 0.17, z], [p.x + 0.3, p.y - 0.17, z]], "#f3a6b8");
  poly(ctx, c, [[p.x + 0.36, p.y - 0.2, z], [p.x + 0.4, p.y - 0.2, z], [p.x + 0.4, p.y - 0.17, z], [p.x + 0.36, p.y - 0.17, z]], "#3c6fd6");
}

// ---------------------------------------------------------------- room

function drawRoomShell(ctx: CanvasRenderingContext2D, s: GameState, c: Cam) {
  const { width: W, height: H } = s.room;
  // floor
  poly(ctx, c, [
    [0, 0, 0],
    [W, 0, 0],
    [W, H, 0],
    [0, H, 0],
  ], "#b98d5c");
  ctx.strokeStyle = "rgba(80,48,20,0.22)";
  ctx.lineWidth = 1;
  for (let x = 0.6; x < W; x += 0.6) line(ctx, c, [x, 0, 0], [x, H, 0]);
  for (let y = 1.1; y < H; y += 1.65) line(ctx, c, [0, y, 0], [W, y, 0]);

  // walls (inside of a convex box never overlap each other)
  const wall = "#d9cfb8";
  poly(ctx, c, [[0, 0, 0], [W, 0, 0], [W, 0, WALL_H], [0, 0, WALL_H]], "#dcd2bb");
  poly(ctx, c, [[0, 0, 0], [0, H, 0], [0, H, WALL_H], [0, 0, WALL_H]], wall);
  poly(ctx, c, [[W, 0, 0], [W, H, 0], [W, H, WALL_H], [W, 0, WALL_H]], "#d3c8b0");
  poly(ctx, c, [[0, H, 0], [W, H, 0], [W, H, WALL_H], [0, H, WALL_H]], "#cfc4ab");
  // skirting boards
  const skirt = "#7a5634";
  poly(ctx, c, [[0, 0.01, 0], [W, 0.01, 0], [W, 0.01, 0.14], [0, 0.01, 0.14]], skirt);
  poly(ctx, c, [[0.01, 0, 0], [0.01, H, 0], [0.01, H, 0.14], [0.01, 0, 0.14]], skirt);
  poly(ctx, c, [[W - 0.01, 0, 0], [W - 0.01, H, 0], [W - 0.01, H, 0.14], [W - 0.01, 0, 0.14]], skirt);
  poly(ctx, c, [[0, H - 0.01, 0], [W, H - 0.01, 0], [W, H - 0.01, 0.14], [0, H - 0.01, 0.14]], skirt);

  // windows along the left wall
  for (let y = 2.2; y < H - 1; y += 3.2) {
    poly(ctx, c, [[0.02, y, 1.1], [0.02, y + 1.9, 1.1], [0.02, y + 1.9, 2.55], [0.02, y, 2.55]], "#f4f1ea");
    poly(ctx, c, [[0.03, y + 0.08, 1.18], [0.03, y + 1.82, 1.18], [0.03, y + 1.82, 2.47], [0.03, y + 0.08, 2.47]], "#a9d4ef");
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 2;
    line(ctx, c, [0.04, y + 0.95, 1.18], [0.04, y + 0.95, 2.47]);
  }

  // blackboard
  const bx = W * 0.18;
  const bw = W * 0.64;
  poly(ctx, c, [[bx - 0.1, 0.02, 1.0], [bx + bw + 0.1, 0.02, 1.0], [bx + bw + 0.1, 0.02, 2.45], [bx - 0.1, 0.02, 2.45]], "#6b4a2b");
  poly(ctx, c, [[bx, 0.03, 1.08], [bx + bw, 0.03, 1.08], [bx + bw, 0.03, 2.37], [bx, 0.03, 2.37]], "#2e4a3a");
  // University crest on the left of the board, drawn in perspective (affine from 3 projected corners).
  const logoH = 0.95;
  const logoW = logoH * (142 / 106);
  const lx = bx + 0.25;
  if (boardLogo?.complete && boardLogo.naturalWidth) {
    const tl = toCam(c, lx, 0.035, 1.25 + logoH);
    const tr = toCam(c, lx + logoW, 0.035, 1.25 + logoH);
    const bl = toCam(c, lx, 0.035, 1.25);
    if (tl.f > NEAR && tr.f > NEAR && bl.f > NEAR) {
      const p0 = proj(c, tl);
      const p1 = proj(c, tr);
      const p3 = proj(c, bl);
      const iw = boardLogo.naturalWidth;
      const ih = boardLogo.naturalHeight;
      ctx.save();
      ctx.transform((p1.x - p0.x) / iw, (p1.y - p0.y) / iw, (p3.x - p0.x) / ih, (p3.y - p0.y) / ih, p0.x, p0.y);
      ctx.drawImage(boardLogo, 0, 0);
      ctx.restore();
    }
  }

  // Chalk lettering, centred in the space to the right of the crest.
  const chalk = (text: string, z: number, size: number, weight = 700) => {
    const q = toCam(c, (lx + logoW + bx + bw) / 2, 0.04, z);
    if (q.f <= NEAR) return;
    const pt = proj(c, q);
    const k = c.F / q.f;
    ctx.font = `${weight} ${Math.max(7, size * k)}px ${handFamily()}`;
    ctx.fillText(text, pt.x, pt.y);
  };
  ctx.fillStyle = "rgba(240,240,230,0.88)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  chalk("American International University-Bangladesh", 2.14, 0.24);
  ctx.fillStyle = "rgba(255,236,160,0.9)";
  chalk(s.level.name.toUpperCase(), 1.76, 0.32);
  ctx.fillStyle = "rgba(240,240,230,0.82)";
  chalk("NO PHONES!  Eyes on your own paper.", 1.38, 0.22);

  // clock on the front wall
  const cl = toCam(c, W - 1.3, 0.04, 2.5);
  if (cl.f > NEAR) {
    const p = proj(c, cl);
    const k = c.F / cl.f;
    const r = 0.3 * k;
    ctx.fillStyle = "#fbf6ea";
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#3a2a1e";
    ctx.lineWidth = Math.max(1, 0.03 * k);
    ctx.stroke();
    const frac = 1 - s.timeLeft / s.level.duration;
    for (const [a, len, col] of [
      [frac * Math.PI * 2, 0.8, "#b3261e"],
      [frac * Math.PI * 0.5, 0.55, "#3a2a1e"],
    ] as const) {
      ctx.strokeStyle = col;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.sin(a) * r * len, p.y - Math.cos(a) * r * len);
      ctx.stroke();
    }
  }

  // door on the right wall, near the front
  const fy = s.room.frontY;
  poly(ctx, c, [[W - 0.02, fy - 0.6, 0], [W - 0.02, fy + 0.6, 0], [W - 0.02, fy + 0.6, 2.15], [W - 0.02, fy - 0.6, 2.15]], "#8a5a32", "#5a371d");
}

let handFont = "cursive";
let boardLogo: HTMLImageElement | null = null;
/** The university crest shown on the blackboard (loaded once by the page). */
export const setBoardLogo = (img: HTMLImageElement) => {
  boardLogo = img;
};
export const setPovHandFont = (f: string) => {
  if (f.trim()) handFont = f;
};
const handFamily = () => handFont;

function box(ctx: CanvasRenderingContext2D, c: Cam, cx: number, cy: number, w: number, d: number, z0: number, h: number, side: string, top: string, dark: string) {
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const y0 = cy - d / 2;
  const y1 = cy + d / 2;
  const faces: { n: Vec; p: Vec; pts: [number, number, number][]; col: string }[] = [
    { n: { x: 0, y: 1 }, p: { x: cx, y: y1 }, pts: [[x0, y1, z0], [x1, y1, z0], [x1, y1, h], [x0, y1, h]], col: side },
    { n: { x: 0, y: -1 }, p: { x: cx, y: y0 }, pts: [[x0, y0, z0], [x1, y0, z0], [x1, y0, h], [x0, y0, h]], col: side },
    { n: { x: -1, y: 0 }, p: { x: x0, y: cy }, pts: [[x0, y0, z0], [x0, y1, z0], [x0, y1, h], [x0, y0, h]], col: dark },
    { n: { x: 1, y: 0 }, p: { x: x1, y: cy }, pts: [[x1, y0, z0], [x1, y1, z0], [x1, y1, h], [x1, y0, h]], col: dark },
  ];
  for (const f of faces) if (f.n.x * (c.x - f.p.x) + f.n.y * (c.y - f.p.y) > 0) poly(ctx, c, f.pts, f.col);
  if (c.ez >= h) poly(ctx, c, [[x0, y0, h], [x1, y0, h], [x1, y1, h], [x0, y1, h]], top);
  else if (c.ez <= z0) poly(ctx, c, [[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]], dark);
}

function drawDesk(ctx: CanvasRenderingContext2D, c: Cam, p: Vec) {
  // legs
  ctx.strokeStyle = "#4a3a2c";
  ctx.lineWidth = 2;
  for (const [dx, dy] of [
    [-0.6, -0.26],
    [0.6, -0.26],
    [-0.6, 0.26],
    [0.6, 0.26],
  ]) line(ctx, c, [p.x + dx, p.y + dy, 0], [p.x + dx, p.y + dy, DESK_TOP]);
  box(ctx, c, p.x, p.y, DESK_W, DESK_H, DESK_TOP - 0.05, DESK_TOP, "#a9814f", "#dcbc86", "#8f6a3e");
  // exam paper on it
  if (c.ez >= DESK_TOP) poly(ctx, c, [[p.x - 0.3, p.y - 0.18, DESK_TOP + 0.002], [p.x + 0.12, p.y - 0.2, DESK_TOP + 0.002], [p.x + 0.14, p.y + 0.18, DESK_TOP + 0.002], [p.x - 0.28, p.y + 0.2, DESK_TOP + 0.002]], "#fffdf6");
}

// ---------------------------------------------------------------- people

/** Screen anchor + pixels-per-metre for a billboard standing at (x,y). */
function anchor(c: Cam, p: Vec) {
  const q = toCam(c, p.x, p.y, 0);
  if (q.f < NEAR) return null;
  const k = c.F / q.f;
  const base = proj(c, q);
  const top = toCam(c, p.x, p.y, 1);
  // vertical pixels per metre (shrinks when looking down)
  const kv = top.f > NEAR ? Math.max(k * 0.3, base.y - proj(c, top).y) : k;
  return { x: base.x, y: base.y, k, at: (z: number) => base.y - z * kv };
}

function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2);
  ctx.fill();
}

const looks = new WeakMap<Student, StudentLook>();
const lookFor = (st: Student) => {
  let l = looks.get(st);
  if (!l) {
    l = studentLook(st.hue * 7 + st.seat.c * 31 + st.seat.r * 131);
    looks.set(st, l);
  }
  return l;
};

function drawStudent(ctx: CanvasRenderingContext2D, c: Cam, s: GameState, st: Student) {
  const a = anchor(c, st.pos);
  if (!a) return;
  const { k, x } = a;
  // Snitches peeking, and anyone telling you off, turn round to face you.
  const peeking = (st.snitch && st.peek > 0) || !!st.speech;
  const pose = { phase: st.phase, peek: peeking, hand: st.hand > 0 };
  const L = lookFor(st);
  // Students face the board (-y). Pick back / side / front from where we're looking at them.
  const vx = st.pos.x - c.x;
  const vy = st.pos.y - c.y;
  const along = -vy / (Math.hypot(vx, vy) || 1); // 1 = we're behind them, -1 = in front
  if (peeking || st.hand > 0 || along > 0.55) drawStudentBack(ctx, x, a.y, k, L, pose);
  else if (along < -0.8) drawStudentFront(ctx, x, a.y, k, L, pose);
  else {
    const ahead = toCam(c, st.pos.x, st.pos.y - 1, 0);
    const here = toCam(c, st.pos.x, st.pos.y, 0);
    const d = ahead.f > NEAR && here.f > NEAR ? Math.sign(proj(c, ahead).x - proj(c, here).x) || 1 : 1;
    drawStudentSide(ctx, x, a.y, k, L, pose, d);
  }
  if (st.speech) speechBubble(ctx, x, a.at(1.42), st.speech.text, st.speech.level, s.time - st.speech.at);
  else if (peeking) bubble(ctx, x, a.at(1.5), "👀", k, st.snitchMeter > 0 ? "#ffd6d6" : "#fff");
  if (st.hand > 0) bubble(ctx, x + 0.22 * k, a.at(1.85), "✋", k);
  if (st.snitch) nameTag(ctx, x, a.at(0.3), "SNITCH", k, "rgba(190,30,30,0.92)");
}

/** Comic speech bubble above a classmate's head. Fixed on-screen size so it's always readable. */
function speechBubble(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, level: 1 | 2 | 3, age: number) {
  const pop = Math.min(1, age / 0.15);
  const size = level === 3 ? 17 : 15;
  ctx.save();
  ctx.font = `${level === 3 ? 800 : 700} ${size}px system-ui, sans-serif`;
  const w = Math.min(320, ctx.measureText(text).width + 26);
  const h = size + 18;
  const bx = Math.max(8, Math.min(ctx.canvas.clientWidth - w - 8, x - w / 2));
  const by = y - h - 14;
  ctx.globalAlpha = pop;
  ctx.translate(x, y);
  ctx.scale(0.85 + 0.15 * pop, 0.85 + 0.15 * pop);
  ctx.translate(-x, -y);
  const fill = level === 3 ? "#ff453a" : level === 2 ? "#ffe08a" : "#ffffff";
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.roundRect(bx + 3, by + 4, w, h, 12);
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(bx, by, w, h, 12);
  ctx.fill();
  // tail pointing at the speaker
  ctx.beginPath();
  ctx.moveTo(x - 8, by + h - 1);
  ctx.lineTo(x + 8, by + h - 1);
  ctx.lineTo(x, y - 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = level === 3 ? "#fff" : "#1d2433";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, bx + w / 2, by + h / 2 + 1, w - 16);
  ctx.restore();
}

function nameTag(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, k: number, bg = "rgba(15,18,24,0.72)") {
  const size = Math.max(9, Math.min(15, 0.085 * k));
  ctx.font = `700 ${size}px system-ui, sans-serif`;
  const w = ctx.measureText(text).width + size;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - size * 0.75, w, size * 1.5, size * 0.75);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y + 0.5);
}

function teacherPose(t: Teacher): TeacherPose {
  if (t.state === "reading") return t.alert.time > 0 ? "seated-look" : "seated-read";
  if (t.state === "glancing") return isTelegraphing(t) ? "seated-read" : "seated-look";
  if (t.state === "walking") return "walk";
  if (t.state === "investigating") return "hands-hips";
  if (t.state === "distracted") return "help";
  return "stand";
}

function drawTeacher(ctx: CanvasRenderingContext2D, c: Cam, s: GameState, t: Teacher) {
  const a = anchor(c, t.pos);
  if (!a) return;
  const { k, x } = a;
  const look = TEACHER_LOOKS[t.name] ?? TEACHER_LOOKS["Dr. Stern"];
  const toCamAngle = Math.atan2(c.y - t.pos.y, c.x - t.pos.x);
  const diff = wrapAngle(t.facing - toCamAngle);
  const pose = teacherPose(t);
  const seed = t.id.charCodeAt(1) * 1.7;
  drawTeacherFigure(ctx, x, a.y, k, look, {
    pose,
    front: Math.abs(diff) < Math.PI / 2,
    turn: Math.max(-1, Math.min(1, Math.sin(diff))),
    walkPhase: (t.walked / STEP_LENGTH) * Math.PI,
    seesPlayer: t.seesPlayer,
    angry: t.seesPlayer || t.goal.type === "investigate",
    blink: Math.sin(s.time * 0.9 + seed) > 0.985,
  });

  const seated = pose === "seated-read" || pose === "seated-look";
  const top = seated ? 1.82 : 2.05;
  let mark: string | null = null;
  let tone = "#fff";
  if (t.goal.type === "investigate" || t.state === "investigating") {
    mark = "❗";
    tone = "#ffd0cc";
  } else if (isTelegraphing(t)) {
    mark = "❗";
    tone = "#fff1b8";
  } else if (t.alert.time > 0) mark = "❓";
  if (mark) bubble(ctx, x, a.at(top + 0.12), mark, k, tone, isTelegraphing(t) ? 1 + 0.15 * Math.sin(s.time * 20) : 1);
  nameTag(ctx, x, a.at(top - 0.1), t.name, k);
}

function drawCctv(ctx: CanvasRenderingContext2D, c: Cam, s: GameState, cam: { x: number; y: number }) {
  const q = toCam(c, cam.x, cam.y, 2.85);
  if (q.f < NEAR) return;
  const p = proj(c, q);
  const k = c.F / q.f;
  disc(ctx, p.x, p.y, 0.16 * k, "#2a2d34");
  disc(ctx, p.x, p.y + 0.05 * k, 0.1 * k, "#11131a");
  disc(ctx, p.x, p.y - 0.06 * k, 0.035 * k, Math.sin(s.time * 6) > 0 ? "#ff3b30" : "#5a1410");
}

// ---------------------------------------------------------------- floor overlays

function fan(origin: Vec, facing: number, fov: number, range: number, z = 0.01): [number, number, number][] {
  const pts: [number, number, number][] = [[origin.x, origin.y, z]];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const a = facing - fov / 2 + (fov * i) / n;
    pts.push([origin.x + Math.cos(a) * range, origin.y + Math.sin(a) * range, z]);
  }
  return pts;
}

/** Where each teacher is looking, as a glow on the floor. The POV equivalent of a vision cone. */
function drawFloorCones(ctx: CanvasRenderingContext2D, s: GameState, c: Cam) {
  ctx.save();
  // keep cones inside the room
  for (const t of s.teachers) {
    if (!coneActive(t)) continue;
    const hostile = t.goal.type === "investigate";
    const col = t.seesPlayer ? "rgba(255,50,40,0.34)" : hostile ? "rgba(255,140,40,0.26)" : t.alert.time > 0 ? "rgba(255,190,60,0.24)" : "rgba(255,240,150,0.22)";
    poly(ctx, c, fan(t.pos, t.facing, t.fov, Math.min(t.range, 9)), col);
  }
  for (const cam of s.cctv) {
    poly(ctx, c, fan(cam, cam.facing, (cam.fov * Math.PI) / 180, cam.range), cam.seesPlayer ? "rgba(255,50,40,0.3)" : "rgba(120,200,255,0.18)");
  }
  ctx.restore();
}

function drawNoiseRings(ctx: CanvasRenderingContext2D, s: GameState, c: Cam) {
  for (const e of s.events) {
    if (e.kind !== "noise" || e.loud <= 0) continue;
    const age = s.time - e.t;
    if (age > 1.2 || age < 0) continue;
    const r = 0.3 + age * (1.5 + e.loud / 10);
    ctx.strokeStyle = e.source === "player" ? `rgba(255,60,40,${1 - age / 1.2})` : `rgba(255,255,255,${0.8 - age / 1.5})`;
    ctx.lineWidth = 3;
    const pts: P3[] = [];
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      pts.push(toCam(c, e.pos.x + Math.cos(a) * r, e.pos.y + Math.sin(a) * r, 0.02));
    }
    ctx.beginPath();
    let pen = false;
    for (const p of pts) {
      if (p.f < NEAR) {
        pen = false;
        continue;
      }
      const q = proj(c, p);
      if (pen) ctx.lineTo(q.x, q.y);
      else ctx.moveTo(q.x, q.y);
      pen = true;
    }
    ctx.stroke();
  }
}

function drawNoiseLabels(ctx: CanvasRenderingContext2D, s: GameState, c: Cam) {
  for (const e of s.events) {
    if (e.kind !== "noise" || e.loud <= 0) continue;
    const age = s.time - e.t;
    if (age > 1.2 || age < 0) continue;
    // Your own noises float up from the bottom of the screen.
    let x: number;
    let y: number;
    let size: number;
    if (e.source === "player") {
      x = c.W / 2;
      y = c.H * 0.85 - age * 40;
      size = 30;
    } else {
      const q = toCam(c, e.pos.x, e.pos.y, 1.8 + age * 0.3);
      if (q.f < NEAR) continue;
      const p = proj(c, q);
      x = p.x;
      y = p.y;
      size = Math.max(12, (0.28 * c.F) / q.f);
    }
    ctx.font = `900 ${size}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 4;
    ctx.strokeStyle = `rgba(0,0,0,${0.7 - age / 2})`;
    ctx.strokeText(e.label, x, y);
    ctx.fillStyle = e.source === "player" ? `rgba(255,90,70,${1 - age / 1.2})` : `rgba(255,255,255,${1 - age / 1.2})`;
    ctx.fillText(e.label, x, y);
  }
}

/** Markers on the screen edge for teachers you can't currently see (incl. above you when looking down). */
function drawEdgeArrows(ctx: CanvasRenderingContext2D, s: GameState, c: Cam) {
  const m = 46;
  for (const t of s.teachers) {
    if (t.state === "gone") continue;
    const head = toCam(c, t.pos.x, t.pos.y, 1.6);
    const fl = flat(c, t.pos.x, t.pos.y);
    let x: number;
    let y: number;
    let arrow: string;
    if (head.f > NEAR) {
      const p = proj(c, head);
      if (p.x > m && p.x < c.W - m && p.y > m && p.y < c.H - m) continue;
      x = Math.max(m + 46, Math.min(c.W - m - 46, p.x));
      y = Math.max(m, Math.min(c.H * 0.8, p.y));
      arrow = p.y < m && p.x > m && p.x < c.W - m ? "↑" : p.x <= m ? "←" : p.x >= c.W - m ? "→" : "↑";
    } else {
      const right = fl.r > 0;
      x = right ? c.W - m - 46 : m + 46;
      y = c.H * 0.8;
      arrow = right ? "↘" : "↙";
    }
    const dist = Math.hypot(fl.f, fl.r);
    const danger = t.seesPlayer || t.goal.type === "investigate";
    const looking = coneActive(t) || isTelegraphing(t);
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = danger ? "rgba(255,59,48,0.95)" : looking ? "rgba(255,183,3,0.92)" : "rgba(20,20,24,0.75)";
    ctx.beginPath();
    ctx.roundRect(-34, -24, 68, 48, 10);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "700 20px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(isTelegraphing(t) ? "❗" : arrow, 0, -8);
    ctx.font = "700 10px system-ui, sans-serif";
    ctx.fillText(`${t.name.split(" ").pop()} ${dist.toFixed(0)}m`, 0, 12);
    ctx.restore();
  }
}

function drawVignette(ctx: CanvasRenderingContext2D, s: GameState, W: number, H: number) {
  const v = s.suspicion / 100;
  const flash = s.seenThisTick ? 0.25 + 0.15 * Math.sin(s.time * 18) : 0;
  const a = Math.min(0.75, v * 0.55 + flash);
  if (a <= 0.01) return;
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, "rgba(255,0,0,0)");
  g.addColorStop(1, `rgba(200,0,0,${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function bubble(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, k: number, bg = "#ffffff", scale = 1) {
  const r = Math.max(9, 0.15 * k) * scale;
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.arc(x + 2, y + 2, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `${r * 1.15}px system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#111";
  ctx.fillText(text, x, y + 1);
}
