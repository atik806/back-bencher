"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Action } from "@/engine/types";

/** How far you can twist round (radians). Past ~57° it starts to look like copying. */
export const LOOK_MAX = 1.9;

/**
 * Your head: hold A/D (or ←/→, the on-screen buttons, or drag the view) to glance left/right,
 * `down` tilts it toward the paper, and `underDesk` lowers the viewpoint for the phone.
 */
export function useHeadLook(act: (a: Action) => void, enabled: boolean, down: boolean, underDesk = false) {
  const yaw = useRef(0);
  const look = useRef(0);
  const duck = useRef(0);
  const hold = useRef({ left: false, right: false });
  const drag = useRef<number | null>(null);
  const sent = useRef(0);
  const live = useRef({ enabled, down, underDesk });
  useEffect(() => {
    live.current = { enabled, down, underDesk };
  });

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const set = (e: KeyboardEvent, on: boolean) => {
      if (on && e.target instanceof HTMLElement && e.target.closest("input, select, textarea, [contenteditable='true']")) return;
      const k = e.key.toLowerCase();
      if (k === "a" || k === "arrowleft") hold.current.left = on;
      else if (k === "d" || k === "arrowright") hold.current.right = on;
      else return;
      e.preventDefault();
    };
    const keydown = (e: KeyboardEvent) => set(e, true);
    const keyup = (e: KeyboardEvent) => set(e, false);
    const blur = () => {
      hold.current = { left: false, right: false };
      drag.current = null;
    };
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", blur);

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const h = hold.current;
      const { enabled: on, down: wantDown, underDesk: wantDuck } = live.current;
      let target = drag.current ?? (h.left && !h.right ? -LOOK_MAX : h.right && !h.left ? LOOK_MAX : 0);
      if (!on) target = 0;
      yaw.current += (target - yaw.current) * Math.min(1, dt * 5);
      const lt = wantDown ? 1 : 0;
      look.current += Math.sign(lt - look.current) * Math.min(Math.abs(lt - look.current), dt * 3.2);
      const crouch = wantDuck ? 1 : 0;
      duck.current = reducedMotion.matches
        ? crouch
        : duck.current + Math.sign(crouch - duck.current) * Math.min(Math.abs(crouch - duck.current), dt * 2.4);
      if (Math.abs(yaw.current - sent.current) > 0.03) {
        sent.current = yaw.current;
        act({ type: "look", yaw: yaw.current });
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", blur);
    };
  }, [act]);

  const getYaw = useCallback(() => yaw.current, []);
  const getLook = useCallback(() => look.current, []);
  const getDuck = useCallback(() => duck.current, []);
  const setHold = useCallback((dir: "left" | "right", on: boolean) => {
    hold.current[dir] = on;
  }, []);
  /** Drag fraction -1..1 across the view, or null on release. */
  const setDrag = useCallback((frac: number | null) => {
    drag.current = frac === null ? null : Math.max(-1, Math.min(1, frac)) * LOOK_MAX;
  }, []);

  return { getYaw, getLook, getDuck, setHold, setDrag };
}
