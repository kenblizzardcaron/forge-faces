# Rep Ladder levels — design

## Intent

The user does Rep Ladder sessions to rebuild and then extend push-up capacity. Today they manage
90 in 5 sets over 10:00 (20+19+18+17+16) after an illness. Near goal: 100 again. Lofty goal,
possibly years away: 100 in one set (300 s at 3 s per rep, no rest). They want the face to
suggest a very slight step up after a session that felt good, never forcing it, with the option
to step back, and a goal they can change along the way.

## Goals

- **One fixed ladder of levels** that every user and every goal shares. Level N always means the
  same settings, so the level number alone restores your place.
- **Numbers that mean something.** Up to level 50, Count = level × 2 (level 45 = 90 push-ups).
- **Ladder on by default, with an opt-out** (user decision). The face starts at **level 25**
  (50 push-ups in 5 sets over 10:00), a fair start for an average adult. Level 0 means off:
  Count, LEn, SEtS and PACE are edited by hand exactly as today.
- **A goal**, itself a level. Default goal: **level 50** (100 in 5 sets over 10:00).
- **After a completed session below the goal**, the face offers the next level. **A** accepts,
  **L** keeps the current level. Nothing changes without an explicit yes.
- **Stepping back** is done by editing the level number.
- **Re-entry after reboot or upload**, by typing the level and goal back in on the watch
  (Forge faces have no storage; the script restarts at each upload and boot). Getting from the
  default to the user's level is 20 taps of A, or a ~2 s hold.

## Non-goals

- Counts above 100. 100 is the user's ceiling.
- PACE on the ladder. Every rung uses PACE 3. A faster or slower pace means level 0 (manual).
- Automatic promotion, or judging whether a session "went well". Only the user decides.
- Storage or Bluetooth sync of the level.

## Anti-goals

- Accepting a level by accident. In particular, the press that silences the finish ring must not
  also accept the offer.
- An offer after a session that didn't finish (reset while paused).
- Offers past the goal. Once the goal is reached, the face stops nudging.
- Rungs that differ by more than one small change, except the deliberate set-count drops.

## The ladder

Every rung uses PACE 3. Work time is Count × 3 s. Rest is split as today.

| Levels | Sets | Count | LEn | Step per level |
| --- | --- | --- | --- | --- |
| 10–50 | 5 | level × 2 (20 → 100) | 10:00 | +2 reps |
| 51–59 | 5 | 100 | 9:45 → 7:45 | −15 s |
| 60–69 | 4 | 100 | 10:00 → 7:45 | −15 s (60 resets to 10:00) |
| 70–79 | 3 | 100 | 10:00 → 7:45 | −15 s (70 resets to 10:00) |
| 80–98 | 2 | 100 | 10:00 → 5:30 | −15 s (80 resets to 10:00) |
| 99 | 1 | 100 | 5:00 | the lofty goal: one set ends at Count × PACE, so LEn is set to match |

Key rungs: 25 = 50 push-ups (default start), 45 = 90 (the user today), 50 = 100 in 5 sets
(default goal), 60 = 100 in 4 sets over 10:00, 99 = 100 in one set. Each set drop lands on a
round level (60, 70, 80) and the top is 99 (user asked; 100 won't fit the two day digits).

Levels 1–9 don't exist: 5 sets need at least 15 reps, so level 10 (20 reps: 6+5+4+3+2) is the
floor. The level field steps 0, 10, 11, … 99 and wraps back to 0.

Rest per gap at a phase's start → end: 5 sets 75 s → 41 s, 4 sets 100 s → 55 s, 3 sets
150 s → 82 s, 2 sets 300 s → 30 s. The 2-set phase trims further so the final jump to one set
isn't a cliff. **The phase boundaries above 50 are Claude's call** and are expected to be tuned
over time. Keep them in one small table or formula in the source so retuning is a one-line edit.
Levels must stay ≤ 99 to fit the two day digits.

**Level 99 on screen (Claude's call).** Idle shows `5:00` with the day digits at `99`, and the
reps digits blank as they do today for any count over 99. During the set, the count-up shows
1–99 and goes blank for the 100th rep, the last 3 s before the finish ring.

## On the watch

**Edit flow.** **L** in idle now opens a level field first:

1. **Level** (word shown for 1 s like the other fields, e.g. `LEUEL`; the exact word is picked
   when it's checked in the emulator, since the display is 7-segment). **A** steps as above and
   wraps; holding repeats every 100 ms, as today.
2. **Goal** (word e.g. `GOAL`), shown only when level > 0. It steps 10 … 99 and wraps. Default 50.
3. If level is 0, the existing Count → LEn → SEtS → PACE fields follow. If level > 0, they're
   skipped, because the level sets them.

While stepping Level or Goal, the day digits show the number being edited and the main digits
preview that rung the way idle does (LEn and set 1's reps), so the user sees what the number means.

Choosing a level > 0 loads its Count, LEn, SEtS and PACE into the settings. Setting the level
to 0 leaves those values in place as the starting point for manual edits.

**Idle.** On the ladder, the day digits show the level number (`45`) instead of `S1`. The main
digits are unchanged (LEn and set 1's reps). Level 0 looks exactly as today.

**Finish and offer.** When a ladder session ends naturally (DONE) below the goal:
- The finish ring plays as today. A press during the ring only silences it.
- After that, the face shows the offer: that it's an offer, the next level's number, and how many
  levels remain to the goal. The exact layout is picked in the emulator check.
- **A** accepts: level + 1, settings load, back to idle. **L** declines: same level, back to idle.

When accepting reaches the goal, the face marks it once (e.g. a `GOAL` word for a few seconds),
then returns to idle. At or above the goal, DONE behaves as it does today: any press returns to
idle, with no offer.

Off the ladder (level 0), DONE behaves exactly as today.

## Constraints

- Plain ES5-style JavaScript that runs on Espruino. One self-contained file. Upload size matters,
  so keep the minified build small (currently about 3.3 KB).
- Four timer slots. No new long-lived timer should be needed; the offer is a state, not a timer.
- Level 0 must behave exactly as the face does today. Existing tests that rely on the old defaults
  (Count 100, 10:00, 5 sets, PACE 3) should set level 0 and those settings explicitly. They
  shouldn't be rewritten around level 25.
- The headless harness (`tools/harness.js`) and `node --test` are the gate. The minified build
  (`node build.js`) must pass the same min test.

## Left to the builder

- How the ladder is encoded: a phase table or a formula, as long as levels 10–99 match the table.
- State names, and whether the offer is a new state or a flag on DONE.
- Field and word order details beyond what's above, and the README update.
- Final words and offer layout, which are confirmed visually in the emulator by the controller.
