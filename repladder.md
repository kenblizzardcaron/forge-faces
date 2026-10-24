# repladder.js

[Source](repladder.js) · upload [repladder.min.js](repladder.min.js) to the watch · [Open in emulator](https://kenblizzardcaron.github.io/forge-faces/?face=repladder) · [All faces](README.md)

A rep-based progression coach for your wrist, for push-ups, squats, pull-ups or any exercise you count in reps. Each session splits your reps into declining sets (22, 21, 20, 19, 18), paces them with beeps at every work and rest change, and counts reps up as you go, so you stay on tempo without watching the screen.

On top of that sits a 100-level ladder, from 20 reps in five sets up to 100 in a single set. Level 45 means the same session for everyone, and the level number shows how far you've come. After you finish a session, the face offers the next small step (two more reps, a little less rest, or one fewer set). You accept or keep your level, and you set the goal and session time.

## Settings

Edit with **L** in idle. **A** raises the value (hold to repeat; it wraps to the minimum after the maximum). Level and Goal come first, then LEn on a level; Count, SEtS and PACE are edited only at level 0.

| Field | Default | Range |
| --- | --- | --- |
| **LEUEL** (ladder level) | 25 | 0 (off), 10–100 |
| **GOAL** (level to reach) | 100 | 10–100 |
| **Count** (total reps) | 50 | 1–999 |
| **LEn** (total time) | 10:00 | 0:15–99:45, 15 s steps; on a level, the session time every rung starts from |
| **SEtS** (sets) | 5 | 1–9 |
| **PACE** (seconds per rep) | 3 | 1–20 |

Reps drop by one per set; when the total doesn't divide evenly, the extra reps go to the first sets (100 in 4 sets → 27, 26, 24, 23). Rest is split evenly between sets, with none after the last.

## Levels

A level above 0 sets Count, LEn, SEtS and PACE from this ladder. Every rung uses PACE 3.

| Levels | Sets | Count | LEn | Step per level |
| --- | --- | --- | --- | --- |
| 10–50 | 5 | level × 2 (20 → 100) | LEn (10:00 default) | +2 reps |
| 51–59 | 5 | 100 | 9:45 → 7:45 | LEn − 15 s per level |
| 60–69 | 4 | 100 | 10:00 → 7:45 | LEn − 15 s per level (60 resets to 10:00) |
| 70–79 | 3 | 100 | 10:00 → 7:45 | LEn − 15 s per level (70 resets to 10:00) |
| 80–99 | 2 | 100 | 10:00 → 5:15 | LEn − 15 s per level (80 resets to 10:00) |
| 100 | 1 | 100 | 5:00 | one set of 100 |

The times above assume the default LEn of 10:00; a different LEn shifts every rung but level 100 by the same amount.

Levels 1–9 don't exist, since 5 sets need at least 15 reps; the level steps 0, 10, 11, … 100 and wraps to 0.

Level 0 is off: the manual Count, LEn, SEtS and PACE run as before.

The first day digit can only show 1–3, so levels live on the main digits.

## Buttons

| Button | Does |
| --- | --- |
| **A** (idle) | Start, with a 5 s lead-in that shows the session |
| **A** (running) | Pause / resume |
| **L** (paused) | Reset |
| **L** (idle) | Edit: LEUEL → GOAL → LEn → done on a level, or LEUEL → Count → LEn → SEtS → PACE → done at level 0 |
| **A** (editing) | Raise the value (hold to repeat) |
| **A** (offer) | Accept the next level and return to idle |
| **L** (offer) | Keep the level and return to idle |
| Any button (finish beeping) | Silence and return to idle; after a ladder finish below the goal, the offer follows |

## Screen

| Screen | Shows |
| --- | --- |
| Intro | `LAddEr` for 1 s when the face opens idle; any button skips it |
| Idle | `S1` on the day digits (S for set, so it reads like `51`), total time and set 1's reps on the main digits (`10:00 12`); `Er` when the settings can't work |
| Edit LEUEL / GOAL | The number on the main digits, with set 1's reps on the day digits when under 40 (`oFF` at level 0) |
| Offer | `UP` and the next level on the main digits (`UP  46`) after a ladder finish below the goal |
| Goal reached | `GOAL` for 3 s when accepting a level reaches the goal |
| Lead-in | 5 to 1 on the day digits while the main digits spell out the session, one per second: `rEP 90`, `10:00`, `SEtS 5`, `LEU 45`, `GO` (at level 0, `PACE 3` in place of the level) |
| Work | `S3`, time left and the rep you should be on, counting up once per PACE seconds |
| Rest | `r2`, rest left and next set's reps, with LAP blinking |
| Done | `donE` |

Each edit field and control shows its word for 1 s, or until the next press (`LEUEL`, `GOAL`, `Count`, `LEn`, `SEtS`, `PACE`, `PAUSE`, `rESEt`, `Error`). At or above the goal, and at level 0, the finish works as before with no offer.

## Sounds

- Short high beeps at 5-4-3-2-1 for the lead-in.
- One beep at each work ↔ rest change, including set 1 starting.
- *beepbeepbeep* at the end, for 10 s (5 s on another face).

## Off screen

Forge only wakes a background face once a minute, so a change while you're on another face beeps at the next minute tick (one beep, however many changes were missed). The face shows the right time when you come back.

Settings reset to defaults (level 25, goal 100) when the watch reboots or the face is uploaded (Forge has no storage yet). Type your level back in through LEUEL.
