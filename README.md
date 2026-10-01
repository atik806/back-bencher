# Back Bencher: Exam Cheating Simulator

A first-person comedy stealth game in Next.js. You sit at your desk in an exam hall with a phone in your lap.
Photograph the question, ask the (fictional) AI, bubble the answer, and don't let the invigilator catch you.

```bash
npm install
npm run dev        # http://localhost:3000   (use `npx next dev -p 3123` if 3000 is taken)
npm test           # engine + balance tests (Vitest)
npm run typecheck && npm run lint && npm run build
```

## Controls

| Action | Keyboard | Touch / mouse |
|---|---|---|
| Look down at your paper / back up at the room | `S` / `W` (or `↓` / `↑`) | 📄 / 👀 button, or tap the paper |
| Fill in a bubble, turn the page, submit | | click / tap on the paper |
| Phone out under the desk / hide it (panic button) | `Space` | 📱 button / red **HIDE** |
| Take a photo | Camera app lifts the phone over the paper: move the mouse to move the phone, **click** to snap, `Q` lowers it | drag + tap |
| Glance left / right | hold `A` / `D` (or `←` / `→`) | hold ‹ ›, or drag the view |
| Radar on/off · Pause | `M` · `Esc` | ⏸ |

## How it plays

- **Walk-in.** After the briefing you enter through the classroom door in first person, walk the aisle to your seat (footsteps, subtitles, the invigilator's warning) and sit down; then the clock starts. Skip with Enter.

- **You see the hall from your seat.** A glowing patch on the floor shows where each teacher is looking. It turns red when they can see your phone.
  Arrows at the screen edges point to teachers you can't currently see, and the radar shows the room from above.
- **Everything is first person.** Your desk is in front of you with the question paper on it (a real interactive sheet projected onto the desk). Look down to read and answer; looking down means you can't see the teachers, so edge markers warn you.
- **The phone flow:** SPACE puts the phone in your lap under the desk (held in your hands) where you unlock it, then Camera lifts it over the paper, and you aim it at a question and click. It drops back under the desk into BrainGPT: send the photo (it keeps "thinking" in your pocket), then fill in the answer on the paper.
- **What gets you caught:** suspicion fills while a teacher or CCTV sees the phone. At 40% a teacher walks over to check your desk, and having the phone out then means instant expulsion. At 100% you're expelled. Ringtones, shutter clicks and AI pings make teachers turn toward you (fix it in Settings with Silent + Do Not Disturb). Snitches raise their hand. Craning your neck round while being watched looks like copying.
- **BrainGPT can be wrong**, sometimes confidently, more often on later exams. Easy questions are faster and safer to answer yourself.
- **5 exams:** Pop Quiz → Midterm → Semester Final → University Final → Board Exam (flying squad raid). Each is graded A+–F with ★–★★★; pass one (≥50%, not caught) to unlock the next. Two phone upgrades unlock along the way.

BrainGPT is fake: its answers are pre-written in `src/data/questions.ts`. There's no real AI, no camera access, and no network calls.

## Code map

```
src/engine/     pure TypeScript simulation, no React/DOM (fully unit-tested)
  game.ts       createGame / dispatch(action) / step(dt): teachers, detection, phone, noise, snitches, squad
  room.ts       hall layout + navigation graph + patrol routes
  geometry.ts   vision-cone maths      scoring.ts  grades/stars      rng.ts  seeded RNG
src/data/       levels.ts (5 exams) + questions.ts (58 Qs with BrainGPT's answer + confidence)
src/render/     pov.ts: first-person renderer (yaw + pitch + lean, your desk, paper quad) · homography.ts: maps the DOM paper onto the desk · characters.ts: procedurally drawn students
                (back/side/front views, uniforms, hair, hijabs) + teachers (faces, poses) · draw.ts: top-down radar
src/store/      zustand bridge: fixed-timestep loop, snapshots for React, events → toasts + SFX
src/components/ HUD, desk/PaperPage (the paper), phone/ (lap phone + Hands, CameraRig: raised phone over the paper, BrainGPT…), overlays
src/audio/      synthesised WebAudio SFX (no audio files)
tests/          engine.test.ts (rules), bot.test.ts (a careful bot can beat every level), homography.test.ts, intro.test.ts (walk-in path)
```

The engine is a flat 2D world and the first-person view is only a projection of it, so the game rules
don't depend on the renderer and the tests run without a browser.
