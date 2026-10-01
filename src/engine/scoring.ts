import type { GameState, Result } from "./types";

export function gradeFor(percent: number): string {
  if (percent >= 90) return "A+";
  if (percent >= 80) return "A";
  if (percent >= 70) return "B";
  if (percent >= 60) return "C";
  if (percent >= 50) return "D";
  return "F";
}

export function starsFor(percent: number, caught: boolean, maxSuspicion: number): number {
  if (caught || percent < 50) return 0;
  if (percent >= 80 && maxSuspicion < 50) return 3;
  if (percent >= 70) return 2;
  return 1;
}

export function computeResult(s: GameState): Result {
  const caught = s.status === "caught";
  const total = s.questions.length;
  let correct = 0;
  let answered = 0;
  s.answers.forEach((a, i) => {
    if (a === null) return;
    answered++;
    if (a === s.questions[i].correct) correct++;
  });
  // Expelled students score nothing, however well the paper was going.
  if (caught) correct = 0;
  const percent = total ? Math.round((correct / total) * 100) : 0;

  const latest = new Map<number, (typeof s.phone.replies)[number]>();
  for (const r of s.phone.replies) latest.set(r.question, r);
  let aiAnswersUsed = 0;
  let aiWrongTrusted = 0;
  latest.forEach((r) => {
    if (s.answers[r.question] !== r.answer) return;
    aiAnswersUsed++;
    if (!r.correct) aiWrongTrusted++;
  });

  const maxSuspicion = Math.round(s.maxSuspicion);
  return {
    correct,
    total,
    answered,
    percent,
    grade: caught ? "EXPELLED" : gradeFor(percent),
    stars: starsFor(percent, caught, maxSuspicion),
    caught,
    caughtReason: s.caughtReason,
    ghost: !caught && s.phoneEverOut && !s.everSeen && percent >= 50,
    honest: !caught && !s.phoneEverOut && percent >= 50,
    aiAnswersUsed,
    aiWrongTrusted,
    maxSuspicion,
    timeLeft: Math.max(0, Math.round(s.timeLeft)),
  };
}
