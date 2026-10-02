/**
 * Procedurally drawn people for the first-person view.
 *
 * Everything is drawn in a local frame measured in metres: origin on the floor under the
 * character, x to the right, and *negative* y going up (canvas convention), scaled by `k`
 * pixels-per-metre. Light comes from the windows on the left, so left edges are lit.
 */

// ---------------------------------------------------------------- colour helpers

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** amt > 0 lightens toward white, < 0 darkens toward black. */
export function shade(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  const t = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  return `rgb(${Math.round(r + (t - r) * p)},${Math.round(g + (t - g) * p)},${Math.round(b + (t - b) * p)})`;
}

/** Left-lit horizontal gradient across a body part. */
function litH(ctx: CanvasRenderingContext2D, x0: number, x1: number, base: string, strength = 0.18) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, shade(base, strength));
  g.addColorStop(0.45, base);
  g.addColorStop(1, shade(base, -strength * 1.4));
  return g;
}

// ---------------------------------------------------------------- path helpers (z up)

function ell(ctx: CanvasRenderingContext2D, cx: number, cz: number, rx: number, rz: number, fill: string | CanvasGradient) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(cx, -cz, Math.max(0.0005, rx), Math.max(0.0005, rz), 0, 0, Math.PI * 2);
  ctx.fill();
}

function shape(ctx: CanvasRenderingContext2D, pts: [number, number][], fill: string | CanvasGradient, smooth = false) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  if (!smooth) {
    pts.forEach(([x, z], i) => (i ? ctx.lineTo(x, -z) : ctx.moveTo(x, -z)));
  } else {
    // Rounded outline through midpoints (quadratic smoothing).
    const n = pts.length;
    const mid = (i: number) => [(pts[i][0] + pts[(i + 1) % n][0]) / 2, (pts[i][1] + pts[(i + 1) % n][1]) / 2];
    const m0 = mid(n - 1);
    ctx.moveTo(m0[0], -m0[1]);
    for (let i = 0; i < n; i++) {
      const m = mid(i);
      ctx.quadraticCurveTo(pts[i][0], -pts[i][1], m[0], -m[1]);
    }
  }
  ctx.closePath();
  ctx.fill();
}

function limb(ctx: CanvasRenderingContext2D, pts: [number, number][], width: number, color: string | CanvasGradient) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  pts.forEach(([x, z], i) => (i ? ctx.lineTo(x, -z) : ctx.moveTo(x, -z)));
  ctx.stroke();
}

function stroke(ctx: CanvasRenderingContext2D, pts: [number, number][], width: number, color: string) {
  limb(ctx, pts, width, color);
}

// ---------------------------------------------------------------- looks

export const SKIN_TONES = ["#f2cfae", "#e2b48c", "#c99468", "#a8754d", "#8a5a38", "#6e4429", "#d6a57c", "#b9835a"];
const HAIR_COLS = ["#16110d", "#24180f", "#3b2516", "#0f0f12", "#4a2f1e", "#2b1d14"];
const HIJAB_COLS = ["#f4f2ee", "#1d1f2a", "#25324d", "#6b2333", "#e9e1d2", "#3d4b3a"];

export type HairStyle = "short" | "side" | "buzz" | "curly" | "long" | "ponytail" | "bun" | "hijab";
const STYLES: HairStyle[] = ["short", "long", "side", "hijab", "ponytail", "curly", "short", "bun", "buzz", "long", "hijab", "side"];

export interface StudentLook {
  skin: string;
  hair: string;
  style: HairStyle;
  hijab: string;
  /** shirt is always the white uniform shirt; some wear a sweater or vest over it */
  layer: "none" | "sweater" | "vest";
  layerCol: string;
  /** trousers / skirt colour */
  bottom: string;
  build: number; // 0.92..1.08 shoulder width multiplier
}

export function studentLook(seed: number): StudentLook {
  const h = (n: number) => Math.abs(Math.floor(Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453));
  const layers: StudentLook["layer"][] = ["none", "none", "sweater", "vest", "none", "sweater"];
  const layerCols = ["#1f2d4f", "#5a1e2c", "#2f3a2f", "#3a3f4a"];
  return {
    skin: SKIN_TONES[h(1) % SKIN_TONES.length],
    hair: HAIR_COLS[h(2) % HAIR_COLS.length],
    style: STYLES[h(3) % STYLES.length],
    hijab: HIJAB_COLS[h(4) % HIJAB_COLS.length],
    layer: layers[h(5) % layers.length],
    layerCol: layerCols[h(6) % layerCols.length],
    bottom: ["#1f2a44", "#2a2d33", "#3a3f4a", "#24304f"][h(8) % 4],
    build: 0.92 + (h(7) % 17) / 100,
  };
}

export interface TeacherLook {
  skin: string;
  hair: string;
  hairStyle: "bald-ring" | "bun" | "neat" | "crew";
  jacket: string;
  shirt: string;
  tie?: string;
  trousers: string;
  shoes: string;
  glasses?: "round" | "cateye" | "rect";
  mustache?: boolean;
  stubble?: boolean;
  lipstick?: boolean;
  lanyard?: boolean;
  armband?: boolean;
  skirt?: boolean;
}

export const TEACHER_LOOKS: Record<string, TeacherLook> = {
  "Mr. Dozy": { skin: "#d9a77c", hair: "#cfcac2", hairStyle: "bald-ring", jacket: "#6d5038", shirt: "#efe6d2", tie: "#6b2333", trousers: "#4a4036", shoes: "#2a1d14", glasses: "round", mustache: true },
  "Ms. Hawk": { skin: "#c99468", hair: "#141012", hairStyle: "bun", jacket: "#5b2f6e", shirt: "#f5f2f7", trousers: "#2a2530", shoes: "#141414", glasses: "cateye", lipstick: true },
  "Dr. Stern": { skin: "#a8754d", hair: "#1a1512", hairStyle: "neat", jacket: "#2e3138", shirt: "#f2f4f7", tie: "#1f2d4f", trousers: "#26282e", shoes: "#111", glasses: "rect", stubble: true },
  "Flying Squad": { skin: "#8a5a38", hair: "#0f0f12", hairStyle: "crew", jacket: "#1c2c4c", shirt: "#e8edf5", tie: "#11192b", trousers: "#1c2433", shoes: "#0d0d0d", lanyard: true, armband: true },
};

// ---------------------------------------------------------------- faces

interface FaceOpts {
  /** -1..1: how far the head is turned to the viewer's right (3/4 view). */
  turn: number;
  /** Eyes fixed on the viewer (player). */
  stare: boolean;
  angry: boolean;
  glintRed: boolean;
  blink: boolean;
  /** Looking down at the desk (half-closed lids, pupils low). */
  down?: boolean;
}

function drawFace(ctx: CanvasRenderingContext2D, cz: number, rx: number, rz: number, skin: string, look: Partial<TeacherLook> & { hair: string }, o: FaceOpts) {
  const fx = -o.turn * rx * 0.42; // feature centre shifts in 3/4 view
  const eyeDx = rx * 0.42 * (1 - Math.abs(o.turn) * 0.3);
  const eyeZ = cz + rz * 0.05;
  // ears
  ell(ctx, -rx * 0.98 - o.turn * rx * 0.2, cz, rx * 0.16, rz * 0.24, shade(skin, -0.12));
  ell(ctx, rx * 0.98 - o.turn * rx * 0.2, cz, rx * 0.16, rz * 0.24, shade(skin, -0.2));
  // head with soft left light
  const g = ctx.createRadialGradient(-rx * 0.4, -(cz + rz * 0.3), rx * 0.1, 0, -cz, rx * 1.3);
  g.addColorStop(0, shade(skin, 0.12));
  g.addColorStop(0.6, skin);
  g.addColorStop(1, shade(skin, -0.22));
  ell(ctx, 0, cz, rx, rz, g);
  // jaw shadow + cheek warmth
  ell(ctx, fx, cz - rz * 0.62, rx * 0.55, rz * 0.22, "rgba(60,30,20,0.10)");
  ell(ctx, fx - eyeDx, cz - rz * 0.22, rx * 0.2, rz * 0.1, "rgba(200,90,80,0.10)");
  ell(ctx, fx + eyeDx, cz - rz * 0.22, rx * 0.2, rz * 0.1, "rgba(200,90,80,0.10)");

  // eyes
  const ew = rx * 0.2;
  const eh = o.blink ? rz * 0.012 : o.down ? rz * 0.045 : rz * 0.085;
  for (const side of [-1, 1]) {
    const ex = fx + side * eyeDx;
    ell(ctx, ex, eyeZ, ew, eh, o.blink ? shade(skin, -0.35) : "#fbf8f2");
    if (!o.blink) {
      const look = o.stare ? -o.turn * ew * 0.25 : side * ew * 0.15;
      const pz = o.down ? eyeZ - eh * 0.35 : eyeZ;
      ell(ctx, ex + look, pz, ew * 0.5, eh * 0.95, "#3a2516");
      ell(ctx, ex + look, pz, ew * 0.24, eh * 0.5, "#0b0807");
      if (!o.down) ell(ctx, ex + look - ew * 0.15, eyeZ + eh * 0.35, ew * 0.1, eh * 0.18, "rgba(255,255,255,0.9)");
      // upper lid line
      stroke(ctx, [[ex - ew, eyeZ + eh * 0.2], [ex, eyeZ + eh * 1.05], [ex + ew, eyeZ + eh * 0.2]], rz * 0.018, shade(skin, -0.5));
    }
    // eyebrow: knitted and angled down when angry
    const bz = eyeZ + rz * 0.2;
    const tilt = o.angry ? rz * 0.07 : -rz * 0.015;
    // outer end, inner end (inner end drops when angry)
    stroke(ctx, [[ex - side * ew * 1.1, bz + (o.angry ? tilt * 0.4 : tilt)], [ex + side * ew * 1.05, bz - (o.angry ? tilt : 0)]], rz * 0.05, shade(look.hair, -0.1));
  }
  // nose
  stroke(ctx, [[fx + rx * 0.02, eyeZ - rz * 0.05], [fx - rx * 0.06 - o.turn * rx * 0.08, cz - rz * 0.3], [fx + rx * 0.06, cz - rz * 0.34]], rz * 0.022, shade(skin, -0.3));
  ell(ctx, fx - rx * 0.12, cz - rz * 0.12, rx * 0.06, rz * 0.12, "rgba(255,255,255,0.08)");
  // mustache / stubble
  if (look.stubble) ell(ctx, fx, cz - rz * 0.62, rx * 0.62, rz * 0.32, "rgba(20,15,12,0.18)");
  if (look.mustache) shape(ctx, [[fx - rx * 0.32, cz - rz * 0.46], [fx, cz - rz * 0.38], [fx + rx * 0.32, cz - rz * 0.46], [fx + rx * 0.2, cz - rz * 0.52], [fx, cz - rz * 0.47], [fx - rx * 0.2, cz - rz * 0.52]], look.hair, true);
  // mouth
  const mz = cz - rz * 0.56;
  const mw = rx * 0.28;
  if (o.angry) stroke(ctx, [[fx - mw, mz - rz * 0.03], [fx, mz + rz * 0.015], [fx + mw, mz - rz * 0.03]], rz * 0.035, look.lipstick ? "#8c2a3a" : shade(skin, -0.45));
  else stroke(ctx, [[fx - mw, mz], [fx, mz - rz * 0.025], [fx + mw, mz]], rz * 0.03, look.lipstick ? "#a03246" : shade(skin, -0.4));
  // glasses
  if (look.glasses) {
    const lens = o.glintRed ? "rgba(255,40,30,0.55)" : "rgba(200,225,255,0.28)";
    ctx.lineWidth = rz * 0.035;
    ctx.strokeStyle = look.glasses === "cateye" ? "#3a1030" : "#1b1b1f";
    for (const side of [-1, 1]) {
      const ex = fx + side * eyeDx;
      ctx.fillStyle = lens;
      ctx.beginPath();
      if (look.glasses === "round") ctx.ellipse(ex, -eyeZ, ew * 1.45, ew * 1.35, 0, 0, Math.PI * 2);
      else if (look.glasses === "rect") ctx.roundRect(ex - ew * 1.5, -eyeZ - ew * 1.05, ew * 3, ew * 2.1, ew * 0.4);
      else {
        ctx.moveTo(ex - side * ew * 1.4, -eyeZ + ew * 0.2);
        ctx.quadraticCurveTo(ex - side * ew * 1.6, -eyeZ - ew * 1.5, ex + side * ew * 1.5, -eyeZ - ew * 0.9);
        ctx.quadraticCurveTo(ex + side * ew * 1.4, -eyeZ + ew * 1.2, ex - side * ew * 1.4, -eyeZ + ew * 0.2);
      }
      ctx.fill();
      ctx.stroke();
      // glint
      ell(ctx, ex - ew * 0.6, eyeZ + ew * 0.5, ew * 0.35, ew * 0.18, o.glintRed ? "rgba(255,120,110,0.9)" : "rgba(255,255,255,0.75)");
    }
    stroke(ctx, [[fx - eyeDx + ew * 1.4, eyeZ + ew * 0.2], [fx + eyeDx - ew * 1.4, eyeZ + ew * 0.2]], rz * 0.03, "#1b1b1f");
  }
}

// ---------------------------------------------------------------- students

export interface StudentPose {
  phase: number;
  /** Turned round to stare at the player (snitch peeking). */
  peek: boolean;
  hand: boolean;
}

function chairBack(ctx: CanvasRenderingContext2D) {
  // metal frame posts
  stroke(ctx, [[-0.19, 0.0], [-0.19, 0.9]], 0.022, "#3c3f45");
  stroke(ctx, [[0.19, 0.0], [0.19, 0.9]], 0.022, "#2c2e33");
  // seat edge
  shape(ctx, [[-0.22, 0.44], [0.22, 0.44], [0.21, 0.48], [-0.21, 0.48]], "#4a3322");
  // wooden backrest
  const g = ctx.createLinearGradient(-0.21, 0, 0.21, 0);
  g.addColorStop(0, "#9a6a3e");
  g.addColorStop(0.5, "#7d5330");
  g.addColorStop(1, "#5e3d22");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(-0.21, -0.88, 0.42, 0.24, 0.035);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.fillRect(-0.19, -0.875, 0.38, 0.025);
}

function studentHairBack(ctx: CanvasRenderingContext2D, L: StudentLook, cz: number, rx: number, rz: number) {
  const hair = L.hair;
  const g = ctx.createRadialGradient(-rx * 0.35, -(cz + rz * 0.5), rx * 0.1, 0, -cz, rx * 1.35);
  g.addColorStop(0, shade(hair, 0.22));
  g.addColorStop(0.5, hair);
  g.addColorStop(1, shade(hair, -0.3));
  switch (L.style) {
    case "hijab": {
      const hg = ctx.createLinearGradient(-0.25, 0, 0.25, 0);
      hg.addColorStop(0, shade(L.hijab, 0.12));
      hg.addColorStop(0.5, L.hijab);
      hg.addColorStop(1, shade(L.hijab, -0.25));
      // drape over the shoulders and down the back
      shape(ctx, [[-rx * 1.15, cz + rz * 0.2], [-rx * 1.25, cz - rz * 0.8], [-0.2, cz - 0.2], [-0.16, cz - 0.33], [0.16, cz - 0.33], [0.2, cz - 0.2], [rx * 1.25, cz - rz * 0.8], [rx * 1.15, cz + rz * 0.2], [0, cz + rz * 1.12]], hg, true);
      // fold lines
      ctx.globalAlpha = 0.25;
      stroke(ctx, [[-rx * 0.4, cz - rz * 0.4], [-rx * 0.55, cz - 0.27]], 0.006, shade(L.hijab, -0.4));
      stroke(ctx, [[rx * 0.35, cz - rz * 0.3], [rx * 0.5, cz - 0.27]], 0.006, shade(L.hijab, -0.4));
      ctx.globalAlpha = 1;
      return;
    }
    case "long":
      shape(ctx, [[-rx * 1.08, cz + rz * 0.3], [-rx * 1.2, cz - rz * 1.4], [-rx * 0.9, cz - 0.27], [rx * 0.9, cz - 0.27], [rx * 1.2, cz - rz * 1.4], [rx * 1.08, cz + rz * 0.3], [0, cz + rz * 1.1]], g, true);
      break;
    case "ponytail":
      ell(ctx, 0, cz + rz * 0.06, rx * 1.04, rz * 1.02, g);
      stroke(ctx, [[0, cz - rz * 0.2], [rx * 0.08, cz - rz * 1.1], [0, cz - 0.2]], rx * 0.45, hair);
      ell(ctx, 0, cz - rz * 0.25, rx * 0.22, rz * 0.08, "#c0392b"); // hair tie
      break;
    case "bun":
      ell(ctx, 0, cz + rz * 0.06, rx * 1.04, rz * 1.02, g);
      ell(ctx, 0, cz + rz * 0.75, rx * 0.5, rz * 0.4, g);
      break;
    case "curly":
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        ell(ctx, Math.cos(a) * rx * 0.7, cz + rz * 0.1 + Math.sin(a) * rz * 0.75, rx * 0.42, rz * 0.36, g);
      }
      ell(ctx, 0, cz + rz * 0.1, rx * 0.95, rz * 0.95, g);
      break;
    case "buzz":
      ell(ctx, 0, cz + rz * 0.04, rx * 1.01, rz * 1.0, `${hair}cc`);
      break;
    case "side":
    case "short":
    default:
      // covers the back of the head, tapering at the nape
      shape(ctx, [[-rx * 1.05, cz - rz * 0.1], [-rx * 1.0, cz + rz * 0.75], [0, cz + rz * 1.1], [rx * 1.05, cz + rz * 0.7], [rx * 1.04, cz - rz * 0.15], [rx * 0.55, cz - rz * 0.72], [-rx * 0.55, cz - rz * 0.72]], g, true);
      if (L.style === "side") stroke(ctx, [[-rx * 0.35, cz + rz * 1.0], [-rx * 0.25, cz + rz * 0.2]], 0.004, shade(hair, 0.35));
  }
  // a few strands for texture
  ctx.globalAlpha = 0.35;
  for (let i = -2; i <= 2; i++) stroke(ctx, [[i * rx * 0.3, cz + rz * 0.85], [i * rx * 0.38, cz - rz * 0.3]], 0.003, shade(hair, 0.4));
  ctx.globalAlpha = 1;
}

/** A classmate seen from behind, sitting and writing. */
export function drawStudentBack(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, L: StudentLook, pose: StudentPose) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);

  const breathe = Math.sin(pose.phase * 1.6) * 0.004;
  const lean = 0.02 + Math.sin(pose.phase * 0.4) * 0.01; // leaning over the paper
  const sw = 0.2 * L.build; // half shoulder width
  const shoulderZ = 0.97 + breathe - lean;

  // floor shadow
  ell(ctx, 0, 0, 0.32, 0.05, "rgba(0,0,0,0.22)");

  // hips/trousers sitting on the seat (visible under the backrest)
  shape(ctx, [[-0.17, 0.47], [0.17, 0.47], [0.165, 0.64], [-0.165, 0.64]], litH(ctx, -0.17, 0.17, L.bottom, 0.12), true);

  // torso: white shirt (+ sweater/vest)
  const torsoCol = L.layer === "sweater" ? L.layerCol : "#eef1f4";
  shape(ctx, [[-0.155, 0.6], [-sw, shoulderZ - 0.06], [-sw * 0.9, shoulderZ + 0.02], [0, shoulderZ + 0.04], [sw * 0.9, shoulderZ + 0.02], [sw, shoulderZ - 0.06], [0.155, 0.6], [0, 0.585]], litH(ctx, -sw, sw, torsoCol, 0.14), true);
  if (L.layer === "vest") shape(ctx, [[-0.14, 0.52], [-sw * 0.75, shoulderZ - 0.05], [-sw * 0.35, shoulderZ + 0.015], [sw * 0.35, shoulderZ + 0.015], [sw * 0.75, shoulderZ - 0.05], [0.14, 0.52]], litH(ctx, -sw, sw, L.layerCol, 0.12), true);
  // shoulder-blade folds + spine crease
  ctx.globalAlpha = 0.18;
  stroke(ctx, [[0, shoulderZ - 0.02], [0.005, 0.6]], 0.008, "#6b7380");
  stroke(ctx, [[-sw * 0.6, shoulderZ - 0.12], [-sw * 0.3, shoulderZ - 0.2]], 0.006, "#6b7380");
  stroke(ctx, [[sw * 0.6, shoulderZ - 0.12], [sw * 0.3, shoulderZ - 0.2]], 0.006, "#6b7380");
  ctx.globalAlpha = 1;

  // arms: upper arms hang, forearms go forward onto the desk (hidden); the writing arm moves
  const sleeve = L.layer === "sweater" ? L.layerCol : "#e4e8ee";
  const write = Math.sin(pose.phase * 7) * 0.012;
  limb(ctx, [[-sw * 0.95, shoulderZ - 0.05], [-sw * 1.12, shoulderZ - 0.26], [-sw * 0.85, shoulderZ - 0.32]], 0.085, litH(ctx, -sw * 1.2, -sw * 0.7, sleeve, 0.1));
  if (pose.hand) {
    limb(ctx, [[sw * 0.95, shoulderZ - 0.03], [sw * 1.05, shoulderZ + 0.28], [sw * 1.0, shoulderZ + 0.55]], 0.08, sleeve);
    ell(ctx, sw * 1.0, shoulderZ + 0.62, 0.045, 0.06, L.skin);
  } else {
    limb(ctx, [[sw * 0.95, shoulderZ - 0.05], [sw * 1.1 + write, shoulderZ - 0.26], [sw * 0.8 + write, shoulderZ - 0.31]], 0.085, litH(ctx, sw * 0.7, sw * 1.2, sleeve, 0.1));
  }

  // chair backrest in front of the lower back
  chairBack(ctx);

  // collar + neck
  const neckZ = shoulderZ + 0.02;
  const headZ = neckZ + 0.15 - lean * 0.5;
  const rx = 0.082;
  const rz = 0.102;
  if (L.style !== "hijab") {
    ell(ctx, 0, neckZ + 0.03, 0.045, 0.05, shade(L.skin, -0.12));
    shape(ctx, [[-0.07, neckZ - 0.005], [0, neckZ + 0.03], [0.07, neckZ - 0.005], [0.055, neckZ - 0.03], [-0.055, neckZ - 0.03]], "#f7f8fa");
  }

  if (pose.peek) {
    // Turned round, staring at you over the shoulder.
    const stare = { turn: 0.35, stare: true, angry: false, glintRed: false, blink: false };
    if (L.style === "hijab") {
      shape(ctx, [[-rx * 1.25, headZ + rz * 0.2], [-rx * 1.2, headZ - rz * 1.2], [-0.18, headZ - 0.25], [0.18, headZ - 0.25], [rx * 1.2, headZ - rz * 1.2], [rx * 1.25, headZ + rz * 0.2], [0, headZ + rz * 1.18]], L.hijab, true);
      drawFace(ctx, headZ - rz * 0.06, rx * 0.8, rz * 0.84, L.skin, { hair: L.hair }, stare);
    } else {
      drawFace(ctx, headZ, rx, rz, L.skin, { hair: L.hair }, stare);
      ctx.fillStyle = L.hair;
      ctx.beginPath();
      ctx.ellipse(0, -headZ, rx * 1.06, rz * 1.04, 0, Math.PI * 1.02, Math.PI * 1.98);
      ctx.fill();
    }
  } else {
    // ears, back of the head, hair
    if (L.style !== "hijab") {
      ell(ctx, -rx * 1.0, headZ - rz * 0.05, rx * 0.17, rz * 0.24, shade(L.skin, 0.02));
      ell(ctx, rx * 1.0, headZ - rz * 0.05, rx * 0.17, rz * 0.24, shade(L.skin, -0.2));
      ell(ctx, 0, headZ, rx, rz, litH(ctx, -rx, rx, L.skin, 0.12));
    }
    studentHairBack(ctx, L, headZ, rx, rz);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- teachers

export type TeacherPose = "stand" | "walk" | "seated-read" | "seated-look" | "hands-hips" | "help";

export interface TeacherDrawOpts {
  pose: TeacherPose;
  /** Facing the viewer at all? */
  front: boolean;
  /** -1..1 turn toward the viewer's right */
  turn: number;
  walkPhase: number;
  seesPlayer: boolean;
  angry: boolean;
  blink: boolean;
}

function teacherHair(ctx: CanvasRenderingContext2D, L: TeacherLook, cz: number, rx: number, rz: number, front: boolean, turn: number) {
  const g = ctx.createRadialGradient(-rx * 0.4, -(cz + rz * 0.6), rx * 0.1, 0, -cz, rx * 1.3);
  g.addColorStop(0, shade(L.hair, 0.25));
  g.addColorStop(0.55, L.hair);
  g.addColorStop(1, shade(L.hair, -0.3));
  switch (L.hairStyle) {
    case "bald-ring":
      // grey horseshoe round the sides/back, shiny bald crown
      if (front) {
        ell(ctx, -rx * 0.95, cz + rz * 0.15, rx * 0.2, rz * 0.35, g);
        ell(ctx, rx * 0.95, cz + rz * 0.15, rx * 0.2, rz * 0.35, g);
        ell(ctx, -rx * 0.3, cz + rz * 0.75, rx * 0.25, rz * 0.12, "rgba(255,255,255,0.35)");
      } else {
        shape(ctx, [[-rx * 1.04, cz + rz * 0.35], [-rx * 0.9, cz - rz * 0.6], [0, cz - rz * 0.8], [rx * 0.9, cz - rz * 0.6], [rx * 1.04, cz + rz * 0.35], [0, cz + rz * 0.15]], g, true);
        ell(ctx, -rx * 0.25, cz + rz * 0.7, rx * 0.3, rz * 0.15, "rgba(255,255,255,0.3)");
      }
      break;
    case "bun":
      if (front) {
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(0, -cz - rz * 0.05, rx * 1.08, rz * 1.06, 0, Math.PI * 1.0, Math.PI * 2.0);
        ctx.fill();
        // centre parting
        stroke(ctx, [[-turn * rx * 0.3, cz + rz * 1.0], [-turn * rx * 0.3, cz + rz * 0.6]], 0.004, shade(L.skin, -0.1));
        ell(ctx, rx * 0.15, cz + rz * 1.05, rx * 0.45, rz * 0.35, g);
      } else {
        ell(ctx, 0, cz + rz * 0.05, rx * 1.06, rz * 1.04, g);
        ell(ctx, 0, cz + rz * 0.55, rx * 0.5, rz * 0.4, g);
        ctx.globalAlpha = 0.4;
        for (let i = 0; i < 3; i++) stroke(ctx, [[-rx * 0.4 + i * rx * 0.2, cz + rz * 0.85], [-rx * 0.2 + i * rx * 0.2, cz + rz * 0.3]], 0.003, shade(L.hair, 0.4));
        ctx.globalAlpha = 1;
      }
      break;
    case "neat":
    case "crew":
    default:
      if (front) {
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(0, -cz - rz * 0.08, rx * 1.06, rz * (L.hairStyle === "crew" ? 0.98 : 1.06), 0, Math.PI * 1.02, Math.PI * 1.98);
        ctx.fill();
        if (L.hairStyle === "neat") shape(ctx, [[-rx * 0.9, cz + rz * 0.55], [rx * 0.2 - turn * rx * 0.2, cz + rz * 0.95], [rx * 0.9, cz + rz * 0.62], [rx * 0.4, cz + rz * 0.72]], g, true);
        ell(ctx, -rx * 1.0, cz + rz * 0.2, rx * 0.12, rz * 0.3, g);
        ell(ctx, rx * 1.0, cz + rz * 0.2, rx * 0.12, rz * 0.3, g);
      } else {
        shape(ctx, [[-rx * 1.05, cz - rz * 0.05], [-rx * 1.02, cz + rz * 0.75], [0, cz + rz * 1.08], [rx * 1.02, cz + rz * 0.75], [rx * 1.05, cz - rz * 0.05], [rx * 0.6, cz - rz * 0.65], [-rx * 0.6, cz - rz * 0.65]], g, true);
      }
  }
}

/** Full-body invigilator. Front, back or 3/4, walking or standing, or seated behind the desk. */
export function drawTeacherFigure(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, L: TeacherLook, o: TeacherDrawOpts) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  const seated = o.pose === "seated-read" || o.pose === "seated-look";
  const sx = 1 - Math.abs(o.turn) * 0.22; // body narrows when turned
  const walk = o.pose === "walk";
  const stride = walk ? Math.sin(o.walkPhase) : 0;
  const bob = walk ? Math.abs(stride) * 0.015 : 0;
  const base = seated ? -0.42 : 0; // seated: everything sinks by the leg length
  const hipZ = 0.92 + base + bob;
  const shZ = 1.44 + base + bob;
  const sw = 0.215 * sx;
  const neckZ = shZ + 0.05;
  const headZ = shZ + 0.17;
  const rx = 0.088 * (1 - Math.abs(o.turn) * 0.08);
  const rz = 0.112;

  if (!seated) {
    ell(ctx, 0, 0, 0.3, 0.055, "rgba(0,0,0,0.28)");
    // legs: trousers (or skirt + legs), with stride
    const legW = 0.105 * sx;
    const lz = (s: number) => Math.max(0, s) * 0.06;
    if (L.skirt) {
      shape(ctx, [[-0.16 * sx, hipZ], [0.16 * sx, hipZ], [0.18 * sx, hipZ - 0.45], [-0.18 * sx, hipZ - 0.45]], litH(ctx, -0.2, 0.2, L.trousers, 0.12));
      limb(ctx, [[-0.07 * sx, hipZ - 0.45], [-0.075 * sx, 0.07 + lz(stride)]], 0.06, shade(L.skin, -0.1));
      limb(ctx, [[0.07 * sx, hipZ - 0.45], [0.075 * sx, 0.07 + lz(-stride)]], 0.06, shade(L.skin, -0.2));
    } else {
      limb(ctx, [[-0.075 * sx, hipZ - 0.02], [-0.08 * sx - stride * 0.02, 0.45 + lz(stride)], [-0.08 * sx, 0.06 + lz(stride)]], legW, litH(ctx, -0.15, 0, L.trousers, 0.12));
      limb(ctx, [[0.075 * sx, hipZ - 0.02], [0.08 * sx + stride * 0.02, 0.45 + lz(-stride)], [0.08 * sx, 0.06 + lz(-stride)]], legW, litH(ctx, 0, 0.15, L.trousers, 0.12));
      // trouser creases
      ctx.globalAlpha = 0.2;
      stroke(ctx, [[-0.075 * sx, hipZ - 0.1], [-0.08 * sx, 0.12 + lz(stride)]], 0.004, "#000");
      stroke(ctx, [[0.075 * sx, hipZ - 0.1], [0.08 * sx, 0.12 + lz(-stride)]], 0.004, "#000");
      ctx.globalAlpha = 1;
    }
    // shoes
    ell(ctx, -0.085 * sx, 0.03 + lz(stride), 0.065, 0.035, L.shoes);
    ell(ctx, 0.085 * sx, 0.03 + lz(-stride), 0.065, 0.035, L.shoes);
    ell(ctx, -0.1 * sx, 0.045 + lz(stride), 0.025, 0.008, "rgba(255,255,255,0.25)");
  }

  // torso / jacket
  const jacket = litH(ctx, -sw, sw, L.jacket, 0.16);
  shape(ctx, [[-0.17 * sx, hipZ - 0.06], [-sw * 1.02, shZ - 0.05], [-sw * 0.85, shZ + 0.025], [0, shZ + 0.04], [sw * 0.85, shZ + 0.025], [sw * 1.02, shZ - 0.05], [0.17 * sx, hipZ - 0.06]], jacket, true);
  if (o.front) {
    // shirt V + tie + lapels
    const vx = -o.turn * 0.03;
    shape(ctx, [[vx - 0.075, shZ + 0.01], [vx + 0.075, shZ + 0.01], [vx + 0.01, shZ - 0.27], [vx - 0.01, shZ - 0.27]], L.shirt);
    if (L.tie) shape(ctx, [[vx - 0.018, shZ - 0.0], [vx + 0.018, shZ - 0.0], [vx + 0.03, shZ - 0.24], [vx, shZ - 0.29], [vx - 0.03, shZ - 0.24]], L.tie);
    shape(ctx, [[vx - 0.075, shZ + 0.01], [vx - 0.105, shZ - 0.06], [vx - 0.02, shZ - 0.28], [vx - 0.012, shZ - 0.25]], shade(L.jacket, -0.18));
    shape(ctx, [[vx + 0.075, shZ + 0.01], [vx + 0.105, shZ - 0.06], [vx + 0.02, shZ - 0.28], [vx + 0.012, shZ - 0.25]], shade(L.jacket, -0.3));
    // buttons + pocket
    for (const bz of [shZ - 0.36, shZ - 0.45]) ell(ctx, vx + 0.012, bz, 0.009, 0.009, shade(L.jacket, -0.45));
    stroke(ctx, [[-sw * 0.75, shZ - 0.12], [-sw * 0.35, shZ - 0.12]], 0.006, shade(L.jacket, -0.3));
    if (L.lanyard) {
      stroke(ctx, [[vx - 0.06, shZ + 0.01], [vx - 0.01, shZ - 0.3], [vx + 0.06, shZ + 0.01]], 0.008, "#d62828");
      ctx.fillStyle = "#f4f4f4";
      ctx.fillRect(vx - 0.04, -(shZ - 0.3), 0.08, 0.1);
      ctx.fillStyle = "#1c2c4c";
      ctx.fillRect(vx - 0.035, -(shZ - 0.305), 0.07, 0.022);
    }
  } else {
    // back of the jacket: seam + vent + collar
    ctx.globalAlpha = 0.3;
    stroke(ctx, [[0, shZ - 0.02], [0, hipZ + 0.02]], 0.006, shade(L.jacket, -0.5));
    ctx.globalAlpha = 1;
    shape(ctx, [[-0.075, shZ + 0.035], [0.075, shZ + 0.035], [0.06, shZ - 0.01], [-0.06, shZ - 0.01]], shade(L.jacket, -0.15));
  }

  // arms
  const arm = (side: -1 | 1, pts: [number, number][]) => limb(ctx, pts, 0.088, litH(ctx, side < 0 ? -sw * 1.3 : sw * 0.7, side < 0 ? -sw * 0.7 : sw * 1.3, L.jacket, 0.12));
  const hand = (hx: number, hz: number) => ell(ctx, hx, hz, 0.04, 0.05, litH(ctx, hx - 0.04, hx + 0.04, L.skin, 0.12));
  if (o.pose === "seated-read") {
    // newspaper held up: drawn after the head
  } else if (o.pose === "hands-hips") {
    arm(-1, [[-sw, shZ - 0.04], [-sw * 1.55, shZ - 0.28], [-0.16 * sx, hipZ + 0.06]]);
    arm(1, [[sw, shZ - 0.04], [sw * 1.55, shZ - 0.28], [0.16 * sx, hipZ + 0.06]]);
  } else if (o.pose === "help") {
    arm(-1, [[-sw, shZ - 0.04], [-sw * 1.1, shZ - 0.32], [-sw * 1.05, hipZ - 0.05]]);
    hand(-sw * 1.05, hipZ - 0.1);
    arm(1, [[sw, shZ - 0.04], [sw * 1.4, shZ - 0.25], [sw * 1.9, shZ - 0.3]]);
    hand(sw * 1.95, shZ - 0.3);
    ctx.save();
    ctx.translate(sw * 2.05, -(shZ - 0.28));
    ctx.rotate(-0.15);
    ctx.fillStyle = "#fffdf6";
    ctx.fillRect(-0.02, -0.14, 0.17, 0.22);
    ctx.restore();
  } else if (o.pose === "seated-look") {
    arm(-1, [[-sw, shZ - 0.04], [-sw * 1.15, shZ - 0.3], [-sw * 0.6, shZ - 0.42]]);
    arm(1, [[sw, shZ - 0.04], [sw * 1.15, shZ - 0.3], [sw * 0.6, shZ - 0.42]]);
  } else {
    const swing = stride * 0.06;
    arm(-1, [[-sw, shZ - 0.04], [-sw * 1.12 + swing * 0.3, shZ - 0.3], [-sw * 1.05 + swing, hipZ - 0.07]]);
    arm(1, [[sw, shZ - 0.04], [sw * 1.12 - swing * 0.3, shZ - 0.3], [sw * 1.05 - swing, hipZ - 0.07]]);
    hand(-sw * 1.05 + swing, hipZ - 0.11);
    hand(sw * 1.05 - swing, hipZ - 0.11);
    if (L.armband) {
      ell(ctx, -sw * 1.1, shZ - 0.2, 0.05, 0.03, "#e63946");
    }
  }

  // neck + head
  ell(ctx, 0, neckZ, 0.048, 0.05, shade(L.skin, -0.18));
  if (o.front) {
    drawFace(ctx, headZ, rx, rz, L.skin, L, { turn: o.turn, stare: o.seesPlayer, angry: o.angry, glintRed: o.seesPlayer, blink: o.blink });
  } else {
    ell(ctx, -rx * 1.0, headZ, rx * 0.16, rz * 0.24, shade(L.skin, -0.05));
    ell(ctx, rx * 1.0, headZ, rx * 0.16, rz * 0.24, shade(L.skin, -0.22));
    ell(ctx, 0, headZ, rx, rz, litH(ctx, -rx, rx, L.skin, 0.12));
  }
  teacherHair(ctx, L, headZ, rx, rz, o.front, o.turn);

  if (o.pose === "seated-read") {
    // Broadsheet newspaper held up in front of the face.
    const pz = headZ + 0.08;
    ctx.save();
    ctx.translate(0, -pz);
    const g = ctx.createLinearGradient(-0.3, 0, 0.3, 0);
    g.addColorStop(0, "#f4f1e8");
    g.addColorStop(0.5, "#e9e4d6");
    g.addColorStop(0.52, "#d6d0c0");
    g.addColorStop(1, "#ece7da");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-0.3, 0);
    ctx.quadraticCurveTo(0, 0.025, 0.3, 0);
    ctx.lineTo(0.3, 0.4);
    ctx.quadraticCurveTo(0, 0.42, -0.3, 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#2b2b2b";
    ctx.fillRect(-0.27, 0.03, 0.24, 0.035); // headline
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    for (let i = 0; i < 7; i++) {
      ctx.fillRect(-0.27, 0.09 + i * 0.038, 0.24, 0.008);
      ctx.fillRect(0.04, 0.2 + i * 0.026, 0.23, 0.007);
    }
    ctx.fillStyle = "#9aa3a8";
    ctx.fillRect(0.04, 0.03, 0.23, 0.14); // photo
    ctx.restore();
    hand(-0.31, pz - 0.2);
    hand(0.31, pz - 0.2);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- students: side + front views

/** Hair seen from the side; `d` is the direction the face points on screen (+1 = right). */
function studentHairSide(ctx: CanvasRenderingContext2D, L: StudentLook, hx: number, cz: number, r: number, d: number) {
  const g = litH(ctx, hx - r, hx + r, L.hair, 0.18);
  if (L.style === "hijab") {
    const hg = litH(ctx, hx - r * 1.4, hx + r * 1.4, L.hijab, 0.14);
    shape(ctx, [[hx + d * r * 0.55, cz + r * 1.12], [hx - d * r * 1.25, cz + r * 0.6], [hx - d * r * 1.5, cz - r * 1.2], [hx - d * 0.2, cz - 0.27], [hx + d * 0.08, cz - 0.24], [hx + d * r * 0.55, cz - r * 1.05], [hx + d * r * 0.62, cz]], hg, true);
    return;
  }
  // cap of hair over the crown and the back of the head
  shape(ctx, [[hx + d * r * 0.7, cz + r * 0.75], [hx + d * r * 0.1, cz + r * 1.08], [hx - d * r * 0.9, cz + r * 0.6], [hx - d * r * 1.05, cz - r * 0.2], [hx - d * r * 0.55, cz - r * 0.75], [hx - d * r * 0.2, cz + r * 0.05], [hx + d * r * 0.5, cz + r * 0.45]], g, true);
  if (L.style === "long") shape(ctx, [[hx - d * r * 0.4, cz + r * 0.2], [hx - d * r * 1.05, cz + r * 0.1], [hx - d * r * 1.15, cz - r * 2.2], [hx - d * r * 0.45, cz - r * 2.2]], g, true);
  if (L.style === "ponytail") stroke(ctx, [[hx - d * r * 0.9, cz + r * 0.2], [hx - d * r * 1.5, cz - r * 0.5], [hx - d * r * 1.3, cz - r * 1.4]], r * 0.45, L.hair);
  if (L.style === "bun") ell(ctx, hx - d * r * 0.85, cz + r * 0.55, r * 0.45, r * 0.4, g);
  if (L.style === "curly") for (let i = 0; i < 5; i++) ell(ctx, hx - d * r * (0.2 + i * 0.2), cz + r * (0.9 - i * 0.25), r * 0.38, r * 0.34, g);
}

/** A classmate in profile, writing; `d` = which way they face on screen. */
export function drawStudentSide(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, L: StudentLook, pose: StudentPose, d: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  const lean = 0.06 + Math.sin(pose.phase * 0.4) * 0.015;
  const write = Math.sin(pose.phase * 7) * 0.01;
  ell(ctx, d * 0.05, 0, 0.32, 0.05, "rgba(0,0,0,0.22)");

  // chair from the side: back post + seat + legs
  stroke(ctx, [[-d * 0.2, 0], [-d * 0.2, 0.9]], 0.022, "#3c3f45");
  stroke(ctx, [[d * 0.18, 0], [d * 0.18, 0.46]], 0.022, "#2c2e33");
  shape(ctx, [[-d * 0.22, 0.44], [d * 0.22, 0.44], [d * 0.21, 0.48], [-d * 0.21, 0.48]], "#4a3322");
  const bg = ctx.createLinearGradient(-0.03, 0, 0.03, 0);
  bg.addColorStop(0, "#9a6a3e");
  bg.addColorStop(1, "#6e4a2a");
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(-d * 0.215 - 0.02, -0.88, 0.04, 0.24, 0.015);
  ctx.fill();

  // legs: thigh forward, shin down
  limb(ctx, [[-d * 0.05, 0.53], [d * 0.3, 0.53], [d * 0.32, 0.08]], 0.12, litH(ctx, -0.2, 0.35, L.bottom, 0.12));
  ell(ctx, d * 0.36, 0.035, 0.08, 0.035, "#1b1b1f");

  // torso, leaning toward the desk
  const shX = d * lean;
  const shZ = 0.96;
  const torsoCol = L.layer === "sweater" ? L.layerCol : "#eef1f4";
  shape(ctx, [[-d * 0.13, 0.52], [d * 0.1, 0.52], [shX + d * 0.11, shZ - 0.08], [shX + d * 0.04, shZ + 0.02], [shX - d * 0.1, shZ + 0.01], [-d * 0.15, shZ - 0.2]], litH(ctx, -0.18, 0.18, torsoCol, 0.14), true);
  if (L.layer === "vest") shape(ctx, [[-d * 0.12, 0.55], [d * 0.09, 0.55], [shX + d * 0.1, shZ - 0.1], [shX - d * 0.09, shZ - 0.03], [-d * 0.14, shZ - 0.2]], L.layerCol, true);
  // arm: shoulder, elbow, hand on the desk, writing
  const sleeve = L.layer === "sweater" ? L.layerCol : "#e4e8ee";
  limb(ctx, [[shX, shZ - 0.04], [shX + d * 0.06, shZ - 0.24], [d * (0.33 + write), 0.79]], 0.075, litH(ctx, -0.1, 0.4, sleeve, 0.1));
  ell(ctx, d * (0.37 + write), 0.785, 0.04, 0.03, L.skin);
  stroke(ctx, [[d * (0.37 + write), 0.79], [d * (0.42 + write), 0.84]], 0.01, "#f2b81b"); // pencil

  // neck + head in profile, tilted toward the paper
  const hx = shX + d * 0.05;
  const hz = shZ + 0.14;
  const r = 0.095;
  if (L.style !== "hijab") ell(ctx, shX + d * 0.01, shZ + 0.04, 0.04, 0.05, shade(L.skin, -0.12));
  const hg = ctx.createRadialGradient(hx - r * 0.3, -(hz + r * 0.3), r * 0.1, hx, -hz, r * 1.3);
  hg.addColorStop(0, shade(L.skin, 0.1));
  hg.addColorStop(1, shade(L.skin, -0.18));
  ell(ctx, hx, hz, r * 0.92, r * 1.05, hg);
  // nose, eye, brow, ear
  shape(ctx, [[hx + d * r * 0.85, hz + r * 0.05], [hx + d * r * 1.12, hz - r * 0.22], [hx + d * r * 0.85, hz - r * 0.3]], shade(L.skin, -0.05));
  ell(ctx, hx + d * r * 0.55, hz + r * 0.02, r * 0.1, r * 0.05, "#2a1a10");
  stroke(ctx, [[hx + d * r * 0.42, hz + r * 0.2], [hx + d * r * 0.7, hz + r * 0.22]], r * 0.06, shade(L.hair, -0.1));
  if (L.style !== "hijab") ell(ctx, hx - d * r * 0.05, hz - r * 0.05, r * 0.16, r * 0.24, shade(L.skin, -0.15));
  studentHairSide(ctx, L, hx, hz, r, d);
  ctx.restore();
}

/** A classmate seen from the front (sitting behind you when you turn round), head down over the paper. */
export function drawStudentFront(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, L: StudentLook, pose: StudentPose) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  const sw = 0.2 * L.build;
  const shZ = 0.95 + Math.sin(pose.phase * 1.6) * 0.004;
  ell(ctx, 0, 0, 0.32, 0.05, "rgba(0,0,0,0.22)");
  stroke(ctx, [[-0.19, 0], [-0.19, 0.46]], 0.022, "#3c3f45");
  stroke(ctx, [[0.19, 0], [0.19, 0.46]], 0.022, "#2c2e33");
  // knees + shins under the desk
  limb(ctx, [[-0.08, 0.5], [-0.09, 0.08]], 0.11, litH(ctx, -0.15, 0, L.bottom, 0.12));
  limb(ctx, [[0.08, 0.5], [0.09, 0.08]], 0.11, litH(ctx, 0, 0.15, L.bottom, 0.12));
  const torsoCol = L.layer === "sweater" ? L.layerCol : "#eef1f4";
  shape(ctx, [[-0.155, 0.52], [-sw, shZ - 0.06], [-sw * 0.9, shZ + 0.02], [0, shZ + 0.04], [sw * 0.9, shZ + 0.02], [sw, shZ - 0.06], [0.155, 0.52]], litH(ctx, -sw, sw, torsoCol, 0.14), true);
  if (L.layer === "vest") shape(ctx, [[-0.14, 0.54], [-sw * 0.8, shZ - 0.06], [-0.05, shZ - 0.04], [0, shZ - 0.2], [0.05, shZ - 0.04], [sw * 0.8, shZ - 0.06], [0.14, 0.54]], L.layerCol, true);
  if (L.style !== "hijab") {
    // collar + school tie
    shape(ctx, [[-0.07, shZ + 0.03], [0, shZ - 0.04], [0.07, shZ + 0.03], [0.06, shZ - 0.03], [0, shZ - 0.09], [-0.06, shZ - 0.03]], "#fafbfc");
    shape(ctx, [[-0.016, shZ - 0.03], [0.016, shZ - 0.03], [0.026, shZ - 0.25], [0, shZ - 0.29], [-0.026, shZ - 0.25]], "#6b2333");
  }
  // forearms forward onto the desk
  const sleeve = L.layer === "sweater" ? L.layerCol : "#e4e8ee";
  const write = Math.sin(pose.phase * 7) * 0.012;
  limb(ctx, [[-sw * 0.95, shZ - 0.05], [-sw * 1.1, shZ - 0.2], [-0.13, 0.76]], 0.08, sleeve);
  limb(ctx, [[sw * 0.95, shZ - 0.05], [sw * 1.1, shZ - 0.2], [0.13 + write, 0.76]], 0.08, sleeve);
  ell(ctx, -0.13, 0.755, 0.04, 0.028, L.skin);
  ell(ctx, 0.13 + write, 0.755, 0.04, 0.028, L.skin);
  // head tilted down toward the paper
  const hz = shZ + 0.13;
  const rx = 0.082;
  const rz = 0.102;
  const down = { turn: 0, stare: false, angry: false, glintRed: false, blink: false, down: true };
  if (L.style === "hijab") {
    shape(ctx, [[-rx * 1.25, hz + rz * 0.2], [-rx * 1.2, hz - rz * 1.2], [-0.18, hz - 0.25], [0.18, hz - 0.25], [rx * 1.2, hz - rz * 1.2], [rx * 1.25, hz + rz * 0.2], [0, hz + rz * 1.18]], litH(ctx, -0.18, 0.18, L.hijab, 0.12), true);
    drawFace(ctx, hz - rz * 0.06, rx * 0.8, rz * 0.84, L.skin, { hair: L.hair }, down);
  } else {
    ell(ctx, 0, shZ + 0.04, 0.042, 0.05, shade(L.skin, -0.15));
    drawFace(ctx, hz, rx, rz, L.skin, { hair: L.hair }, down);
    const g = litH(ctx, -rx, rx, L.hair, 0.18);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, -hz - rz * 0.06, rx * 1.07, rz * 1.04, 0, Math.PI * 1.0, Math.PI * 2.0);
    ctx.fill();
    if (L.style === "long" || L.style === "ponytail") {
      shape(ctx, [[-rx * 1.05, hz + rz * 0.2], [-rx * 1.2, hz - rz * 1.6], [-rx * 0.8, hz - rz * 1.6], [-rx * 0.85, hz]], g, true);
      shape(ctx, [[rx * 1.05, hz + rz * 0.2], [rx * 1.2, hz - rz * 1.6], [rx * 0.8, hz - rz * 1.6], [rx * 0.85, hz]], g, true);
    }
    if (L.style === "curly") for (let i = 0; i < 6; i++) ell(ctx, -rx + (i * rx * 2) / 5, hz + rz * 0.8, rx * 0.35, rz * 0.3, g);
  }
  ctx.restore();
}
