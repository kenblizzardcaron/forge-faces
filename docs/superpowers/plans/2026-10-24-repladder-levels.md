# Rep Ladder Levels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put Rep Ladder on a fixed ladder of levels (10–99, on by default at 25), with a goal, an after-session offer to step up, and level 0 as the opt-out to today's manual settings.

**Architecture:** A pure `rung(level)` maps a level to the four settings. `level` and `goal` join the `settings` object, so they ride the existing edit machinery (`FIELDS`/`LIMITS`/`bump()`) as two new leading fields. A new `OFFER` state replaces `DONE` when a ladder session finishes below the goal. A press during the finish ring is swallowed in that state, so silencing can't accept.

**Tech Stack:** Espruino-safe ES5 (the face), Node `node:test` + the `tools/harness.js` vm harness (tests), terser 5 via `node build.js`.

**Spec:** `docs/superpowers/specs/2026-10-24-repladder-levels-design.md`

## Delegation

Tasks 1–5 are mechanical units for a **`model: haiku` subagent** on branch `repladder-levels`, one task per dispatch. The gate for each is `node --test` (all green), plus `node build.js` for Task 5. The controller (Opus) does Task 0 and Task 6 (the emulator visual check, including the final words and offer layout), runs every gate, and reads every diff. A subagent's report is a claim, and the gate plus `git diff` are the evidence. Run gates serially; never two `node build.js` at once.

## Global Constraints

- ES5 only in `repladder.js`: `var` and `function`, with no arrow functions, `let`, template strings, `padStart` or classes. `const subscribe` stays as it is.
- Block comments are 3 lines or fewer, matching the file's density and naming.
- Every rung uses PACE 3. Levels 1–9 don't exist. Levels must stay ≤ 99 (two day digits).
- Defaults: `settings = { level: 25, goal: 50, total: 50, length: 600, sets: 5, pace: 3 }`.
- Level 0 behaves exactly as the face does today, including DONE (any press, ring or not, returns to idle).
- No new long-lived timer; at most 4 slots in use.
- Initial words: `LEUEL` (level field), `GOAL` (goal field and goal reached), `oFF` (level 0 preview), `UP` (offer). Task 6 may change them after the emulator check.

## Review Focus

1. A press while the finish ring plays in OFFER must only silence it: the level stays and the offer then shows (Task 4 `hush`).
2. A session reset while paused at level > 0 never offers (Task 4 `no offer after reset`).
3. At or above the goal, finishing behaves like today's DONE, with no offer (Task 4 `at goal`).
4. The level field wraps 99 → 0 → 10, never landing on 1–9 (Task 3 `level wrap`).
5. Finishing off screen, then coming back after the ring, shows the offer, not `donE`, and A then accepts (Task 4 `offer off screen`).

---
### Task 0: Branch and land the pending work (controller)

The working tree holds the uncommitted intro (`LAddEr`), the rep count-up, the `workSecs` rename and this spec and plan.

- [ ] **Step 1:** `git checkout -b repladder-levels`
- [ ] **Step 2:** `node --test`. Expected: `# pass 53`, `# fail 0`.
- [ ] **Step 3:** Commit the face changes and the docs as two commits (`repladder: LAddEr intro, reps count up in work, workSecs rename`, then `docs: Rep Ladder levels design and plan`).

### Task 1: `rung(level)`

**Files:**
- Modify: `repladder.js` (add `rung` next to `plan()`)
- Create: `test/repladder-ladder.test.js`

**Interfaces:**
- Produces: `rung(level: number) -> { total, length, sets, pace } | null`. It returns null for 0, 1–9 and anything above 99. Length is in seconds.

- [ ] **Step 1: Write the failing test** in `test/repladder-ladder.test.js` (load with `loadFace('repladder.js')`, call `w.ctx.rung`):

```js
const R = (total, length, sets) => ({ total, length, sets, pace: 3 });
test('rungs', () => {
  const rung = loadFace('repladder.js').ctx.rung;
  const cases = [[10, R(20, 600, 5)], [25, R(50, 600, 5)], [45, R(90, 600, 5)], [50, R(100, 600, 5)],
    [51, R(100, 585, 5)], [59, R(100, 465, 5)], [60, R(100, 600, 4)], [69, R(100, 465, 4)],
    [70, R(100, 600, 3)], [79, R(100, 465, 3)], [80, R(100, 600, 2)], [98, R(100, 330, 2)],
    [99, R(100, 300, 1)]];
  for (const [l, want] of cases) assert.deepEqual({ ...rung(l) }, want, `level ${l}`);
  for (const l of [0, 1, 9, 100]) assert.equal(rung(l), null, `level ${l}`);
});
test('every rung plans', () => {
  const ctx = loadFace('repladder.js').ctx;
  for (let l = 10; l <= 99; l++) {
    const r = ctx.rung(l);
    assert.ok(ctx.plan(r.total, r.length, r.sets, r.pace), `level ${l}`);
  }
});
```

- [ ] **Step 2:** `node --test test/repladder-ladder.test.js`. Expected: FAIL, `rung is not a function`.
- [ ] **Step 3: Implement `rung(level)` in `repladder.js`**, with the phase starts in one small array so retuning is a one-line edit:

```js
// Set-drop levels; each phase trims LEn 15 s per level from 10:00 (5 sets continue on from level 50).
var PHASES = [50, 60, 70, 80];
// 10-50: Count = level x 2. Above 50: Count 100, one set fewer per phase. 99: one set of 100.
```
Levels 10–50 give `{ total: 2 * level, length: 600, sets: 5, pace: 3 }`. For 51–98, `s` is the last `PHASES` entry ≤ level and `k` is its index, giving `{ total: 100, length: 600 - 15 * (level - s), sets: 5 - k, pace: 3 }`. Level 99 gives `{ total: 100, length: 300, sets: 1, pace: 3 }`.

- [ ] **Step 4:** `node --test`. Expected: all pass.
- [ ] **Step 5:** Commit: `repladder: rung() maps a ladder level to its settings`.

### Task 2: Ladder on by default; idle shows the level

**Files:**
- Modify: `repladder.js` (the `settings` default, the IDLE branch of `draw()`, plus a new `preview(s)`)
- Modify: `test/repladder-run.test.js`, `-edit`, `-pause`, `-sound`, `-offscreen` (their `fresh()` helpers), `test/repladder-min.test.js`

**Interfaces:**
- Consumes: `rung(level)` from Task 1.
- Produces: `preview(s: settings-like) -> string`, the 6-char idle main text: `fmtTime(s.length)` plus set 1's reps via `fmtReps`, or `'  '` when `plan()` is null. `settings` gains `level` and `goal`.

- [ ] **Step 1: Pin the old defaults in the existing tests.** In each listed `fresh()`, right after `loadFace`, add:

```js
  w.ctx.settings = { level: 0, goal: 50, total: 100, length: 600, sets: 5, pace: 3 };
  w.ctx.draw();
```
In `repladder-run.test.js`, keep the existing `w.advance(1000)` before these lines. Where a test assigns `w.ctx.settings = { total: ..., ... }` wholesale (`run` "one set of 100", "fractional rest"; `sound` "zero rest beeps once"), add `level: 0, goal: 50` to that object. Tests that build their own face without `fresh()` (`run` "intro") change in Step 2.

- [ ] **Step 2: Write the failing tests.** In `repladder-run.test.js`, change the "intro" test's post-intro assertion to the new default, and add:

```js
test('idle on the ladder', () => {
  const w = loadFace('repladder.js');
  w.advance(1000);
  assert.equal(w.day(), '25');
  assert.equal(w.main(), '100012');
  assert.equal(w.colon, true);
});
```
In `repladder-min.test.js` (which tests the defaults, so it moves to level 25), the post-intro idle is `'100012'`. On start, set 1 is 12 reps × 3 s, so the screen shows `' 03601'`.

- [ ] **Step 3:** `node --test`. Expected: the new and changed assertions FAIL, everything else passes.
- [ ] **Step 4: Implement.** Set the default `settings` from Global Constraints. In the IDLE branch of `draw()`, `main = preview(settings)`; `day = settings.level ? String(settings.level) : (plan ok ? 'S1' : 'Er')`.
- [ ] **Step 5:** `node --test`. Expected: all pass.
- [ ] **Step 6:** Commit: `repladder: start on ladder level 25; idle shows the level`.

### Task 3: Level and Goal edit fields

**Files:**
- Modify: `repladder.js` (`FIELDS`, `WORDS`, `LIMITS`, `bump()`, the EDIT branch of `draw()`, the EDIT/L branch of `button()`, plus new `setLevel(n)` and `nextField()`)
- Modify: `test/repladder-edit.test.js`

**Interfaces:**
- Consumes: `rung()` (Task 1) and `preview()` (Task 2).
- Produces: `setLevel(n)`, which sets `settings.level = n` and, when `rung(n)` is non-null, copies its `total`, `length`, `sets` and `pace` into `settings`. At 0 it leaves them as they are. Task 4 uses it to accept an offer, and tests use it to position the face.

The field tables become `FIELDS = ['level', 'goal', 'total', 'length', 'sets', 'pace']`, `WORDS = ['LEUEL', 'GOAL', 'Count', 'LEn', 'SEtS', 'PACE']`, and `LIMITS` gains `[0, 99, 1]` and `[10, 99, 1]` at the front.

- [ ] **Step 1: Update the existing edit tests.** Every `tap('L')` sequence that starts in idle gets one extra leading `w.tap('L')`. That press opens Level; at the pinned level 0, the next L skips Goal and lands on Count. This affects "walk the fields", "wrap", "Er while editing", "hold repeats" and "leaving edit stops a held repeat". Assert `' LEUEL'` after that first tap in "walk the fields".

- [ ] **Step 2: Write the failing tests** (append to `repladder-edit.test.js`; `ladder()` is a helper doing `loadFace('repladder.js')` then `advance(1000)`, i.e. the default level 25):

```js
test('level and goal fields', () => {
  const w = ladder();
  w.tap('L');
  assert.equal(w.main(), ' LEUEL');
  assert.equal(w.day(), '25');
  w.advance(1000);
  assert.equal(w.main(), '100012');
  w.tap('A');
  assert.equal(w.day(), '26');
  assert.equal(w.main(), '100013');
  assert.equal(w.ctx.settings.total, 52);
  w.tap('L');
  assert.equal(w.main(), '  GOAL');
  w.advance(1000);
  assert.equal(w.day(), '50');
  assert.equal(w.main(), '100022');
  w.tap('A');
  assert.equal(w.main(), ' 94522');
  assert.equal(w.ctx.settings.goal, 51);
  assert.equal(w.ctx.settings.total, 52);
  w.tap('L');
  assert.equal(w.ctx.state, 0);
  assert.equal(w.day(), '26');
});

test('level wrap', () => {
  const w = ladder();
  w.ctx.setLevel(99);
  w.tap('L');
  w.advance(1000);
  w.tap('A');
  assert.equal(w.ctx.settings.level, 0);
  assert.equal(w.main(), '   oFF');
  assert.deepEqual([w.ctx.settings.total, w.ctx.settings.length, w.ctx.settings.sets], [100, 300, 1]);
  w.tap('A');
  assert.equal(w.ctx.settings.level, 10);
  assert.equal(w.main(), '100006');
});

test('goal wrap', () => {
  const w = ladder();
  w.ctx.settings.goal = 99;
  w.tap('L');
  w.tap('L');
  w.advance(1000);
  w.tap('A');
  assert.equal(w.ctx.settings.goal, 10);
});

test('level 0 goes to the manual fields; a level skips them', () => {
  const w = ladder();
  w.tap('L');
  w.tap('L');
  w.tap('L');
  assert.equal(w.ctx.state, 0);
  w.ctx.setLevel(0);
  w.tap('L');
  w.tap('L');
  assert.equal(w.main(), ' Count');
});
```

- [ ] **Step 3:** `node --test test/repladder-edit.test.js`. Expected: the new tests FAIL.
- [ ] **Step 4: Implement.**
  - `bump()`: a level that lands on 1–9 becomes 10, and a level change goes through `setLevel`.
  - L in EDIT calls `nextField()`. It advances `field`, skips Goal when `settings.level` is 0, and leaves EDIT (to IDLE, `field = 0`) after Goal when the level is above 0, or after Pace. It flashes the new field's word otherwise.
  - The EDIT draw for fields 0–1: `day = String(value)`. `main` is `'oFF'` for level 0, else `preview(rung(value))`, with the colon on for a preview.
  - Fields 2–5 draw as today.
- [ ] **Step 5:** `node --test`. Expected: all pass.
- [ ] **Step 6:** Commit: `repladder: Level and Goal edit fields`.

### Task 4: The offer after a finished ladder session

**Files:**
- Modify: `repladder.js` (`onPhase()`, `ringStep()`, `flash()`, `draw()`, `button()`)
- Create: `test/repladder-offer.test.js`

**Interfaces:**
- Consumes: `setLevel(n)` (Task 3).
- Produces: state `OFFER = 4`; `flash(word, ms)`, where `ms` defaults to 1000.

Behaviour:
- **Entering OFFER.** In `onPhase()` at the session end, the state becomes `OFFER` when `settings.level` is above 0 and below `settings.goal`, and `DONE` otherwise. The ring starts either way.
- **Drawing OFFER.**
  - While the ring plays (`ringTimer != -1`), it draws like DONE (`donE`).
  - Otherwise, `day = String(settings.level + 1)` and `main = 'UP  ' + pad(settings.goal - settings.level - 1)`, with the colon off.
  - `ringStep()` calls `draw()` when the ring ends, so the offer appears.
- **Swallowing the silencing press.** In `button()`, a press-down while the ring plays in OFFER stops the ring and sets `hush = 1`. The matching release only clears `hush` and `longFired` and redraws. Level 0 and DONE keep today's behaviour.
- **Answering the offer.** A release in OFFER (not hushed, not a long A):
  - **A** calls `setLevel(settings.level + 1)` and goes to IDLE. If the level now equals the goal, it shows `flash('GOAL', 3000)`.
  - **L** goes to IDLE with the level unchanged.

- [ ] **Step 1: Write the failing tests** in `test/repladder-offer.test.js`. `fresh()` loads the face, advances 1000 ms past the intro (default level 25, goal 50; the session is 600 s), and defines `w.at` as the other files do.

```js
test('offer after finish', () => {
  const w = fresh();
  w.tap('A');
  w.at(600000);
  assert.equal(w.main(), '  donE');
  w.advance(10000);
  assert.equal(w.ctx.state, 4);
  assert.equal(w.day(), '26');
  assert.equal(w.main(), 'UP  24');
  w.tap('A');
  assert.equal(w.ctx.state, 0);
  assert.equal(w.ctx.settings.level, 26);
  assert.equal(w.ctx.settings.total, 52);
  assert.equal(w.day(), '26');
});

test('decline keeps the level', () => {
  const w = fresh();
  w.tap('A');
  w.at(610000);
  w.tap('L');
  assert.equal(w.ctx.state, 0);
  assert.equal(w.ctx.settings.level, 25);
});

test('hush', () => {
  const w = fresh();
  w.tap('A');
  w.at(601100);
  w.tap('A');
  assert.equal(w.ctx.settings.level, 25);
  assert.equal(w.main(), 'UP  24');
  w.tap('A');
  assert.equal(w.ctx.settings.level, 26);
});

test('no offer after reset', () => {
  const w = fresh();
  w.tap('A');
  w.at(1000);
  w.tap('A');
  w.tap('L');
  w.advance(700000);
  assert.equal(w.ctx.state, 0);
  assert.equal(w.ctx.settings.level, 25);
});

test('at goal', () => {
  const w = fresh();
  w.ctx.setLevel(50);
  w.tap('A');
  w.at(610000);
  assert.equal(w.ctx.state, 2);
  w.tap('A');
  assert.equal(w.ctx.state, 0);
  assert.equal(w.ctx.settings.level, 50);
});

test('goal reached', () => {
  const w = fresh();
  w.ctx.setLevel(49);
  w.tap('A');
  w.at(610000);
  assert.equal(w.main(), 'UP  00');
  w.tap('A');
  assert.equal(w.main(), '  GOAL');
  w.advance(2999);
  assert.equal(w.main(), '  GOAL');
  w.advance(1);
  assert.equal(w.day(), '50');
  assert.equal(w.main(), '100022');
});

test('offer off screen', () => {
  const w = fresh();
  w.tap('A');
  w.at(590000);
  w.setActive(false);
  w.at(660000);
  w.minute();
  w.advance(10000);
  w.setActive(true);
  assert.equal(w.main(), 'UP  24');
  w.tap('A');
  assert.equal(w.ctx.settings.level, 26);
});
```

- [ ] **Step 2:** `node --test test/repladder-offer.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** the behaviour above.
- [ ] **Step 4:** `node --test`. Expected: all pass. In particular, `repladder-sound` "button stops ring" is unchanged, because level 0 still returns to idle on that press.
- [ ] **Step 5:** Commit: `repladder: offer the next level after a finished session`.

### Task 5: README and minified build

**Files:**
- Modify: `README.md` (`## repladder.js` section), `repladder.min.js` (via `node build.js`)

- [ ] **Step 1: README.**
  - Settings table: add **LEUEL** (level, default 25, 0 = off, 10–99) and **GOAL** (default 50, 10–99) above Count, noting that Count…PACE are edited only at level 0.
  - Add a short "Levels" subsection with the ladder table from the spec, the rows for levels 10–99.
  - Buttons table: the edit order becomes LEUEL → GOAL (on a level) or LEUEL → Count → LEn → SEtS → PACE (at 0). Add a row for A/L on the offer.
  - Screen table: Idle shows the level on the day digits when on the ladder. Add an Offer row (`UP` plus levels left, the next level on the day digits) and a `GOAL` row.
  - Keep the 1-sentence-per-row style.
- [ ] **Step 2:** `node build.js`. Expected: prints a `repladder:` byte count; leave `multitimer.min.js` unchanged (`git diff --stat` shows no change to it).
- [ ] **Step 3:** `node --test`. Expected: all pass, including `repladder-min`.
- [ ] **Step 4:** Commit: `repladder: README for levels; rebuild`.

### Task 6: Emulator check (controller, not delegated)

- [ ] **Step 1:** Rebuild the local site (`sh tools/build-site.sh <scratchpad>/site`), serve it on the Tailscale address, and ask the user to open `?face=repladder` over VNC or on the iPad.
- [ ] **Step 2:** Check that `LEUEL`, `GOAL`, `oFF` and the `UP  24` offer read clearly on the 7-segment display. Agree any word or layout changes with the user, then apply them (with the matching test strings), rerun `node build.js` and `node --test`, and commit.
- [ ] **Step 3:** Before any push, walk the global release checklist (fetch and rebase on main, push-time window).
