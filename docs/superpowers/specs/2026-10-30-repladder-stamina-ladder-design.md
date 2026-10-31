# Rep Ladder: stamina-scored ladder

## Why

The ladder promises "a small step" on every offer, and at set drops it lies. On a 5-set, 1 × 100, PACE 2, 10:00 slot, level 62 is 100 reps in 5:30 with 33 s rest; level 63 is 100 reps in 10:00 on 4 sets with 133 s rest. `eachRung` resets the length to LEn on each set drop, which undoes every rest cut before it. The owner ran into this and called it disingenuous. The user also repeats a level 2 to 6 times before pressing UP, and wants smaller steps so UP is easier to accept.

## Goals

- A higher level is never easier than the one before it, on any slot.
- Steps are small enough to accept sooner: about 1% typical on the owner's slot, against about 3% for the reset-fixed ladder at today's step sizes.
- The last level stays one set of LASt.

## Non-goals

- No stamina gauge on the watch. The score is a backend number; the user may want it for debugging, but this design doesn't add a display.
- No measuring the user's max and no new settings field. The score needs only one built-in constant.
- No change to LEVEL 0 (manual mode), `plan()`, the lead-in, the offer flow, or the LEn field's 15 s step.

## Anti-goals

- A ladder that hops around between unrelated sessions. A free search over all sessions got to 1–2% steps but went from 5 sets of 39 in 10:00 to 5 sets of 26 in 3:15, and up to 96 of its steps went flat or backward at another τ. One thing changes per level.

## The score

Rest is modelled like the W′ balance model from endurance sport: stamina drains per rep and refills exponentially in rest. The score of a session is the fresh max set needed to finish it.

```
D = 0, M = 0
for each set's reps r (from plan()):
  D = D * e + r
  M = max(M, D)
score = M
e = decay(rest / TAU), rest = (length - total * pace) / (sets - 1), 0 for one set
```

- `TAU = 90` seconds, a built-in constant. No published model covers this; 90 s is an estimate (see Evidence).
- For holds a "rep" is a second and pace is 1, which `plan()` already does.
- `decay(x)` is plain arithmetic, not `Math.exp`: `1 / (1 + x / 32)^32`, by five squarings. Espruino's `Math.exp` is excluded on `SAVE_ON_FLASH_EXTREME` builds, the Ollee's build is unknown and can't be tested in Beta 1, and an uncaught error disables a face on the watch. Swap to `Math.exp` once a real watch confirms it. It is 0.7178 against 0.7165 for x = 1/3.

## The ladder

`eachRung` keeps its contract: it calls `emit(total, length, sets)` per level in order until `emit` returns true. S, T, P and B are as they are today. `MIN_REST` stays 30. Stretches, in order:

1. **Add reps.** S sets, total from `S(S+1)/2` (or `10S` for holds) up to T, length `max(B, t * P + MIN_REST * (S - 1))`. The rep step is `ceil(T / 100)`, down from `ceil(T / 50)`. Holds keep their step of S.
2. **Cut time.** S sets, T total, length falling 5 s per level to the set count's floor `T * P + MIN_REST * (s - 1)`. The last step is clamped to land on the floor exactly.
3. **Drop sets.** For s from S - 1 to 2, the set drop keeps the current length, raised to s's floor if needed, then cuts 5 s per level to s's floor. **Guard:** a rung with fewer sets is skipped until its score reaches the score of the last rung with s + 1 sets, so no rung after a drop is easier. Inside one set count the score only rises, so it is checked only until the guard is met.
4. **Over target.** Only when S > 1. 2 sets at the rest floor, total T + o, T + 2o, ... with `o = ceil(T / 50)` and length `t * P + MIN_REST`. Stops before the first rung whose score reaches T, whose total passes 999, or whose length passes 5985 s, so no rung overruns the LCD.
5. **Goal.** `emit(T, T * P, 1)`.

The score is computed at set drops and in stretch 4, not on every rung, so `rungAt` and `maxLevel` stay close to today's cost per rung. Stretches 2 and 3 replace the 15 s cut and the reset to LEn.

## Results

From the throwaway model, with τ = 90 s and the real `plan()`:

| Slot | Levels | Top reached | 4 sets | 3 sets | 2 sets | Over target | Last level |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 5 sets, 100, PACE 2, 10:00 | 172 | 86 | 143 (5:20) | 150 (4:50) | 157 (4:20) | 164–171 (102–116) | 1 × 100 in 3:20 |
| push-ups, 5 sets, 100, PACE 3, 10:00 | 152 | 86 | 123 (7:00) | 130 (6:30) | 137 (6:00) | 144–151 | 1 × 100 in 5:00 |
| pull-ups, 5 sets, 50, PACE 3, 6:00 | 84 | 36 | 55 (4:30) | 62 (4:00) | 69 (3:30) | 76–83 (51–58) | 1 × 50 in 2:30 |
| plank, 5 holds, 5:00, 10:00 | 117 | 51 | 88 (7:00) | 95 (6:30) | 102 (6:00) | 109–116 (306–348 s) | 1 × 5:00 |

- A sweep of 2,556 setups (reps and holds, 1–9 sets, tops 20–500 reps or 60–1200 s, PACE 1–10, LEn 2:00–30:00) had no backward level and no rung `plan()` refused. Set drops were at most a 3.8% step.
- Before the guard, 426 of those setups had a set drop that scored lower.
- 6 setups run past 999 levels. `bump()`'s wrap catches LASt, SEtS, PACE and LEn on a level, but not the LEVEL field, so LEVEL's own step stops at 999 and then wraps to 0: `p.level < Math.min(999, maxLevel(p))`. Without that, LEVEL can reach 1000 from level 0 on a long ladder and overflow `pad3`.
- In stretch 1 the score only moves when the biggest set grows, about every fifth level, up to 11%. That's one rep of real work per level, so it stays.
- On the owner's slot, levels 44–62 of the old ladder are levels 86–140, and 100 in 5:30 is level 140.

## Evidence

- **What's tested:** the ordering at τ = 90, 120 and 180 s has no backward steps on the owner's slot. An earlier version of the path, with over-target reps running on to 140, had 16 flat or backward steps of 182 at τ = 60 s, 36 at 45 s and 60 at 35 s. Those are probably ties in stretch 1, but that isn't confirmed.
- **What's weak:** a single τ is a simplification; later W′ work finds two-phase recovery and τ varying by session. The rest-interval studies are heavy lifting, not high-rep push-ups, and point to τ of 35–60 s; nothing covers holds. τ can be refined with two max sets 60 s apart: `τ = -60 / ln(1 - second / first)`.
- **Holding PACE:** the score assumes every rep takes PACE seconds. Sets count down to the next set's start, so slowing down takes time from rest, and a session run slower than PACE is harder than its score. The owner runs PACE 2 and may drift toward 3 s in later sets; changing PACE rebuilds the ladder, so level numbers would move again.

## Constraints

- `repladder.min.js` is 6,170 bytes; the limit is 8,158 (`face-build.js`).
- Espruino: ES5 style, as the file already is.
- Block comments stay at 3 lines or fewer, per the repo owner's rule.

## Trade-offs the owner accepted

- More levels: 172 against 132 on the owner's slot, so the whole ladder takes longer unless UP comes sooner. About 500 sessions at 3 per level.
- Level numbers change, so each slot's level has to be set again, as when the ladder became computed.
- Sessions in stretch 4 exceed LASt's total. The owner put going over target on the table.

## What changes

- `repladder.js`: `eachRung`, `decay`, score, `TAU`, LEVEL's 999 stop in `bump()`, and their comments.
- `test/repladder-rungs.test.js` and `test/repladder-edit.test.js`: expected levels and new invariants (each rung's score is at least the last one's; set drops keep the length; over-target rungs score under T).
- `repladder.md`: the ladder section, its two tables, line 11's step description, and the note on level numbers changing.
- `repladder.min.js`: rebuilt.
- `local.json` (gitignored, the owner's): PUSH to `pace: 2`, `level: 140`.

## Left to the builder

- Function names, and whether the guard is a helper or inline.
- How the sweep becomes a test, as long as it covers reps, holds, one set and a LEn below the floor.

## On-watch check

Forge is in Beta 1: faces run in the emulator only, and deploying to the watch is planned for Beta 2. The emulator doesn't model speed or memory, so nothing here can be measured yet and this work ships without it. Once Beta 2 is out, two passes are needed on a real watch: holding A on LEVEL goes from level 1 to 172 in under 30 s (17 s is the 100 ms repeat with no slowdown), and a session on an over-target level runs to the end. Rung walks in EDIT run on every redraw, so this is the one performance risk the Node tests can't catch.
