"use client";

import { forwardRef } from "react";
import type { Option, Question } from "@/engine/types";

// The sheet is laid out at a fixed size so the 3D projection and the phone camera
// can both work in the same "paper pixel" coordinates.
export const PAPER_W = 600;
export const PAPER_H = 733;
export const PER_PAGE = 4;
const HEADER = 74;
const ROW = 150;
const MARGIN_X = 26;

/** Where question slot `i` (0..PER_PAGE-1) sits on the sheet, in paper px. */
export const slotRect = (i: number) => ({ x: MARGIN_X, y: HEADER + 6 + i * ROW, w: PAPER_W - MARGIN_X * 2, h: ROW - 8 });

export const pageCount = (n: number) => Math.max(1, Math.ceil(n / PER_PAGE));

/** Which question (global index) is at paper point (u, v) on `page`, if any. `inset` shrinks the target. */
export function questionAt(page: number, total: number, u: number, v: number, inset = 0): number | null {
  for (let i = 0; i < PER_PAGE; i++) {
    const q = page * PER_PAGE + i;
    if (q >= total) break;
    const r = slotRect(i);
    if (u >= r.x + inset && u <= r.x + r.w - inset && v >= r.y + inset && v <= r.y + r.h - inset) return q;
  }
  return null;
}

interface Props {
  title: string;
  questions: Question[];
  answers: (Option | null)[];
  page: number;
  /** Interactive sheet on the desk vs. a picture of it (phone viewfinder). */
  onAnswer?: (q: number, option: Option | null) => void;
  onPage?: (p: number) => void;
  footer?: React.ReactNode;
  disabled?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export const PaperPage = forwardRef<HTMLDivElement, Props>(function PaperPage(
  { title, questions, answers, page, onAnswer, onPage, footer, disabled, style, className },
  ref,
) {
  const pages = pageCount(questions.length);
  const answered = answers.filter((a) => a !== null).length;
  const live = !!onAnswer;
  return (
    <div
      ref={ref}
      className={`paper absolute left-0 top-0 select-none overflow-hidden rounded-[3px] text-[#1d2433] shadow-[0_2px_0_rgba(0,0,0,0.08)] ${className ?? ""}`}
      style={{ width: PAPER_W, height: PAPER_H, transformOrigin: "0 0", ...style }}
    >
      {/* margin rule */}
      <div className="pointer-events-none absolute inset-y-0 left-[18px] w-[2px] bg-[#f1a3a3]/70" />
      <div className="absolute inset-x-0 top-0 flex items-center gap-3 border-b-2 border-[#1d2433]/70 bg-paper px-6" style={{ height: HEADER }}>
        <div className="flex-1">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/55">{title} · Question paper</div>
          <div className="font-script text-[24px] leading-6 text-[#13213d]">Name: ____________ Roll: ______</div>
        </div>
        <div className="text-right text-[12px] font-semibold leading-tight">
          Page {page + 1} / {pages}
          <br />
          <span className="text-black/55">Answered {answered}/{questions.length}</span>
        </div>
      </div>

      {Array.from({ length: PER_PAGE }, (_, i) => {
        const qi = page * PER_PAGE + i;
        const q = questions[qi];
        if (!q) return null;
        const r = slotRect(i);
        return (
          <div key={q.id} data-q={qi} className="absolute" style={{ left: r.x, top: r.y, width: r.w, height: r.h }}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-black/45">
              Q{qi + 1} · {q.subject}
            </div>
            <div className="font-script text-[23px] leading-[25px] text-[#13213d]">{q.prompt}</div>
            <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1" role={live ? "radiogroup" : undefined} aria-label={live ? `Answer for question ${qi + 1}` : undefined}>
              {q.options.map((o, j) => {
                const on = answers[qi] === j;
                const inner = (
                  <>
                    <span className="relative grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-2 border-[#1d2433]/75 text-[10px] font-bold">
                      {"ABCD"[j]}
                      {on && (
                        <span className="bubble-fill absolute inset-[2px] rounded-full bg-[#1d2433] [background-image:repeating-linear-gradient(45deg,transparent_0_2px,rgba(255,255,255,0.12)_2px_3px)]" />
                      )}
                    </span>
                    <span className="truncate text-[15px] leading-tight">{o}</span>
                  </>
                );
                return live ? (
                  <button
                    key={j}
                    role="radio"
                    aria-checked={on}
                    disabled={disabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAnswer?.(qi, on ? null : (j as Option));
                    }}
                    className={`flex min-w-0 items-center gap-2 rounded px-1 py-[3px] text-left ${on ? "bg-[#1d2433]/10" : "hover:bg-black/5"}`}
                  >
                    {inner}
                  </button>
                ) : (
                  <div key={j} className="flex min-w-0 items-center gap-2 px-1 py-[3px]">
                    {inner}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="absolute inset-x-0 bottom-0 flex h-[46px] items-center gap-2 border-t border-black/10 px-6 text-[13px]">
        {live && pages > 1 ? (
          <>
            <button
              disabled={page === 0}
              onClick={(e) => {
                e.stopPropagation();
                onPage?.(page - 1);
              }}
              className="rounded-md border border-black/20 px-3 py-1 font-semibold disabled:opacity-30"
            >
              ← Prev page
            </button>
            <button
              disabled={page >= pages - 1}
              onClick={(e) => {
                e.stopPropagation();
                onPage?.(page + 1);
              }}
              className="rounded-md border border-black/20 px-3 py-1 font-semibold disabled:opacity-30"
            >
              Next page →
            </button>
          </>
        ) : (
          <span className="text-black/40">— {page + 1} —</span>
        )}
        <div className="ml-auto">{footer}</div>
      </div>
    </div>
  );
});
