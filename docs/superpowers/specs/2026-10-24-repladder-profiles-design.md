# Rep Ladder profiles — design

Supersedes the fixed ladder in [2026-10-24-repladder-levels-design.md](2026-10-24-repladder-levels-design.md).

## Intent

Rep Ladder works today for one niche: the user's push-ups, on a ladder hardcoded around 5 sets
and 100 reps (`rung()` and `PHASES` in `repladder.js`). The user wants it useful to more people
and more exercises from the same face: push-ups, pull-ups (lower reps, maybe different sets),
and planks (held for time, not counted).

So the ladder stops being fixed. Each exercise is a **profile** with a few settings, and every
level of its ladder is computed from them. A level number only means something within its own
profile; the user said that's fine and good.

The user will dogfood the result on the watch and give feedback, so first-guess tuning numbers
(rest floor, step sizes, plank minimums) are fine as long as they're easy to change.

## Goals

- **Computed ladder.** A profile's starting sets, top total and session time define its whole
  ladder: the easiest level, the step per level, where sets drop and how many levels there are.
  No magic level numbers like today's 10, 60, 70, 80.
- **No start to guess.** Level 1 is the easiest valid session. The user finds their place by
  scrolling LEVEL while the screen previews that level's session. No test set.
- **Profiles in slots.** One face holds several profiles (e.g. push-ups, pull-ups, planks),
  as many as fit the 8158-byte script limit. Each keeps its own current level.
- **Two exercise types.** *Reps* (counted, declining sets, paced) and *hold* (timed, equal holds,
  counted down).
- **Edit on the watch and bake in with `local.json`.** Both, per the user.
- **Everything else stays:** lead-in, beeps, rest split, the UP offer (A steps up, L stays),
  pause/reset, off-screen catch-up, and manual mode at LEVEL 0.

## Non-goals

- Storage. Forge has none; on-watch edits last until reboot or upload, then the baked-in
  profiles come back. When Forge gets storage, profiles go there (separate project).
- A GOAL setting. Removed in `e701029`; L on the offer keeps your level.
- Automatic promotion or judging a session. Only the user accepts a step up.
- Finishing above 1 set. Every ladder ends at one set of the top total (pull-ups: 1 × 50;
  planks: 1 × 5:00). Revisit only if dogfooding asks for it.
- Creating or deleting profiles, or changing a profile's type, on the watch.

## Anti-goals

- Any level that yields an invalid plan (`Er`). Every level 1…max must run.
- Steps between levels bigger than one small change, except the deliberate set drops.
- Accepting a level by accident (the ring-silencing press must still not answer the offer).
- Losing a profile's level by switching to another profile.

## Constraints

- **8158-byte script limit** (`MAX_BYTES` in `build.js`); `repladder.min.js` is 4695 bytes today.
  If the work doesn't fit, hold-type profiles are the piece to split into a follow-up; ask the
  user before cutting it.
- **Display:** 6 main digits, 2 day digits, 7-segment letters (check names with the emulator's
  Character set button). The first day digit only shows 1–3. Main digits right-align.
- **4 timer slots**, ES5 only, no `Map`/`Set`/`Promise`; an uncaught error disables the face
  (see `upstream/AGENTS.md`).
- Tests are `node --test` on `tools/harness.js`; the existing test files keep passing except
  where this design changes behavior.

## A profile

| Setting | Meaning on a level | Meaning at LEVEL 0 (manual) | Range (reps) | Range (hold) |
| --- | --- | --- | --- | --- |
| name | short LCD word shown when the profile is picked, e.g. `PUSH`, `PULL`, `PLAnK` | same | — | same |
| type | `reps` or `hold`; fixed per profile, not edited on the watch | same | — | — |
| sets | starting sets of the ladder | sets of the manual session | 1–9 | 1–9 |
| top | top total: reps, or seconds held | total reps / seconds of the manual session | 1–999 | 15 s steps |
| pace | seconds per rep | same | 1–20 | not used |
| base | session time every rung starts from (today's LEn on a level) | session length | 0:15–99:45 | same |
| level | current rung, 0 = manual | — | 0–max | 0–max |

Defaults shipped in `repladder.js` (my call; the user can override in `local.json`):

| Slot | name | type | sets | top | pace | base | level |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | PUSH | reps | 5 | 100 | 3 | 10:00 | 19 (5 sets, 51 reps; an average-adult start) |
| 2 | PULL | reps | 5 | 50 | 3 | 6:00 | 1 |
| 3 | PLAnK | hold | 5 | 5:00 | — | 10:00 | 1 |

## The computed ladder

Let S = sets, T = top, P = pace (1 for holds, so work time = seconds held), B = base,
F = 15 s, the minimum rest per gap (my call, first guess). For s sets and total t, the
**floor length** is t·P + F·(s−1): the shortest session that still leaves F of rest per gap.

1. **Add reps** (levels 1…): s = S. Total starts at the easiest valid session and grows by one
   step per level, capped at T.
   - Reps: start = S(S+1)/2 (reps drop by one per set, so 5 sets need 15); step = ⌈T/50⌉
     (T = 100 → +2, as today; T = 50 → +1).
   - Holds: start = 10 s per hold (S × 10); step = S s, i.e. +1 s per hold.
   - Length = max(B, floor length), so a short base never produces an invalid level.
2. **Cut rest**: total stays T; length drops 15 s per level while it stays ≥ the floor length.
3. **Drop a set**: s − 1, length resets to max(B, floor length), then cut rest again. Repeat
   down to s = 2.
4. **Top level**: 1 set of T, length = T·P (no rest).

Max level falls out of the math. Worked through with the defaults above:

| Profile | Levels | Top reached | 4 sets | 3 sets | 2 sets | Top level |
| --- | --- | --- | --- | --- | --- | --- |
| PUSH | 118 | L44: 5 × 100 in 10:00 | L61 | L79 | L98 | L118: 1 × 100 in 5:00 |
| PULL | 86 | L36: 5 × 50 in 6:00 | L47 | L59 | L72 | L86: 1 × 50 in 2:30 |
| PLAnK | 125 | L51: 5 × 60 s in 10:00 | L68 | L86 | L105 | L125: 1 × 5:00 |

Level numbers change from today's fixed ladder (the user's `local.json` level 45 becomes a
different session); the README must say so and give a few key rungs per default profile.

**Rep split:** reps keep today's declining split (`plan()`: extra reps to the first sets).
Holds are **equal**: T / s each, extra seconds to the first holds when it doesn't divide.

Changing sets, top, pace or base on a level recomputes the ladder; the level clamps to the new
max. Changing the profile's level by editing LEVEL is the only way to step back, as today.

**Keeping every level valid** (my calls, settled after review):
- On a level, top's range starts at the ladder start (S(S+1)/2 reps, or 10·S s for holds) and
  ends where T·P still fits 99:45. Raising sets raises top to the new start if needed.
- Max level is capped at 999 (the LEVEL display has 3 digits). An edit to base or top that
  would push it past 999 wraps to that field's minimum, like any field past its maximum.
- At LEVEL 0, manual mode keeps today's behavior: an impossible combination shows `Er`.

## On the watch

**Edit cycle** (L in idle; A raises, hold repeats, wraps — as today). One order for both modes,
so the fields mean the ladder's settings on a level and the session's settings at LEVEL 0:

PROFILE → LEVEL → Count (top) → SEtS → PACE → LEn → done

- **PROFILE** shows the profile's name on the main digits and steps through the slots. Switching
  loads that profile; each profile keeps its own level and settings until reboot.
- **LEVEL previews** the level's session while you scroll: sets on the day digits, level and
  total on the main digits (e.g. day ` 5`, main ` 19 51`). Holds show total seconds. The exact
  layout is the builder's within that content; `oFF` at 0, as today.
- On a level, the field word for top may read `toP` instead of `Count` (builder's call, check
  it on the Character set).
- Hold profiles skip PACE.

**Idle** stays `S1` + session time + set 1's reps; for holds, set 1's hold seconds instead of reps.
**Intro** shows the current profile's name instead of `LAddEr` (my call), so you know which
exercise is loaded when the face opens.

**Running a hold:** `S3` on the day digits and the hold's time left on the main digits, with no
rep count-up. Rest, beeps, pause and finish are unchanged. The lead-in spells the session the
same way, with the hold length in place of `rEP` (builder picks the word, e.g. `HOLd`).

**Offer** is unchanged: `UP` and the next level after a finish below the profile's max level.
`GOAL` flashes for 3 s when accepting the max level (today's level-100 behavior, now per profile).

## local.json

`local.json` keeps working and must be able to set the profile list and each profile's level,
e.g. `{"repladder": {"profiles": [{"name": "PUSH", "sets": 5, "top": 100, "level": 40}, …]}}`.
Today's `localize()` in `build.js` only swaps flat `key: value` pairs in `var settings = {…}`,
so it needs extending to replace the profiles literal. A misspelled key still fails the build.
The exact schema (whole-list replace vs per-slot merge, defaults for omitted fields) is the
builder's call; document it in the README.

## Left to the builder

- Code structure, data layout and how levels are computed (closed form vs walking the stretches),
  within the byte limit.
- Exact LCD wording and layouts not pinned above, checked on the emulator's Character set.
- Test coverage: a ladder test per default profile (level count, set-drop levels, every level a
  valid plan), plus edit-cycle, profile-switch and hold-running tests.
- README (`repladder.md`) rewrite: profiles, the computed ladder, key rungs per default profile,
  and that level numbers changed.

## My calls (for the user to check)

- Minimum rest F = 15 s per gap; rest cut 15 s per level; rep step ⌈T/50⌉; holds start at 10 s
  per hold and grow 1 s per hold per level.
- Default profiles PUSH / PULL / PLAnK with the settings above, PUSH starting at level 19.
- Intro shows the profile name; edit order puts LEVEL second and LEn last.
- Every ladder ends at 1 set; no on-watch profile creation.
- Top clamps to the ladder start and to 99:45 of work; max level capped at 999.
