import type { GameState, Teacher, Student, Vec } from "@/engine/types";
import { coneActive, isTelegraphing, phoneExposure } from "@/engine/game";
import { DESK_H, DESK_W, STEP_LENGTH, deskPos } from "@/engine/room";

const TEACHER_COLORS: Record<string, string> = {
  "Mr. Dozy": "#7a4b2a",
  "Ms. Hawk": "#6b3fa0",
  "Dr. Stern": "#33363d",
  "Flying Squad": "#1d3a6b",
};
const SKIN = ["#f1c7a3", "#d9a77c", "#b9805a", "#8d5a3b", "#f5d6b8", "#c58c62"];
const HAIR = ["#2a1d15", "#4a2f1e", "#151515", "#6b4a2b", "#1f1a2e", "#3b2618"];

let handFont = "cursive";
/** Canvas can't read CSS variables in `font`, so the page hands us the resolved family. */
export const setHandFont = (family: string) => {
  if (family.trim()) handFont = family;
};

export interface View {
  k: number; // px per world unit
  ox: number;
  oy: number;
}

export function fitView(s: GameState, w: number, h: number): View {
  const k = Math.min(w / s.room.width, h / s.room.height);
  return { k, ox: (w - s.room.width * k) / 2, oy: (h - s.room.height * k) / 2 };
}

export function drawHall(ctx: CanvasRenderingContext2D, s: GameState, w: number, h: number, opts: { demo?: boolean; viewYaw?: number; duck?: number } = {}) {
  const v = fitView(s, w, h);
  const duck = Math.max(0, Math.min(1, opts.duck ?? 0));
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(v.ox, v.oy);
  ctx.scale(v.k, v.k);
  const px = 1 / v.k; // one screen pixel in world units

  drawFloor(ctx, s, px);
  if (duck > 0 && !opts.demo) {
    const playerIndex = s.students.findIndex((st) => st.isPlayer);
    if (playerIndex >= 0) {
      ctx.save();
      ctx.globalAlpha = duck;
      drawStudent(ctx, s, s.students[playerIndex], playerIndex, px, false, 0.34);
      ctx.restore();
    }
  }
  drawFurniture(ctx, s, px);
  drawCones(ctx, s);
  if (opts.viewYaw !== undefined && !opts.demo) {
    // Your own field of view, so the radar reads as "this is where I'm looking".
    const a = -Math.PI / 2 + opts.viewYaw;
    const g = ctx.createRadialGradient(s.playerPos.x, s.playerPos.y, 0.2, s.playerPos.x, s.playerPos.y, 5);
    g.addColorStop(0, "rgba(80,170,255,0.35)");
    g.addColorStop(1, "rgba(80,170,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(s.playerPos.x, s.playerPos.y);
    ctx.arc(s.playerPos.x, s.playerPos.y, 5, a - 0.72, a + 0.72);
    ctx.closePath();
    ctx.fill();
  }
  s.students.forEach((st, i) => {
    if (st.isPlayer && duck > 0 && !opts.demo) {
      ctx.save();
      ctx.globalAlpha = 1 - duck;
      drawStudent(ctx, s, st, i, px, false);
      ctx.restore();
    } else drawStudent(ctx, s, st, i, px, !!opts.demo);
  });
  s.teachers.forEach((t) => drawTeacher(ctx, s, t, px));
  drawCctv(ctx, s, px);
  drawNoise(ctx, s);
  ctx.restore();
}

function drawFloor(ctx: CanvasRenderingContext2D, s: GameState, px: number) {
  const { width: W, height: H } = s.room;
  ctx.fillStyle = "#c79f6e";
  ctx.fillRect(0, 0, W, H);
  // planks
  ctx.strokeStyle = "rgba(90,55,25,0.18)";
  ctx.lineWidth = px * 1.2;
  for (let y = 0.5, row = 0; y < H; y += 0.55, row++) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
    for (let x = (row % 3) * 1.1; x < W; x += 3.3) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 0.55);
      ctx.stroke();
    }
  }
  // walls
  ctx.strokeStyle = "#3a2a1e";
  ctx.lineWidth = 0.18;
  ctx.strokeRect(0.09, 0.09, W - 0.18, H - 0.18);
  // door on the right wall, front
  ctx.fillStyle = "#c79f6e";
  ctx.fillRect(W - 0.2, s.room.frontY - 0.6, 0.25, 1.2);
  ctx.fillStyle = "#8a5a32";
  ctx.fillRect(W - 0.16, s.room.frontY - 0.6, 0.08, 1.2);
}

function drawFurniture(ctx: CanvasRenderingContext2D, s: GameState, px: number) {
  const { width: W } = s.room;
  // blackboard
  const bx = W * 0.18;
  const bw = W * 0.64;
  ctx.fillStyle = "#6b4a2b";
  roundRect(ctx, bx - 0.08, 0.14, bw + 0.16, 0.56, 0.06);
  ctx.fill();
  ctx.fillStyle = "#2e4a3a";
  ctx.fillRect(bx, 0.2, bw, 0.44);
  ctx.fillStyle = "rgba(240,240,230,0.85)";
  ctx.font = `700 ${0.3}px ${handFont}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${s.level.name.toUpperCase()} · NO PHONES!`, W / 2, 0.43);

  // wall clock
  const cx = W - 1.2;
  const cy = 0.55;
  ctx.fillStyle = "#fbf6ea";
  ctx.beginPath();
  ctx.arc(cx, cy, 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = px * 2;
  ctx.strokeStyle = "#3a2a1e";
  ctx.stroke();
  const frac = 1 - s.timeLeft / s.level.duration;
  hand(ctx, cx, cy, frac * Math.PI * 2 - Math.PI / 2, 0.22, px * 2.5, "#b3261e");
  hand(ctx, cx, cy, frac * Math.PI * 0.5 - Math.PI / 2, 0.15, px * 3, "#3a2a1e");

  // teacher's desk
  const d = s.room.teacherDesk;
  ctx.fillStyle = "#6e4526";
  roundRect(ctx, d.x - 1.35, d.y - 0.42, 2.7, 0.84, 0.08);
  ctx.fill();
  ctx.fillStyle = "#845532";
  roundRect(ctx, d.x - 1.28, d.y - 0.36, 2.56, 0.72, 0.06);
  ctx.fill();
  // papers + mug
  ctx.fillStyle = "#f4efe2";
  ctx.save();
  ctx.translate(d.x - 0.7, d.y);
  ctx.rotate(-0.12);
  ctx.fillRect(-0.3, -0.2, 0.6, 0.4);
  ctx.restore();
  ctx.fillStyle = "#e6e0d0";
  ctx.fillRect(d.x - 0.65, d.y - 0.18, 0.6, 0.4);
  ctx.fillStyle = "#c0392b";
  ctx.beginPath();
  ctx.arc(d.x + 0.8, d.y - 0.05, 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#4a2a14";
  ctx.beginPath();
  ctx.arc(d.x + 0.8, d.y - 0.05, 0.08, 0, Math.PI * 2);
  ctx.fill();

  // student desks
  for (const st of s.students) {
    const p = deskPos(s.room, st.seat);
    ctx.fillStyle = "rgba(60,35,15,0.25)";
    roundRect(ctx, p.x - DESK_W / 2 + 0.05, p.y - DESK_H / 2 + 0.07, DESK_W, DESK_H, 0.06);
    ctx.fill();
    ctx.fillStyle = st.isPlayer ? "#e7c995" : "#dcbc86";
    roundRect(ctx, p.x - DESK_W / 2, p.y - DESK_H / 2, DESK_W, DESK_H, 0.06);
    ctx.fill();
    // exam paper
    ctx.fillStyle = "#fffdf6";
    ctx.save();
    ctx.translate(p.x - 0.12, p.y + 0.02);
    ctx.rotate(((st.seat.c * 7 + st.seat.r * 3) % 5) * 0.04 - 0.08);
    ctx.fillRect(-0.24, -0.2, 0.48, 0.38);
    ctx.fillStyle = "rgba(40,40,80,0.35)";
    for (let i = 0; i < 4; i++) ctx.fillRect(-0.18, -0.13 + i * 0.08, 0.3 - (i % 2) * 0.1, px * 1.4);
    ctx.restore();
    // pencil
    ctx.fillStyle = "#f2b81b";
    ctx.fillRect(p.x + 0.3, p.y - 0.15, 0.05, 0.3);
  }
}

function hand(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, len: number, w: number, c: string) {
  ctx.strokeStyle = c;
  ctx.lineWidth = w;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
  ctx.stroke();
}

function cone(ctx: CanvasRenderingContext2D, o: Vec, facing: number, fov: number, range: number, rgb: string, alpha: number) {
  const g = ctx.createRadialGradient(o.x, o.y, 0.2, o.x, o.y, range);
  g.addColorStop(0, `rgba(${rgb},${alpha})`);
  g.addColorStop(0.75, `rgba(${rgb},${alpha * 0.55})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(o.x, o.y);
  ctx.arc(o.x, o.y, range, facing - fov / 2, facing + fov / 2);
  ctx.closePath();
  ctx.fill();
}

function drawCones(ctx: CanvasRenderingContext2D, s: GameState) {
  for (const t of s.teachers) {
    if (!coneActive(t)) continue;
    const hostile = t.goal.type === "investigate";
    const rgb = t.seesPlayer ? "255,60,50" : hostile ? "255,140,40" : t.alert.time > 0 ? "255,190,60" : "255,236,140";
    cone(ctx, t.pos, t.facing, t.fov, t.range, rgb, t.seesPlayer ? 0.42 : 0.3);
  }
  for (const c of s.cctv) {
    cone(ctx, c, c.facing, (c.fov * Math.PI) / 180, c.range, c.seesPlayer ? "255,60,50" : "120,200,255", c.seesPlayer ? 0.38 : 0.2);
  }
}

function drawStudent(ctx: CanvasRenderingContext2D, s: GameState, st: Student, i: number, px: number, demo: boolean, underDeskOffset = 0) {
  const p = underDeskOffset ? { x: st.pos.x, y: st.pos.y - underDeskOffset } : st.pos;
  const skin = SKIN[(st.hue >> 2) % SKIN.length];
  const hair = HAIR[st.hue % HAIR.length];
  const bob = Math.sin(st.phase * 1.3) * 0.015;

  if (st.isPlayer && !demo) {
    // "You" ring
    const pulse = 0.5 + 0.5 * Math.sin(s.time * 3);
    ctx.strokeStyle = `rgba(255,214,10,${0.55 + pulse * 0.35})`;
    ctx.lineWidth = px * 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y + 0.05, 0.5, 0, Math.PI * 2);
    ctx.stroke();
  }

  // chair
  ctx.fillStyle = "#5b3b22";
  roundRect(ctx, p.x - 0.32, p.y + 0.02, 0.64, 0.42, 0.08);
  ctx.fill();

  // body
  ctx.fillStyle = st.isPlayer && !demo ? "#1f6feb" : `hsl(${st.hue},42%,46%)`;
  ellipse(ctx, p.x, p.y + 0.12 + bob, 0.34, 0.2);

  // arms reaching to the desk (writing)
  const write = Math.sin(st.phase * 6 + i) * 0.03;
  ctx.fillStyle = skin;
  circle(ctx, p.x - 0.22, p.y - 0.12 + write, 0.07);
  circle(ctx, p.x + 0.2, p.y - 0.14 - write, 0.07);

  // snitch head turns toward the player while peeking
  let hx = p.x;
  let hy = p.y + bob;
  if (st.snitch && st.peek > 0) {
    const dx = s.playerPos.x - p.x;
    const dy = s.playerPos.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    hx += (dx / d) * 0.08;
    hy += (dy / d) * 0.08;
  }
  ctx.fillStyle = skin;
  circle(ctx, hx, hy, 0.19);
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.arc(hx, hy, 0.19, Math.PI * 0.95, Math.PI * 2.05);
  ctx.fill();

  if (st.hand > 0) {
    ctx.fillStyle = skin;
    circle(ctx, p.x + 0.28, p.y - 0.42, 0.08);
    ctx.strokeStyle = skin;
    ctx.lineWidth = 0.08;
    ctx.beginPath();
    ctx.moveTo(p.x + 0.2, p.y);
    ctx.lineTo(p.x + 0.28, p.y - 0.4);
    ctx.stroke();
    bubble(ctx, p.x + 0.3, p.y - 0.8, "✋", px);
  }
  if (st.snitch && !demo) {
    if (st.peek > 0) bubble(ctx, hx, hy - 0.5, "👀", px, st.snitchMeter > 0 ? "#ffd6d6" : undefined);
    ctx.fillStyle = "rgba(180,30,30,0.85)";
    ctx.font = `700 ${0.17}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("SNITCH", p.x, p.y + 0.6);
  }

  if (st.isPlayer && !demo) {
    const ex = phoneExposure(s.phone);
    if (ex > 0) {
      const glow = ctx.createRadialGradient(p.x, p.y + 0.1, 0.02, p.x, p.y + 0.1, 0.55 * ex);
      glow.addColorStop(0, "rgba(120,220,255,0.75)");
      glow.addColorStop(1, "rgba(120,220,255,0)");
      ctx.fillStyle = glow;
      circle(ctx, p.x, p.y + 0.1, 0.55 * ex);
      ctx.fillStyle = "#0e1116";
      roundRect(ctx, p.x - 0.09, p.y - 0.03, 0.18, 0.28, 0.03);
      ctx.fill();
      ctx.fillStyle = s.phone.brightness === "high" ? "#9be7ff" : "#4b8aa0";
      roundRect(ctx, p.x - 0.07, p.y - 0.01, 0.14, 0.24, 0.02);
      ctx.fill();
    }
    ctx.fillStyle = "#ffd60a";
    ctx.font = `800 ${0.2}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("YOU", p.x, p.y + 0.66);
  }
}

function drawTeacher(ctx: CanvasRenderingContext2D, s: GameState, t: Teacher, px: number) {
  if (t.state === "gone") return;
  const { x, y } = t.pos;
  const color = TEACHER_COLORS[t.name] ?? "#444";
  const walking = t.state === "walking";
  const step = walking ? Math.sin((t.walked / STEP_LENGTH) * Math.PI) * 0.06 : 0;

  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ellipse(ctx, x + 0.06, y + 0.1, 0.42, 0.3);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t.facing - Math.PI / 2); // local +y = facing direction
  // feet
  ctx.fillStyle = "#222";
  circle(ctx, -0.14, 0.12 + step, 0.08);
  circle(ctx, 0.14, 0.12 - step, 0.08);
  // body (shoulders across facing)
  ctx.fillStyle = color;
  ellipse(ctx, 0, 0, 0.44, 0.26);
  if (t.kind === "squad") {
    ctx.fillStyle = "#e63946";
    ctx.fillRect(0.28, -0.1, 0.14, 0.2);
  }
  // reading: newspaper held in front
  if (t.state === "reading" && t.alert.time <= 0) {
    ctx.fillStyle = "#f2efe6";
    ctx.fillRect(-0.36, 0.22, 0.72, 0.36);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    for (let i = 0; i < 4; i++) ctx.fillRect(-0.3, 0.27 + i * 0.07, 0.28, px * 1.5);
    ctx.fillRect(0.04, 0.27, 0.26, 0.14);
  }
  // head
  ctx.fillStyle = "#e8b48d";
  circle(ctx, 0, 0.02, 0.21);
  ctx.fillStyle = t.name === "Mr. Dozy" ? "#d9d4cc" : "#2b2018";
  ctx.beginPath();
  ctx.arc(0, 0.02, 0.21, Math.PI, Math.PI * 2);
  ctx.fill();
  // glasses facing forward
  ctx.strokeStyle = "#111";
  ctx.lineWidth = px * 2;
  const glint = t.seesPlayer ? "#ff4d4d" : "#cfe8ff";
  ctx.fillStyle = glint;
  for (const gx of [-0.08, 0.08]) {
    ctx.beginPath();
    ctx.arc(gx, 0.16, 0.055, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  // status bubble
  let mark: string | null = null;
  let tone: string | undefined;
  if (t.state === "investigating" || t.goal.type === "investigate") {
    mark = "❗";
    tone = "#ffd0cc";
  } else if (isTelegraphing(t)) {
    mark = "❗";
    tone = "#fff1b8";
  } else if (t.alert.time > 0) {
    mark = "❓";
  } else if (t.state === "reading") {
    mark = "📰";
  } else if (t.state === "distracted") {
    mark = "💬";
  }
  if (mark) bubble(ctx, x, y - 0.65, mark, px, tone, isTelegraphing(t) ? 1 + 0.15 * Math.sin(s.time * 20) : 1);

  ctx.fillStyle = "rgba(20,15,10,0.85)";
  ctx.font = `700 ${0.2}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(t.name, x, y + 0.5);
}

function drawCctv(ctx: CanvasRenderingContext2D, s: GameState, px: number) {
  for (const c of s.cctv) {
    ctx.fillStyle = "#2a2d34";
    circle(ctx, c.x, c.y, 0.22);
    ctx.fillStyle = "#555b66";
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.facing);
    ctx.fillRect(0, -0.08, 0.3, 0.16);
    ctx.restore();
    const blink = Math.sin(s.time * 6) > 0;
    ctx.fillStyle = blink ? "#ff3b30" : "#5a1410";
    circle(ctx, c.x, c.y, 0.06);
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = `700 ${0.16}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("CCTV", c.x + (c.x > s.room.width / 2 ? -0.5 : 0.5), c.y + (c.y > 1 ? -0.35 : 0.4));
    void px;
  }
}

function drawNoise(ctx: CanvasRenderingContext2D, s: GameState) {
  for (const e of s.events) {
    if (e.kind !== "noise" || e.loud <= 0) continue;
    const age = s.time - e.t;
    if (age > 1.2 || age < 0) continue;
    const r = 0.3 + age * (1.5 + e.loud / 10);
    ctx.strokeStyle = e.source === "player" ? `rgba(255,70,50,${1 - age / 1.2})` : `rgba(255,255,255,${0.8 - age / 1.5})`;
    ctx.lineWidth = 0.06;
    for (const m of [1, 0.65]) {
      ctx.beginPath();
      ctx.arc(e.pos.x, e.pos.y, r * m, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(255,255,255,${1 - age / 1.2})`;
    ctx.font = `800 ${0.3}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.strokeStyle = `rgba(0,0,0,${0.7 - age / 2})`;
    ctx.lineWidth = 0.06;
    ctx.strokeText(e.label, e.pos.x, e.pos.y - 0.8 - age * 0.4);
    ctx.fillText(e.label, e.pos.x, e.pos.y - 0.8 - age * 0.4);
  }
}

// ---------------------------------------------------------------- primitives

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function bubble(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, px: number, bg = "#ffffff", scale = 1) {
  const r = 0.24 * scale;
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  circle(ctx, x + px * 2, y + px * 2, r);
  ctx.fillStyle = bg;
  circle(ctx, x, y, r);
  ctx.font = `${0.28 * scale}px system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#111";
  ctx.fillText(text, x, y + px);
}
