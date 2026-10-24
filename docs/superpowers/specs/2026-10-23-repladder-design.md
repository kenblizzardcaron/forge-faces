# Rep Ladder face — design

## Intent

A Forge face for one specific push-up routine: a fixed number of push-ups spread over a fixed
total time, in sets whose rep count drops by one each set, with rest only *between* sets. The
user listens for beeps while working and glances at the watch between sets. It is a personal,
niche tool; it does not try to be a general interval timer.

## Goals

- Pace a session from four settings, all editable on the watch:

  | Setting | Default | Meaning |
  | --- | --- | --- |
  | Total push-ups | 100 | Sum of reps across all sets |
  | Total time | 10:00 | From the start of set 1 to the end of the last set |
  | Sets | 5 | Number of work blocks |
  | Seconds per push-up | 3 | Sets the length of each work block (not a per-rep beep) |

- No rest after the last set: the last push-up lands exactly at the total time.
- Audio is the primary interface; the screen is for glances between sets.

## Non-goals

- No beep on every rep (seconds per push-up only sizes the work blocks).
- No history, stats, or rep counting by sensor.
- No Bluetooth configuration (nice-to-have only; not in scope).
- No persistence across reboots — Forge has no storage; settings return to defaults.

## Anti-goals

- Totals that don't match the setting. The sets must sum to exactly the total push-ups.
- Ambiguity at a glance about whether you are working or resting.
- A session that "ends" into a rest period that never finishes.

## Session math

Let `T` = total push-ups, `n` = sets, `p` = seconds per push-up, `D` = total time in seconds.

**Rep split (user decision: hit the total exactly; extra reps go to the first sets).**
Base split declines by exactly 1: `b, b-1, …, b-n+1`, where
`b = floor((T + n(n-1)/2) / n)`. Remainder `r = T - (n·b - n(n-1)/2)`, `0 ≤ r < n`.
Add 1 rep to each of the first `r` sets.

- 100 / 5 → 22, 21, 20, 19, 18 (r = 0)
- 100 / 4 → 27, 26, 24, 23 (b = 26, r = 2)

**Timing.** Work block `i` lasts `reps_i · p` seconds. Total work `W = T · p`.
Each of the `n-1` rests lasts `(D - W) / (n-1)` seconds. With `n = 1` there is no rest.

- Defaults: work 66, 63, 60, 57, 54 s; four rests of 75 s.
- 100 / 4 / 10:00 / 3 s: work 81, 78, 72, 69 s; three rests of 100 s.

**Invalid settings** (refuse to start, show an error on the display): the last set would have
fewer than 1 rep, or `W > D`.

## Display

The watch has 2 day digits, 6 main digits (`HH:MM SS` layout with a colon), LAP and PM
indicators. Proposed layout (builder may refine within these rules):

| State | Day digits | Main digits | Indicators |
| --- | --- | --- | --- |
| Idle | blank or `GO` | First set's reps / summary | — |
| Lead-in | `GO` | 5 → 1 countdown | — |
| Work, set k | `Sk` (e.g. `S3`) | Time left in block `m:ss` + reps this set (e.g. `0:57 21`) | — |
| Rest after set k | `rk` (e.g. `r2`) | Rest left `m:ss` + next set's reps (e.g. `1:15 20`) | LAP blinks |
| Paused | as above | frozen | LAP steady/off |
| Done | `dn` (or similar) | Total push-ups | — |
| Editing | — | Field word for ~1 s, then the value being edited | — |

**Readable words (user decision).** Two-letter codes aren't obvious without the docs, so at each
change the main digits show a readable word for about a second, then the number. Main digits are
plain 7-segment (no M, W, or capital T/R), so words use lowercase where needed:

| Moment | Word ~1 s | Then |
| --- | --- | --- |
| Edit total reps | `Count` | e.g. `100` |
| Edit total time | `LEngth` | e.g. `10:00` |
| Edit sets | `SEtS` | e.g. `5` |
| Edit seconds per rep | `PACE` | e.g. `3` |
| Start | `StArt` | lead-in 5 → 1 |
| Pause | `PAUSE` | frozen countdown |
| Reset | `rESEt` | idle screen |
| Last set done | `donE` | stays |

Words stay exercise-neutral (`Count`, not `PUSHUP`) so the face suits squats, curls, etc.
No word flash at work↔rest changes; the beep covers those (the user is face-down then).

Must-haves from the user: current set number, rest countdown, and an obvious difference between
work and rest.

## Sounds

Three distinct sounds, none reused for two purposes:

| Moment | Sound |
| --- | --- |
| Lead-in (5 s after pressing start) | `Ollee.beepShort()` at 5, 4, 3, 2, 1 — multitimer's countdown cue |
| Each work↔rest change, incl. start of set 1 | One `Ollee.beep()` |
| End of the last set | multitimer's stock *beepbeepbeep* triple pattern (8 × 125 ms steps per 1 s period, beeps on steps 0–2) |

## Controls

Borrow multitimer's button conventions:

| Button | Does |
| --- | --- |
| **A** (idle) | Start: 5 s lead-in, then set 1 |
| **A** (running) | Pause / resume — resume continues the current block where it froze |
| **L** (paused) | Reset to idle, settings kept |
| **L** (idle) | Edit: total push-ups → total time → sets → seconds per push-up → done |
| **A** (editing) | Increment the field, hold to repeat, wrap at the top |
| Any button (finish ringing) | Silence the finish beeps |

## Constraints

- Forge face in this repo, same shape as multitimer: readable `repladder.js` + minified
  `repladder.min.js`, minified size ≤ 8158 bytes. `build.js` is hard-coded to multitimer and must be
  generalized to build both faces.
- Runs best on screen: Forge cancels face timers off screen and only wakes background faces once a
  minute. Keep time from timestamps (like multitimer) so the display is right on return.
- Max 4 timer slots shared by `setTimeout`/`setInterval`.

## Decisions made by the user

- All four settings editable; defaults 100 / 10:00 / 5 / 3.
- Reps decline by 1 per set; when uneven, hit the total exactly and extras go to the first sets.
- No rest after the last set.
- One beep at each work↔rest change.
- 5-second lead-in with multitimer's countdown beeps.
- Pause/resume plus reset.
- Finish uses multitimer's *beepbeepbeep*.
- Between sets the screen shows set number, rest countdown, and work vs rest clearly.
- Readable ~1 s words on the main digits at edits and control actions; exercise-neutral wording (`Count`).

## Calls made by Claude (user may override)

- Face name **Rep Ladder** (`repladder.js`) — chosen by the user.
- Day-digit labels (`Sk`, `rk`, `GO`, `dn`) and LAP blinking during rest.
- `LEngth` for total time ("TIME" can't render); no word flash at work↔rest changes.
- Main digits pair the countdown with this/next set's reps.
- Total time edited as minutes and seconds, like multitimer.
- Invalid settings refuse to start with an on-screen error.

## Left to the builder

- Edit ranges and step sizes for each field.
- How long the finish ring lasts (multitimer caps at 20 s on screen, 5 s off screen) and how the
  Done screen returns to idle.
- Behaviour off screen (reasonable default: mirror multitimer — catch up at the minute tick).
- Rounding when the rest time is not a whole number of seconds.
- Whether the rep/timing math lives in a pure function that a node script can test.
