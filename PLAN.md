# Back Bencher — Exam Cheating Simulator (v2) — Game Plan

> **Update 2026-10-01: built, and switched to first-person (POV).** The engine below is unchanged; the
> top-down hall became a first-person view from your seat (`src/render/pov.ts`) plus a top-down radar.
> Added a head-turn mechanic (A/D): craning round while watched raises suspicion. See README.md.

A top-down stealth simulator. You are a student in an exam hall with a phone in your lap.
Photograph the question paper, ask the in-game AI, bubble the answer on your OMR sheet,
and don't let the invigilator catch you. Comedy tone, arcade stakes.

Target: Next.js web game in `E:\cheating game v2`, desktop + mobile browser.

---

## 1. Review of v1 (`E:\Cheating Game`)

What v1 is: "Exam Hall Choices" — a quiz page with a **Use Phone** button and stat bars.

| Problem in v1 | Fix in v2 |
|---|---|
| Not a simulator — the teacher is a stat bar, not a person in the room | Real exam hall: teacher walks a patrol route with a vision cone you can see |
| "Use Phone" is a single button → hint appears | Phone is a multi-step mini-game: unlock → camera → photo → AI app → read answer |
| Integrity meter + lecturing end screens; the game punishes the premise it's built on | Score is grade + not getting caught. Consequences are game-y (caught = expelled ending), not sermons |
| No space, no timing skill — nothing to *play* | Core skill is timing phone use to the teacher's back being turned |
| 90-second, 10-question single run, no levels | 5 levels with escalating security, star ratings, unlocks |
| Spec asked for Tailwind + tests; neither exists. Next 14, no git | Next 16 + Tailwind v4 + Vitest from day one, git init |

Keep from v1: the typed `Question` model, the local question bank idea, the 3 PNG assets as placeholders.

---

## 2. Core loop (one question)

```
 read question on paper ──► decide: know it?  ──yes──► bubble answer yourself (safe, fast)
                                   │ no
                                   ▼
        watch teacher ──► pull phone out (EXPOSED) ──► unlock ──► aim camera at paper
                                                                     │ hold steady
                                                                     ▼
        hide phone  ◄── read AI answer ◄── wait for AI (signal-dependent) ◄── snap photo
             │
             ▼
        bubble answer on OMR sheet ──► next question
```

The tension: every second the phone is **out** is exposure. You can hide it mid-step
(progress is kept for camera aim, the AI request keeps loading in your pocket), so the game is
a rhythm of *peek → hide → peek*.

---

## 3. Mechanics

### 3.1 Exam hall (top-down view)
- Grid of desks (e.g. 6×5). Player at a fixed seat chosen per level (back corner = easy, front row = hard).
- NPC students: fidget, write, occasionally cause **distractions** (sneeze, dropped pen, asks for extra sheet) that pull the teacher's attention — free windows for you.
- Teacher's desk at the front, door, clock on the wall (exam timer).

### 3.2 Teacher AI (state machine)
| State | Behaviour |
|---|---|
| `Patrol` | Walks a waypoint route, pauses at random desks, looks around |
| `Seated` | At desk, reading/on own phone; glances up every few seconds (telegraphed by a "!" head tilt 0.5s before) |
| `Distracted` | Handling an NPC event — facing away |
| `Suspicious` | Heard/saw something; walks toward the source, cone widens |
| `Investigating` | Stands at your desk ~3s. Phone out now = instant caught |
| `Caught` | Game over cutscene |

**Detection**: vision cone (angle + range, rendered on the floor). If the phone is out *and* you're
inside the cone, the teacher's **suspicion meter** fills — faster when close and centred, slower at the
cone's edge. Meter decays slowly when you're clean. Thresholds: 40% → Suspicious, 100% → Caught.

**Noise events** add suspicion even outside the cone: camera shutter sound (if you forgot to
mute), screen flash, phone vibrating from a notification (random — silence notifications in Settings
first), dropping the phone (fumbled input).

### 3.3 Phone (React overlay, slides up from bottom)
Apps on the fake home screen:
1. **Lock screen** — swipe/pattern unlock (~0.7s skill check). Face-unlock upgrade skips it.
2. **Settings** — toggles: Silent mode, Brightness, Do Not Disturb. Doing this *before* cheating is the smart play; forgetting = noise risk.
3. **Camera** — the question paper appears in the viewfinder; a jittery framing box must be held over the current question for ~1.2s until focus locks. Moving the phone blurs it. Snap.
4. **BrainGPT** (fictional AI chat) — photo is "uploaded"; a typing indicator runs for 2–8s depending on the **signal bar** (weak in some seats/levels). Then it answers with a letter and a confidence %.
   - The AI is **sometimes wrong** (hallucination rate per level, higher on hard questions). Low-confidence answers are a hint to double-check with your own brain.
5. **Battery** drains with screen-on time. 0% = no more phone this exam.

All AI answers are **prewritten in the question bank** — no real AI API, no real camera. That keeps the
game free to run, offline, deterministic for tests, and means the game can't be pointed at a real exam paper.

### 3.4 Answer sheet (OMR)
- Bubble grid A–D per question; clicking fills with a pencil scribble animation (~0.4s).
- Erasing costs time. Unanswered = 0.
- You can also just answer yourself: questions are a mix of easy (you'd know it), medium, and absurd/hard (you need the phone).

### 3.5 Exam timer & scoring
- Real-time exam clock per level (3–6 minutes).
- Grade from correct answers: A+ … F. Caught = **Expelled** (0, special ending).
- Stars: ★ pass, ★★ grade ≥ B, ★★★ grade A and teacher's max suspicion stayed under 50%.
- Bonus: "Ghost" (phone never seen), "Honest Hero" (zero phone use and still passed).

---

## 4. Levels

| # | Exam | Security | New mechanic |
|---|---|---|---|
| 1 | Class Quiz | One sleepy teacher, mostly `Seated` | Tutorial: phone flow, cone, hiding |
| 2 | Midterm | Patrolling teacher | Notifications/noise, battery |
| 3 | Semester Final | 2 invigilators, crossing patrols | Snitch classmate (sees you → raises hand) |
| 4 | University Final | + CCTV dome with rotating cone, weak-signal seat | AI hallucination rate up |
| 5 | Board Exam | + Flying Squad: random raid, everyone checked row by row | Pocket phone deep vs. quick-access trade-off |

Unlocks between levels (cosmetic + small perks): phone skins, face unlock, faster camera focus,
"BrainGPT Pro" (lower wrong-answer rate).

---

## 5. Controls

| Action | Desktop | Mobile |
|---|---|---|
| Pull out / hide phone | `Space` (hold-to-peek mode optional) | Hold the phone button |
| Phone UI | Mouse | Touch |
| Fill bubble | Click | Tap |
| Look at paper / sheet | `Tab` toggles paper ↔ OMR | Swipe |
| Pause | `Esc` | Pause button |

Panic hide must be one input and always work instantly — it's the game's core "skill button".

---

## 6. Tech stack

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind CSS v4**
- **Canvas 2D** for the exam hall (desks, NPCs, teacher, vision cones) — plain `requestAnimationFrame`, no game engine needed at this scale
- **React DOM** for phone overlay, OMR sheet, HUD, menus (easy UI, accessible)
- **Zustand** for UI-facing state; the engine runs outside React and publishes a snapshot ~10×/s
- **Framer Motion** for phone slide/app transitions
- **Howler.js** for SFX (shutter, footsteps, notification buzz, pencil)
- **Vitest** for engine unit tests
- `localStorage` for progress/stars/unlocks
- No backend, no auth, no external APIs

## 7. Architecture

```
src/
  app/
    page.tsx                 title screen
    play/[level]/page.tsx    game route
    layout.tsx, globals.css
  engine/                    PURE TS — no React, no DOM, fully unit-tested
    types.ts                 GameState, Teacher, Student, PhoneState, Question
    rng.ts                   seeded RNG (reproducible runs + tests)
    loop.ts                  fixed-timestep tick(state, input, dt) → state
    teacher.ts               state machine + patrol pathing
    vision.ts                cone-vs-point test, suspicion fill/decay
    phone.ts                 phone state machine (locked→camera→focus→uploading→answer)
    noise.ts                 noise events → suspicion
    npc.ts                   student fidgets, distractions, snitch
    scoring.ts               grade, stars, bonuses
    levels.ts                level configs (seats, routes, timers, rates)
  data/
    questions.ts             question bank per level w/ prewritten AI answers + confidence
  render/
    hall-canvas.tsx          canvas component, draws snapshot
    draw.ts                  desks, sprites, cones, "!" indicators
  components/
    phone/ PhoneOverlay, LockScreen, Settings, Camera, BrainGPT, HomeScreen
    sheet/ QuestionPaper, OmrSheet
    hud/   ExamClock, SuspicionMeter, Battery, Signal
    screens/ Title, LevelSelect, Briefing, Results, CaughtCutscene
  store/ game-store.ts       zustand bridge: engine snapshot + player input queue
  audio/ sfx.ts
tests/   engine/*.test.ts
```

Key rule: **all game logic lives in `engine/` and is pure** — `tick(state, input, dt)`.
React only renders and forwards input. This is what makes it testable and keeps frame rate stable.

### Question data shape
```ts
type Question = {
  id: string;
  level: number;
  difficulty: "easy" | "medium" | "hard" | "absurd";
  prompt: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  ai: { answerIndex: 0 | 1 | 2 | 3; confidence: number; reply: string }; // may be wrong on purpose
};
```

---

## 8. Build milestones

| # | Milestone | Done when |
|---|---|---|
| M1 | Scaffold | Next 16 + Tailwind + Vitest + git; title screen; lint/build green |
| M2 | Engine core | Seeded RNG, fixed-step loop, teacher patrol + vision cone + suspicion, tests |
| M3 | Hall renderer | Canvas draws desks, students, teacher walking with visible cone |
| M4 | Phone flow | Out/hide, unlock, camera focus, BrainGPT delay + answer, exposure wired into suspicion |
| M5 | Paper + OMR | Question paper view, bubble sheet, timer, grading → Results screen |
| M6 | Level 1 playable end-to-end | Tutorial prompts, caught cutscene, stars saved |
| M7 | Noise + NPCs | Silent mode, notifications, battery, distractions, snitch |
| M8 | Levels 2–5 | 2 teachers, CCTV, signal, flying squad, unlocks |
| M9 | Polish | SFX, animations, mobile layout/touch, pause, settings, reduced-motion |
| M10 | Verify | Tests, typecheck, build, playtest in Chrome (desktop + phone viewport) |

Tests to cover: cone hit/miss geometry, suspicion fill/decay rates, state transitions (patrol→suspicious→investigate→caught),
phone state machine incl. hide-mid-step, battery drain, noise events, grading/stars, timer end, seeded determinism.

---

## 9. Art & audio direction
- Flat top-down, chunky outlines, warm classroom palette (chalk-green board, wood desks, cream paper).
- Teacher readable at a glance: big head, glasses that flash when looking your way, red-tinted cone when suspicious.
- Phone UI is the "hero" — crisp, believable fake OS, dark mode.
- Sprites: start with procedural shapes (ships fast), swap in drawn sprites later; v1's PNGs as placeholders.
- Heartbeat audio that speeds up with suspicion.

## 10. Open decisions (defaults chosen unless you say otherwise)
- **Name**: "Back Bencher" (alt: "Exam Heist", "Phone Under The Desk").
- **Perspective**: ~~top-down 2D~~ → **first-person desk view** (chosen 2026-10-01), with a top-down radar to keep the spatial strategy.
- **Question content**: general-knowledge + funny absurd questions (not tied to any real syllabus).


---

## 11. v2.2: true first person (desk, paper, hands): implemented 2026-10-02

Reviewed against the request: "a table with the question paper on it; taking the picture is shown in first person with
your hands; asking GPT happens under the desk."

| Piece | How it works |
|---|---|
| Camera | Pinhole camera with yaw **and pitch** + lean. Room view: sitting back, slight downward tilt so your desk is always along the bottom of the screen. `S` tilts down and leans over the paper (auto-framed to fill the screen on any device). |
| Your desk + paper | Your desk is drawn in 3D (pencil, eraser). The question paper is a real DOM sheet (pages of 4 Qs, bubbles, submit) mapped onto the desk with a CSS `matrix3d` homography, so it moves with your head and stays clickable. |
| Phone under the desk | SPACE: the view keeps the room above the desk's front edge; below it is your dark lap with the phone held in both hands (SVG hands, thumbs on the bezel). Unlock, Settings, BrainGPT, Messages all happen here. |
| Taking the photo | Opening Camera lifts the phone over the paper in both hands and tilts your head down. The mouse/finger moves the phone; the inverse homography tells which question is under the lens, and the viewfinder shows that part of the actual sheet (blurred until focused, shaking with suspicion). Click = snap, then the phone drops back under the desk into BrainGPT. |
| Risk of looking down | While reading or photographing you can't see the room; teacher markers (❗ when they're about to look up) pin to the screen edges. |

| Walk-in intro (2026-10-02) | After "Start exam" the engine enters `intro` (classmates animate, clock stopped). `render/intro.ts` plans door → aisle → your seat over the nav graph; the camera walks it at 1.45 m/s with head bob, glancing across the class, then turns to the board and sits (eye 1.64 → 1.34 m). Letterbox + subtitles + footsteps; Enter skips. |
| Classmate reactions (2026-10-02) | Stare at a neighbour (head turned, ~1 s, within 3.6 m) and they turn round: lvl 1 "I'm not going to help you." → lvl 2 annoyed + "Shh!" → lvl 3 shout for the teacher (+15 suspicion, teachers turn). |
