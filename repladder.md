# repladder.js

[Source](repladder.js) · upload [repladder.min.js](repladder.min.js) to the watch · [Open in emulator](https://kenblizzardcaron.github.io/forge-faces/?face=repladder) · [All faces](README.md)

A progression coach for your wrist, for push-ups, pull-ups, planks or any exercise you count in reps or hold for time. Each session splits the work into sets, paces them with beeps at every work and rest change, and counts reps up (or a hold down) as you go, so you stay on tempo without watching the screen.

The face holds five **slots**, one per exercise. In each slot you choose reps or a hold and the **last level**, always one set: 1 × 50 pull-ups, 1 × 100 push-ups, a single 5:00 plank. The slot works out a ladder of levels that climbs to it, and remembers your level. Level numbers only mean something within their own slot.

Each slot runs in one of two modes, picked by LEVEL:

- **Ladder (LEVEL 1 and up, the default):** LEVEL picks the whole session from the slot's ladder. After each session the face offers the next level, a small step: a couple more reps, a little less rest, or one fewer set. **A** steps up, **L** stays put.
- **Manual (LEVEL 0, shown as `oFF`):** no ladder and no offer. Count (the LASt field becomes Count), SEtS, PACE and LEn are the session itself.

## Slots

| Field | On a level | At LEVEL 0 |
| --- | --- | --- |
| **TYPE** | `rEPS` or `HOLd`; switching keeps the number (a hold rounds it up to 5 s) | same |
| **LASt** / **Count** | the last level: one set of this many reps, or a hold this long | total reps, or seconds for a hold |
| **SEtS** | starting sets of the ladder (1–9) | sets |
| **PACE** | seconds per rep (1–20); holds have none | seconds per rep |
| **LEn** | session time every rung starts from (0:15–99:45, 15 s steps) | session length |

The face ships with five identical slots, `SLOt 1` to `SLOt 5`: reps, last level 1 × 50, 5 starting sets, PACE 3, 10:00, level 1 (5 sets of 15 reps). Name and preset your own in [local.json](#localjson). Some ladders, for example:

| Slot | Type | Ladder | Levels |
| --- | --- | --- | --- |
| push-ups | reps | 5 sets → 1 × 100, PACE 3, 10:00 | 118 |
| pull-ups | reps | 5 sets → 1 × 50, PACE 3, 6:00 | 86 |
| plank | hold | 5 holds → 1 × 5:00, 10:00 | 125 |

## The ladder

Every ladder climbs in three stretches, then ends at one set of the top total:

1. **Add reps.** Starting sets stay fixed while the total grows from the easiest valid session to the top. Reps drop by one per set, so 5 sets start at 15 reps (5+4+3+2+1). The total grows by 1 rep per level, or more for big tops (Count ÷ 50, rounded up: +2 for 100). Holds start at 10 s per hold and grow 1 s per hold per level.
2. **Cut rest.** The total stays at the top while the session gets 15 s shorter per level, down to 15 s of rest between sets.
3. **Drop a set.** One fewer set, the session time resets, and the rest cuts start again, down to 2 sets.

The last level is one set of the top total with no rest: Count × PACE, or the whole hold.

Key rungs of those three:

| Slot | Top reached | 4 sets | 3 sets | 2 sets | Last level |
| --- | --- | --- | --- | --- | --- |
| push-ups | 44: 5 sets, 100 in 10:00 | 61 | 79 | 98 | 118: 1 × 100 in 5:00 |
| pull-ups | 36: 5 sets, 50 in 6:00 | 47 | 59 | 72 | 86: 1 × 50 in 2:30 |
| plank | 51: 5 × 60 s in 10:00 | 68 | 86 | 105 | 125: 1 × 5:00 |

You never have to guess where to start: scroll LEVEL and the screen previews each level's sets and total, so stop at what you can do today.

Changing LASt, SEtS, PACE, LEn or TYPE on a level reshapes the ladder. LASt can't go below the ladder's easiest session, the level moves down if the ladder got shorter, and a change that would make the ladder longer than 999 levels wraps that field back to its minimum. Every level runs.

Reps split into declining sets; when the total doesn't divide evenly, the extra reps go to the first sets (100 in 4 sets → 27, 26, 24, 23). Holds are equal (5:00 in 4 holds → 75 s each). Rest is split evenly between sets, with none after the last.

## Buttons

| Button | Does |
| --- | --- |
| **A** (idle) | Start, with a 5 s lead-in that shows the session |
| **A** (running) | Pause / resume |
| **L** (paused) | Reset |
| **L** (idle) | Edit: SLOt → TYPE → LASt → LEVEL → SEtS → PACE → LEn → done (holds skip PACE) |
| **A** (editing) | Raise the value (hold to repeat; it wraps to the minimum after the maximum) |
| **A** (offer) | Accept the next level and return to idle |
| **L** (offer) | Keep the level and return to idle |
| Any button (finish beeping) | Silence and return to idle; after a ladder finish below the last level, the offer follows |

## Screen

| Screen | Shows |
| --- | --- |
| Intro | The slot's name (`SLOt 1`) for 1 s when the face opens idle; any button skips it |
| Idle | `S1` on the day digits (S for set, so it reads like `51`), total time and set 1's reps (or hold seconds) on the main digits (`10:00 21`); `Er` when manual settings can't work |
| Edit SLOt | The slot number on the day digits and the slot's name on the main digits |
| Edit TYPE | `rEPS` or `HOLd` |
| Edit LASt | ` 1` (one set) on the day digits and the last level's total on the main digits (`    50`, or ` 5:00` for a hold) |
| Edit LEVEL | The level's sets on the day digits, the level and its total on the main digits (` 39 91`); `oFF` at level 0 |
| Offer | `UP` and the next level on the main digits (`UP  40`) after a ladder finish below the last level |
| Last level | `GOAL` for 3 s when you accept the slot's last level |
| Lead-in | 5 to 1 on the day digits while the main digits spell out the session, one per second: `rEP 91` (or `HOLd`), `10:00`, `SEtS 5`, `LEU 39`, then `GO` with set 1's reps (`GO  21`). At level 0, `PACE 3` in place of the level (`oFF` for a hold) |
| Work | `S3`, time left and the rep you should be on, counting up once per PACE seconds; a hold shows only its time left |
| Rest | `r2`, rest left and next set's reps (or hold seconds), with LAP blinking |
| Done | `donE` |

Each edit field and control shows its word for 1 s, or until the next press. The LCD can't draw a V, so LEVEL reads `LEUEL`; the others are `LASt`, `Count`, `SEtS`, `PACE`, `LEn`, `PAUSE`, `rESEt` and `Error`. At the last level and at level 0, the finish has no offer.

## Sounds

- Short high beeps at 5-4-3-2-1 for the lead-in.
- One beep at each work ↔ rest change, including set 1 starting.
- *beepbeepbeep* at the end, for 10 s (5 s on another face).

## Off screen

Forge only wakes a background face once a minute, so a change while you're on another face beeps at the next minute tick (one beep, however many changes were missed). The face shows the right time when you come back.

## local.json

Forge has no storage yet, so on-watch edits last until the watch reboots or the face is uploaded; then the built-in slots come back. To keep your own, bake them into a personal build with a `local.json` (see [All faces](README.md)):

```json
{"repladder": {"profile": 0, "profiles": [
  {"name": "PUSH", "sets": 5, "top": 100, "pace": 3, "base": 600, "level": 39},
  {"name": "PULL", "top": 50, "base": 360},
  {"name": "PLAnK", "hold": 1, "top": 300}
]}}
```

`profiles` replaces the whole list of slots (as many as fit the 8158-byte limit). Each needs a `name` (up to 6 LCD characters); the rest default to `hold: 0, sets: 5, top: 50, pace: 3, base: 600, level: 1`. `top` is the last level (seconds for a hold) and `base` is LEn in seconds. `profile` picks the slot the face boots on, counting from 0. A misspelled key, a nameless profile or a `profile` past the list fails the build.

Level numbers changed when the ladder became computed (the old fixed ladder had level 45 at 90 push-ups; on the push-up ladder above that's now about level 39), so set your level again after upgrading.
