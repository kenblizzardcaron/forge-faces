# Rep Ladder Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Rep Ladder's hardcoded 5-set/100-rep ladder with a ladder computed from per-exercise profiles (reps or hold), selectable in slots on the watch and bakeable via `local.json`.

**Architecture:** `repladder.js` gains a `profiles` array and a derived `session` object. Pure functions `rungAt(p, n)` / `maxLevel(p)` compute any level from a profile; `load()` copies the active profile's current level (or its manual fields at level 0) into `session`, which the existing draw/run code reads where it reads `settings.total/length/sets/pace` today. `build.js` learns to replace the `profiles` literal from `local.json`.

**Tech Stack:** ES5 JavaScript for the Ollee Forge (Espruino) watch, `node --test` with `tools/harness.js`, terser via `node build.js`.

**Spec:** `docs/superpowers/specs/2026-10-24-repladder-profiles-design.md`

## Delegation (applies to every task)

Every task below is a mechanical unit for a fresh `model: haiku` implementer subagent, gated by
`node --test` (all green) and `node build.js` (exits 0, so `repladder.min.js` ≤ 8158 bytes). The
controller (Opus) reviews each diff, runs the gates itself, and does the two non-delegated
steps: the LCD-word check (Task 6) and the README rewrite (Task 7, text-out).

Run the gates serially: `node build.js && node --test`. Commit `repladder.min.js` with every
task that changes `repladder.js`.

## Global Constraints

- Script limit 8158 bytes (`MAX_BYTES` in `build.js`); `repladder.min.js` is 4695 bytes before this plan.
- ES5 only (`var`, `function`); no `Map`, `Set`, `Promise`, `Symbol`; 4 timer slots; an uncaught error disables the face.
- Main digits: 6 chars right-aligned; day digits: 2 chars, first digit only 1–3.
- F = 15 s minimum rest per gap; rest cut 15 s per level; rep step ⌈T/50⌉; holds start 10 s per hold, step S s.
- Max level capped at 999; every level 1…max must yield a valid `plan()`.
- Default profiles: PUSH reps 5/100/pace 3/10:00 level 19; PULL reps 5/50/pace 3/6:00 level 1; PLAnK hold 5/5:00/10:00 level 1.
- Edit order in both modes: PROFILE → LEVEL → Count → SEtS → PACE → LEn → done; holds skip PACE.
- Block comments ≤ 3 lines; match the file's existing comment density and naming.

## Review Focus

1. Editing sets/top/pace/base on a level so the current level exceeds the new max — level must clamp, never `Er`.
2. Switching profiles mid-edit — the other profile's level and settings must be untouched when you switch back.
3. A hold profile at level 0 (manual) — runs with equal holds, no rep count-up, no PACE field.
4. Top × pace beyond 99:45 or levels past 999 — the edit wraps to the field minimum instead of overflowing the display.
5. A `local.json` profile with a misspelled key — build must fail with the profile index and key in the message.

Tests for each are placed in the owning task (Tasks 3, 3, 4, 3, 5 respectively).

---

### Task 1: Computed ladder and hold plans (pure functions)

**Files:**
- Modify: `repladder.js` (add `rungAt`, `maxLevel`; extend `plan`). Leave `rung`, `PHASES` and all callers alone; Task 2 removes them.
- Create: `test/repladder-rungs.test.js`

**Interfaces:**
- Profile object (used by every later task): `{ name: string, hold: 0|1, sets: int, top: int, pace: int, base: int, level: int }`. `top` is reps, or seconds for holds; `base` is seconds; `pace` is ignored when `hold`.
- Produces: `rungAt(p, n)` → `{ total, length, sets, pace, hold }` or `null` when `n < 1` or `n > maxLevel(p)`; for holds `pace` is 1.
- Produces: `maxLevel(p)` → int, the number of levels (uncapped; Task 3 enforces 999).
- Produces: `plan(total, length, sets, pace, hold)`; with `hold` falsy it behaves exactly as today. With `hold`, every set is `Math.floor(total / sets)` seconds plus 1 for the first `total % sets` sets, and work time per set is its seconds (pace 1).

Ladder algorithm (from the spec): with S = p.sets, T = p.top, P = hold ? 1 : p.pace, B = p.base, F = 15, `floorLen(t, s) = t*P + F*(s-1)`:
1. Add stretch, sets S: start = hold ? 10*S : S*(S+1)/2; step = hold ? S : ⌈T/50⌉; total(n) = min(T, start + (n-1)*step) until it reaches T; length = max(B, floorLen(total, S)).
2. For s = S down to 2: L0 = max(B, floorLen(T, s)); for s < S emit (s, T, L0) first; then emit (s, T, L0 − 15k) for k = 1, 2, … while L0 − 15k ≥ floorLen(T, s).
3. Last level: (1, T, T*P).
Walking the stretches or a closed form are both fine.

- [ ] **Step 1: Write the failing tests** in `test/repladder-rungs.test.js` (load with `loadFace('repladder.js').ctx`; compare with `assert.deepEqual({ ...ctx.rungAt(p, n) }, want)`):

```js
const PUSH = { name: 'PUSH', hold: 0, sets: 5, top: 100, pace: 3, base: 600, level: 1 };
const PULL = { name: 'PULL', hold: 0, sets: 5, top: 50, pace: 3, base: 360, level: 1 };
const PLANK = { name: 'PLAnK', hold: 1, sets: 5, top: 300, pace: 3, base: 600, level: 1 };
const ONE = { name: 'X', hold: 0, sets: 1, top: 20, pace: 3, base: 120, level: 1 };
const SHORT = { name: 'X', hold: 0, sets: 5, top: 100, pace: 3, base: 300, level: 1 };
// [level, sets, total, length]; pace is the profile's (1 for holds), hold is the profile's
test('rungs PUSH', ...)  // maxLevel 118; 1:[5,15,600] 2:[5,17,600] 19:[5,51,600] 43:[5,99,600] 44:[5,100,600] 45:[5,100,585] 60:[5,100,360] 61:[4,100,600] 78:[4,100,345] 79:[3,100,600] 97:[3,100,330] 98:[2,100,600] 117:[2,100,315] 118:[1,100,300]
test('rungs PULL', ...)  // maxLevel 86; 1:[5,15,360] 36:[5,50,360] 37:[5,50,345] 46:[5,50,210] 47:[4,50,360] 85:[2,50,165] 86:[1,50,150]
test('rungs PLAnK', ...) // maxLevel 125; 1:[5,50,600] 2:[5,55,600] 51:[5,300,600] 52:[5,300,585] 67:[5,300,360] 68:[4,300,600] 124:[2,300,315] 125:[1,300,300]; every rung has pace 1, hold 1
test('rungs one set', ...)   // ONE: maxLevel 21; 1:[1,1,120] 2:[1,2,120] 20:[1,20,120] 21:[1,20,60]
test('rungs short base', ...) // SHORT, base below the floor: maxLevel 48; 1:[5,15,300] 44:[5,100,360] 45:[4,100,345] 46:[3,100,330]
test('out of range', ...)     // rungAt(PUSH, 0), rungAt(PUSH, -1), rungAt(PUSH, 119) are null
test('every rung plans', ...) // for PUSH, PULL, PLANK, ONE, SHORT: every n in 1..maxLevel gives a non-null plan(r.total, r.length, r.sets, r.pace, r.hold)
test('hold plan', ...)        // plan(50, 600, 5, 1, 1).reps deepEqual [10,10,10,10,10]; plan(52, 600, 5, 1, 1).reps deepEqual [11,11,10,10,10]; plan(300, 300, 1, 1, 1).ends deepEqual [300000]
test('rep plan unchanged', ...) // plan(100, 600, 4, 3).reps deepEqual [27,26,24,23] (today's README example)
```

- [ ] **Step 2: Run** `node --test test/repladder-rungs.test.js` — expect FAIL (`rungAt is not a function`).
- [ ] **Step 3: Implement** `rungAt`, `maxLevel` and the `hold` parameter of `plan` in `repladder.js`, below `plan()`.
- [ ] **Step 4: Run** `node build.js && node --test` — expect all pass, build exit 0.
- [ ] **Step 5: Commit** `repladder.js repladder.min.js test/repladder-rungs.test.js` — `repladder: rungAt/maxLevel compute a ladder from a profile; plan() splits holds evenly`

### Task 2: Profiles data model, session, run and offer

Behavior change only where the spec requires it: the ladder comes from the active profile, the
offer runs to the profile's max level, and the edit cycle keeps **today's order** (Task 3 changes it).

**Files:**
- Modify: `repladder.js`
- Create: `test/repladder-helpers.js`
- Delete: `test/repladder-ladder.test.js` (superseded by `test/repladder-rungs.test.js`)
- Modify: every `test/repladder-*.test.js` that sets or reads `settings.level/total/length/sets/pace/base`

**Interfaces:**
- Consumes: `rungAt`, `maxLevel`, `plan(..., hold)` from Task 1.
- Produces (exact literals):
  - `var settings = { profile: 0 };` — the only key; `local.json` `"profile"` picks the boot slot.
  - `var profiles = [{ name: 'PUSH', hold: 0, sets: 5, top: 100, pace: 3, base: 600, level: 19 }, { name: 'PULL', hold: 0, sets: 5, top: 50, pace: 3, base: 360, level: 1 }, { name: 'PLAnK', hold: 1, sets: 5, top: 300, pace: 3, base: 600, level: 1 }];`
  - `var session` — `{ total, length, sets, pace, hold }`, the session the face runs and draws.
  - `cur()` → `profiles[settings.profile]`.
  - `load()` — clamps `cur().level` to `maxLevel(cur())`, then sets `session` to `rungAt(cur(), level)` on a level, or `{ total: p.top, length: p.base, sets: p.sets, pace: p.hold ? 1 : p.pace, hold: p.hold }` at level 0. Called at the end of the file (replacing `setLevel(settings.level)`) and after every edit.
  - `setLevel(n)` — `cur().level = n; load();` (tests call it).
- Removes: `rung`, `PHASES`, `settings.base`, `settings.level`, `settings.total/length/sets/pace`.
- `test/repladder-helpers.js` exports `manual(w, { top, base, sets, pace, hold })`: assigns those (hold defaults 0) plus `level: 0` onto `w.ctx.cur()`, calls `w.ctx.load()` then `w.ctx.draw()`.

- [ ] **Step 1: Migrate the tests first.**
  - Each `w.ctx.settings = { level: 0, total: X, length: Y, sets: S, pace: P }` becomes `manual(w, { top: X, base: Y, sets: S, pace: P })`.
  - Reads of `w.ctx.settings.total/length/sets/pace` become `w.ctx.session.*`; reads of `settings.level` become `w.ctx.cur().level`; `settings.base` becomes `w.ctx.cur().base`.
  - Tests on the default face now start at PUSH level 19: 51 reps, `plan` reps `[13, 11, 10, 9, 8]`, 10:00, so idle reads `100013` (was `100012`) and accepting the offer gives level 20 / 53 reps (`[13, 12, 11, 9, 8]`). Recompute every changed expectation from `rungAt`/`plan`; no other assertion may change.
  - Level 100 → `maxLevel` in offer tests: `'no offer at 100'` becomes `'no offer at max'` (`setLevel(118)`, state DONE at `at(310000)`); `'offer to 100'` becomes `'offer to max'` (`setLevel(117)`, `UP 118`, then `GOAL` 3 s).
  - Edit tests: the level field now steps 0, 1, 2 … maxLevel and wraps to 0 (no 1–9 skip). `'level wrap'`: `setLevel(118)`, A → level 0 `oFF`, A → level 1. On a level, LEn edits `cur().base`.
- [ ] **Step 2: Run** `node --test` — expect failures (`cur is not a function`, changed values).
- [ ] **Step 3: Implement** the interfaces above. Edit cycle stays: on a level LEVEL → LEn → idle; at 0 LEVEL → Count → LEn → SEtS → PACE → idle, with FIELDS mapping Count→`top`, LEn→`base`, SEtS→`sets`, PACE→`pace` on `cur()`, each bump followed by `load()`. Offer: `OFFER` when `cur().level > 0 && cur().level < maxLevel(cur())`; `GOAL` flash when the accepted level equals `maxLevel(cur())`.
- [ ] **Step 4: Run** `node build.js && node --test` — all pass, build exit 0.
- [ ] **Step 5: Commit** — `repladder: profiles drive the ladder; session is derived from the active profile`

### Task 3: Final edit cycle — PROFILE field, one order, clamps, LEVEL preview

**Files:**
- Modify: `repladder.js` (`FIELDS`, `WORDS`, `LIMITS`, `bump`, `nextField`, the `EDIT` branch of `draw`)
- Modify: `test/repladder-edit.test.js`

**Interfaces:**
- Consumes: `cur()`, `load()`, `profiles`, `settings.profile`, `maxLevel`, `rungAt` (Task 2).
- Controller calls: the top field keeps the word `Count` on a level too (no `toP`), and PROFILE flashes no word.
- Produces: `FIELDS = ['profile', 'level', 'top', 'sets', 'pace', 'base']`; `WORDS = ['', 'LEUEL', 'Count', 'SEtS', 'PACE', 'LEn']` (PROFILE flashes no word; its name is the display).
- `topRange(p)` → `[min, max, step]`: min = level ? (hold ? 10·sets : sets·(sets+1)/2) : 1; step = hold ? 5 : 1; max = min(999, ⌊5985 / pace⌋) for reps, 5985 for holds. (Controller call: hold top steps 5 s, not the spec's 15 s, so the 10 s-per-hold start lands on a step.)

Rules:
- L in idle enters EDIT on PROFILE; L steps PROFILE → LEVEL → Count → SEtS → PACE → LEn → idle in both modes; hold profiles skip PACE.
- PROFILE: day = slot number (` 1`), main = `cur().name`; A steps `settings.profile` (wraps) and `load()`s. Each profile keeps its own fields.
- LEVEL: A steps 0…`maxLevel(cur())`, wraps to 0. Preview: on a level, day = `' ' + rung.sets`, main = `pad3(level) + pad3(rung.total)`; at 0, day `'  '`, main `'   oFF'`.
- Count/SEtS/PACE/LEn bump within their range and wrap to the minimum; after the bump, clamp top into `topRange` (raising sets can raise top; raising pace can lower it), then if `maxLevel(cur()) > 999` set the bumped field to its minimum; then `load()` (which clamps the level).
- Count on a hold shows its seconds as `fmtTime` with the colon; LEn shows `fmtTime(cur().base)` as today.

- [ ] **Step 1: Rewrite the edit tests** (fresh face = PUSH level 19, idle, past the intro):

```js
test('walk the fields on a level')   // L: main '  PUSH', day ' 1'; L: ' LEUEL', advance 1000: main ' 19 51', day ' 5'; L: ' Count'; L: '  SEtS'; L: '  PACE'; L: '   LEn'; L: state 0
test('walk the fields at level 0')   // manual(w, {top:100, base:600, sets:5, pace:3}); same six words in the same order, then idle main '100022'
test('hold skips PACE')              // A on PROFILE twice → main ' PLAnK'; L,L,L (LEVEL, Count, SEtS); L → '   LEn'
test('switching keeps each level')   // PROFILE A → PULL; LEVEL A → cur().level 2; L to idle; edit PROFILE A,A → PUSH: cur().level 19, session.total 51; A → PULL: cur().level 2
test('top clamps to the ladder start') // PUSH level 19; cur().top = 999; on Count, A → cur().top 15; on SEtS, A (5→6) → cur().top 21
test('editing clamps the level')     // setLevel(118); cur().sets = 9; on SEtS, A (9→1) → cur().level === maxLevel(cur()) and plan(session.total, session.length, session.sets, session.pace, session.hold) non-null
test('level cap 999')                // PLAnK; cur().sets = 1, cur().top = 995; on Count, A → 1000 (maxLevel 992), A → 1005 (997), A → 1010 exceeds 999 so cur().top === 10
test('top fits 99:45')               // manual, pace 20: Count wraps from 299 to 1 (⌊5985/20⌋ = 299)
test('level wrap')                   // setLevel(118); on LEVEL, A → main '   oFF'; A → main '  1 15', day ' 5', cur().level 1
test('hold repeats'), test('leaving edit stops a held repeat'), test('no edit while running'), test('Er while editing') // kept, re-pointed at the new field positions
```

- [ ] **Step 2: Run** `node --test test/repladder-edit.test.js` — expect FAIL.
- [ ] **Step 3: Implement** the rules above.
- [ ] **Step 4: Run** `node build.js && node --test` — all pass, build exit 0.
- [ ] **Step 5: Commit** — `repladder: edit starts on PROFILE; one field order in both modes; top and level clamp to the ladder`

### Task 4: Running a hold, lead-in words, intro name

**Files:**
- Modify: `repladder.js` (`draw`: IDLE, lead-in and work branches; `enter`)
- Create: `test/repladder-hold.test.js`
- Modify: `test/repladder-run.test.js`, `test/repladder-min.test.js` (intro word only)

**Interfaces:**
- Consumes: `session.hold`, `current` (the running `plan`), `cur().name`, `manual` helper (Task 2).
- Rules:
  - Work on a hold: day `S<n>`, main `fmtTime(left) + '  '`; no rep count-up. Rest and idle are unchanged (they show set reps via `fmtReps`, which for holds are seconds).
  - Lead-in items for a hold: `'  HOLd'`, `fmtTime(length) + '  '`, `'SEtS ' + sets`, then the level item, then `'GO' + pad4(reps[0])`. The level item is `'LEU' + pad3(level)` on a level for both types; at level 0 it stays `PACE` for reps and is `'   oFF'` for holds.
  - Intro: `enter()` in IDLE flashes `cur().name` for 1 s instead of `'LAddEr'`.

- [ ] **Step 1: Write the failing tests** in `test/repladder-hold.test.js` (PLAnK = `settings.profile = 2; load()`; level 1 is 5 × 10 s in 10:00):

```js
test('hold idle')            // main '100010', day 'S1'
test('hold lead-in')         // A; main per second: '  HOLd', '1000  ' (colon on), 'SEtS 5', 'LEU  1', 'GO  10'
test('hold work counts down')// at(0): day 'S1', main ' 010  '; at(5000): ' 005  '
test('hold rest')            // at(10000): day 'r1', main ' 21810' (137.5 s rest, ceil 138 = 2:18, next hold 10)
test('manual hold')          // manual(w, {top: 120, base: 300, sets: 3, pace: 3, hold: 1}); current.reps deepEqual [40, 40, 40] after A; at(0) main ' 040  '; lead-in level item '   oFF'
test('intro shows the profile name') // fresh face: main '  PUSH'; after settings.profile = 1 and re-enter (setActive false/true): '  PULL'
```

  In `repladder-min.test.js` and any test asserting `'LAddEr'`, expect `'  PUSH'`.
- [ ] **Step 2: Run** `node --test` — expect the new tests to FAIL.
- [ ] **Step 3: Implement** the rules.
- [ ] **Step 4: Run** `node build.js && node --test` — all pass, build exit 0.
- [ ] **Step 5: Commit** — `repladder: holds count down with no reps; HOLd lead-in; intro shows the profile name`

### Task 5: `local.json` profiles in `build.js`

**Files:**
- Modify: `build.js` (export `localize`; run `main()` only when `require.main === module`)
- Create: `test/build.test.js`

**Interfaces:**
- Produces: `localize(src, name, overrides)` (same signature). An `overrides.profiles` array replaces the whole `var profiles = [ … ];` literal with `JSON.stringify` of the filled list. Every other key goes through today's `var settings` path (now only `profile`).
- Each profile entry: `name` required; `hold, sets, top, pace, base, level` optional, defaulting to `{ hold: 0, sets: 5, top: 100, pace: 3, base: 600, level: 1 }`. An unknown key throws `local.json: repladder profiles[<i>] has no setting "<key>"`; a missing name throws `local.json: repladder profiles[<i>] needs a name`.

- [ ] **Step 1: Write the failing tests** in `test/build.test.js`:

```js
test('profiles replace the list')  // localize(src, 'repladder', {profiles: [{name: 'PULL', top: 40}]}) then loadSource(out): ctx.profiles.length 1, profiles[0] deepEqual {name:'PULL', hold:0, sets:5, top:40, pace:3, base:600, level:1}
test('profile picks the boot slot') // {profile: 1} → ctx.cur().name 'PULL'
test('misspelled profile key fails') // {profiles: [{name: 'X', toop: 5}]} throws /profiles\[0\] has no setting "toop"/
test('nameless profile fails')     // {profiles: [{top: 5}]} throws /profiles\[0\] needs a name/
test('old level key fails')        // {level: 45} throws /has no setting "level"/
```

  (`loadSource` is exported by `tools/harness.js`.)
- [ ] **Step 2: Run** `node --test test/build.test.js` — expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `node build.js && node --test` — all pass.
- [ ] **Step 5: Commit** — `build: local.json can replace repladder's profiles; bad keys fail the build`

### Task 6 (controller): LCD words and local build

Not delegated.
- [ ] Check `PUSH`, `PULL`, `PLAnK`, `HOLd`, `LEUEL`, `oFF` against the segment table in `upstream/js/charSetView.js` (or the emulator's Character set via VNC); rename any default that doesn't read, and fix its tests.
- [ ] Rewrite the user's gitignored `local.json` (it has `{"repladder": {"level": 45}}`, which now fails the build) to a `profiles` list with PUSH at level 39 (91 reps in 5 sets; the ladder steps by 2 from 15, so 90 is not a rung); confirm `node build.js` writes `repladder-local.min.js`.

### Task 7 (controller): README

Not delegated (text-out).
- [ ] Rewrite `repladder.md`: profiles and slots, the edit order, the computed ladder (formula in prose plus the three default profiles' key rungs from Task 1's tests), holds, the `local.json` schema, and that level numbers changed. Update the face's one-line description in `README.md` and the `local.json` example there.
- [ ] Run `node build.js && node --test`; commit; push per the release checklist (push window, fetch/rebase first).
