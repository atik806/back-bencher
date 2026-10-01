import type { RouteKind, Room, Seat, Vec } from "./types";
import { dist } from "./geometry";

// Layout constants, in world units (≈ one floor tile each).
export const MARGIN_X = 1.3;
export const COL_W = 2.4;
export const FRONT_Y = 3.3;
export const ROW0 = 4.7;
export const ROW_H = 1.75;
export const SEAT_DY = 0.55;
export const DESK_W = 1.35;
export const DESK_H = 0.62;
/** World-space distance between alternating footfalls. */
export const STEP_LENGTH = 0.72;

/**
 * Builds the hall plus a navigation graph: one vertical lane between every pair
 * of desk columns, joined by a front aisle and a back aisle. Teachers only ever
 * walk along this graph, so desks never need collision checks.
 */
export function buildRoom(cols: number, rows: number): Room {
  const laneX = Array.from({ length: cols + 1 }, (_, i) => MARGIN_X + i * COL_W);
  const rowY = Array.from({ length: rows }, (_, r) => ROW0 + r * ROW_H);
  const width = laneX[cols] + MARGIN_X;
  const backY = rowY[rows - 1] + SEAT_DY + 1.15;
  const height = backY + 0.9;
  const teacherDesk = { x: width / 2, y: 1.95 };

  const nodes: Vec[] = [];
  const adj: number[][] = [];
  const add = (p: Vec) => {
    nodes.push(p);
    adj.push([]);
    return nodes.length - 1;
  };
  const link = (a: number, b: number) => {
    adj[a].push(b);
    adj[b].push(a);
  };

  // Vertical lanes: front, beside each row's seats, back.
  const laneYs = [FRONT_Y, ...rowY.map((y) => y + SEAT_DY), backY];
  const laneNodes: number[][] = laneX.map((x) => {
    const ids = laneYs.map((y) => add({ x, y }));
    for (let i = 1; i < ids.length; i++) link(ids[i - 1], ids[i]);
    return ids;
  });

  // Back aisle joins the lanes directly.
  for (let i = 1; i < laneNodes.length; i++) link(laneNodes[i - 1][laneYs.length - 1], laneNodes[i][laneYs.length - 1]);

  // Front aisle: lane fronts plus the teacher's exit point and the door, sorted by x.
  const sideX = teacherDesk.x + 1.75;
  const deskExit = add({ x: sideX, y: FRONT_Y });
  const doorNode = add({ x: width - 0.45, y: FRONT_Y });
  const front = [...laneNodes.map((l) => l[0]), deskExit, doorNode].sort((a, b) => nodes[a].x - nodes[b].x);
  for (let i = 1; i < front.length; i++) link(front[i - 1], front[i]);

  // Teacher's chair → round the side of the desk → front aisle.
  const seatNode = add({ x: teacherDesk.x, y: 1.25 });
  const sideNode = add({ x: sideX, y: 1.25 });
  link(seatNode, sideNode);
  link(sideNode, deskExit);

  return { cols, rows, width, height, laneX, rowY, frontY: FRONT_Y, backY, teacherDesk, nodes, adj, seatNode, doorNode };
}

export const deskPos = (room: Room, s: Seat): Vec => ({ x: room.laneX[s.c] + COL_W / 2, y: room.rowY[s.r] });
export const seatPos = (room: Room, s: Seat): Vec => ({ x: room.laneX[s.c] + COL_W / 2, y: room.rowY[s.r] + SEAT_DY });

/** Lane node next to a seat (the side a teacher would stand on). */
export function besideSeat(room: Room, s: Seat, preferRight: boolean): Vec {
  const lane = preferRight ? s.c + 1 : s.c;
  return { x: room.laneX[lane], y: room.rowY[s.r] + SEAT_DY };
}

export function laneNode(room: Room, lane: number, row: number | "front" | "back"): number {
  const y = row === "front" ? room.frontY : row === "back" ? room.backY : room.rowY[row] + SEAT_DY;
  return nearestNode(room, { x: room.laneX[lane], y });
}

export function nearestNode(room: Room, p: Vec): number {
  let best = 0;
  let bestD = Infinity;
  room.nodes.forEach((n, i) => {
    const d = dist(n, p);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/** Dijkstra over the (tiny) nav graph. Returns node ids from `from` to `to` inclusive. */
export function findPath(room: Room, from: number, to: number): number[] {
  const n = room.nodes.length;
  const d = new Array<number>(n).fill(Infinity);
  const prev = new Array<number>(n).fill(-1);
  const done = new Array<boolean>(n).fill(false);
  d[from] = 0;
  for (let k = 0; k < n; k++) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && (u === -1 || d[i] < d[u])) u = i;
    if (u === -1 || d[u] === Infinity) break;
    if (u === to) break;
    done[u] = true;
    for (const v of room.adj[u]) {
      const nd = d[u] + dist(room.nodes[u], room.nodes[v]);
      if (nd < d[v]) {
        d[v] = nd;
        prev[v] = u;
      }
    }
  }
  if (from !== to && prev[to] === -1) return [from];
  const path: number[] = [];
  for (let c = to; c !== -1; c = prev[c]) path.unshift(c);
  return path;
}

/** Waypoints (node ids) where a patrolling teacher stops and looks around. */
export function buildRoute(room: Room, kind: RouteKind): number[] {
  const all = room.laneX.map((_, i) => i);
  const mid = Math.floor(room.rows / 2);
  let lanes: number[];
  switch (kind) {
    case "perimeter":
      return [laneNode(room, 0, "front"), laneNode(room, 0, mid), laneNode(room, 0, "back"), laneNode(room, room.cols, "back"), laneNode(room, room.cols, mid), laneNode(room, room.cols, "front")];
    case "left-half":
      lanes = all.slice(0, Math.ceil(all.length / 2));
      break;
    case "right-half":
      lanes = all.slice(Math.floor(all.length / 2)).reverse();
      break;
    case "snake-reverse":
      lanes = all.slice().reverse();
      break;
    default:
      lanes = all;
  }
  const route: number[] = [];
  lanes.forEach((lane, i) => {
    const ends: (number | "front" | "back")[] = i % 2 === 0 ? ["front", mid, "back"] : ["back", mid, "front"];
    for (const e of ends) route.push(laneNode(room, lane, e));
  });
  return route;
}
