# Rep Ladder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Forge face, `repladder.js`, that paces a declining-rep workout: N reps over a total time in S sets, reps dropping by one per set, rest only between sets.

**Architecture:** One ES5 face file, the same shape as `multitimer.js`. A pure `plan()` function turns the four settings into rep counts and phase end offsets. A single timestamp (`startAt`) drives everything: the lead-in is just negative elapsed time, and pausing shifts `startAt`. A node `vm` harness with a fake `Ollee`, fake clock and fake timers tests the face headlessly.

**Tech Stack:** Espruino-safe ES5 (the face), Node 22 `node:test` + `node:vm` (tests), terser 5 (build).

**Spec:** `docs/superpowers/specs/2026-10-23-repladder-design.md`

## Delegation

Every task 1–7 is a mechanical unit for a **`model: haiku` subagent** on branch `repladder`. Its gate is `node --test` (Task 7 adds `node build.js`). The controller (Opus) runs the gate, reads the diff, and does Task 8 (the visual check in the emulator) itself. A subagent's report is a claim, and the gate plus `git diff` are the evidence.

## Global Constraints

- ES5 only in `repladder.js`: `var` and `function`; no arrow functions, `let`, template strings, `padStart` or classes. The single exception is `const subscribe = ...;`, as in multitimer.
- Time comes from `function now() { return new Date().getTime(); }`, as in multitimer. The harness fakes `Date`.
- Main digits are plain 7-segment, `HH:MM SS` layout (colon between digit 2 and 3). `drawMain` keeps the first 6 chars, right-aligned; `drawDay` keeps the first 2.
- The exact words, with this casing: `Count`, `LEngth`, `SEtS`, `PACE`, `StArt`, `PAUSE`, `rESEt`, `donE`, `Error`.
- Defaults: total 100 reps, length 600 s, 5 sets, pace 3 s.
- Edit ranges, which wrap to the minimum after the maximum: Count 1–999 step 1; LEngth 15–5985 s step 15; SEtS 1–9; PACE 1–20 s.
- At most 4 timer slots (`setTimeout`/`setInterval` share them).
- The minified `repladder.min.js` must be ≤ 8158 bytes.
- Every `*.js` in the repo root is copied to the hosted site, so the harness lives in `tools/` and tests in `test/`.
- Block comments are 3 lines or fewer; match multitimer's comment density and naming.
- Sounds: `Ollee.beepShort()` for the lead-in only; one `Ollee.beep()` per work↔rest change (including set 1 starting); multitimer's stock triple only for the finish.

## Review Focus

1. **Pause during the lead-in or right at a boundary:** resume keeps the exact remaining time, and a boundary never beeps twice. Test in Task 5.
2. **Rest that isn't a whole number of seconds** (100 reps / 4 sets / 601 s): the last set still ends at exactly 601 s, and the countdown never shows a negative number or skips backwards. Test in Task 2 and Task 3.
3. **One set** (`sets = 1`) and a set of more than 99 reps: no rest, no division by zero, and the main digits drop the rep count instead of overflowing. Test in Task 2 and Task 3.
4. **Leaving the face mid-session and coming back:** the display is right, and missed boundaries cause at most one change beep, not a burst. Test in Task 7.
5. **Invalid settings reached by editing** (Count 5 with 9 sets, or a pace so slow the work exceeds the length): the day digits show `Er` while editing, and start flashes `Error` without crashing. Test in Task 6 and Task 3.

---

### Task 1: Headless face harness

**Files:**
- Create: `tools/harness.js`
- Test: `test/harness.test.js`

**Interfaces:**
- Produces: `loadFace(file)` (reads a face file relative to the repo root) and `loadSource(code)`. Each returns a `watch` object that has already run `init()` (if defined) and `enter()`:
  - `watch.ctx`: the `vm` context, so tests can read and write top-level `var`s (e.g. `watch.ctx.settings`) and call functions (e.g. `watch.ctx.plan(...)`).
  - `watch.main()` / `watch.day()`: the last drawn text as shown, right-aligned and padded to 6 / 2 chars (`'   100'`, `'S1'`). `watch.colon` and `watch.lap` are the booleans last drawn.
  - `watch.beeps`: an array of `{ t, kind }`, where `kind` is `'beep'` or `'short'`, and `t` is the fake clock in ms.
  - `watch.advance(ms)`: moves the fake clock forward, firing due timeouts and intervals in time order, each with the clock set to its due time.
  - `watch.tap(btn)` (`'A'` or `'L'`) and `watch.hold(btn, ms)`.
  - `watch.setActive(on)`: `false` calls `exit()` and cancels every timer; `true` calls `enter()`.
  - `watch.minute()`: calls `clock_minute()` only if the face subscribed `E_CLOCK_MINUTE` via `Ollee.subscribe` and hasn't unsubscribed.
  - `watch.subscribed(bit)`: whether `bit` is currently background-subscribed.
- The fake clock starts at `1_000_000_000_000`, so tests use deltas.

- [ ] **Step 1: Write the failing tests** in `test/harness.test.js` with `node:test` and `node:assert/strict`. Use small inline faces through `loadSource`:
  - `draws right-aligned`: a face whose `enter()` does `Ollee.drawMain(42); Ollee.drawDay('S1x'); Ollee.drawColon(1)` → `main() === '    42'`, `day() === 'S1'`, `colon === true`.
  - `fires timers in order`: `setTimeout` at 300 and `setInterval` at 100 each push to a list; `advance(350)` → interval ×3 and timeout ×1, in time order, and `new Date().getTime()` inside each callback equals its due time.
  - `four timer slots`: the 5th `setTimeout` returns `-1`; `clearTimeout(id)` frees a slot.
  - `exit cancels timers, draws ignored when inactive`: after `setActive(false)`, pending timers never fire, `drawMain` doesn't change `main()`, and `setTimeout` called while inactive still works (it returns an id and fires).
  - `button order`: with `subscribe = E_A_SHORT + E_BUTTONS + E_A_LONG`, `tap('A')` logs `a_short, button(0,0), button(0,1)`; `hold('A', 1200)` logs `a_short, button(0,0), a_long, button(0,1)`; `hold('L', 1200)` with `E_L_LONG` subscribed does **not** fire `l_long` (L's hold is 1500 ms). Only bits in `subscribe` fire.
  - `minute only when subscribed`: `minute()` calls `clock_minute` only after `Ollee.subscribe(E_CLOCK_MINUTE)`.
  - `beeps recorded`: `Ollee.beep()` and `Ollee.beepShort()` add `{t, kind:'beep'|'short'}`.
  - `loads multitimer`: `loadFace('multitimer.js')` doesn't throw, and `main()` has length 6.

- [ ] **Step 2: Run them to make sure they fail**

Run: `node --test`
Expected: FAIL, "Cannot find module '../tools/harness'".

- [ ] **Step 3: Implement `tools/harness.js`**, a CommonJS module exporting `{ loadFace, loadSource }`. Use the event constants from `upstream/js/ollee.js` (`E_A_SHORT = 1<<0` … `E_CLOCK_HOUR = 1<<9`, `B_A = 0`, `B_L = 1`, `E_DOWN = 0`, `E_UP = 1`). Inject them, plus `Ollee`, a fake `Date` (`new Date().getTime()` and `Date.now()` return the fake clock) and `console`, as context globals. Run the code with `vm.runInContext`, then call the hooks by name from the context. A top-level `const subscribe` is not a context property, so read it with `vm.runInContext('subscribe', ctx)`. Button dispatch mirrors `upstream/js/app.js` `createHoldableButton`: on DOWN the short hook fires, then `button(btn, E_DOWN, ms)`; a hold reaching 1000 ms (A) or 1500 ms (L) fires the long hook once; on release, `button(btn, E_UP, ms)`. `hold` advances the clock (firing timers) while the button is held. `Ollee` also needs `active()`, `clear()`, `drawHR`, `drawPM`, `drawBell`, `led_on/led_off`, `subscribe/unsubscribe` (return `true` for background bits only), `setInterval/clearInterval`. `clearTimeout()` with no id clears all.

- [ ] **Step 4: Run the tests to make sure they pass**

Run: `node --test`
Expected: PASS, all 8 tests.

- [ ] **Step 5: Commit**

```bash
git add tools/harness.js test/harness.test.js
git commit -m "tools: headless Forge harness for face tests"
```

### Task 2: Session math

**Files:**
- Create: `repladder.js`
- Test: `test/repladder-math.test.js`

**Interfaces:**
- Consumes: `loadFace` from Task 1.
- Produces (top-level in `repladder.js`):
  - `var settings = { total: 100, length: 600, sets: 5, pace: 3 };`
  - `function plan(total, length, sets, pace)` returns `null` when invalid, else `{ reps: [...], ends: [...] }`. `ends` has `2*sets - 1` entries: the end of each phase in ms from set 1's start, alternating work, rest, …, work. Even index `i` is the work for set `i/2 + 1`; odd index `i` is the rest after set `(i+1)/2`.
  - `function phaseAt(p, ms)` returns the first index `i` with `p.ends[i] > ms`, or `p.ends.length` when the session is over.
  - Minimal hooks so the face loads: `const subscribe = E_BUTTONS + E_A_LONG;`, plus empty `enter()` and `button()`. Header comment in multitimer's style (name, one-line purpose, "upload repladder.min.js").

- [ ] **Step 1: Write the failing tests**

```js
const { loadFace } = require('../tools/harness');
const w = loadFace('repladder.js');
// vm objects have another realm's prototypes; deepStrictEqual needs plain copies
const plain = (x) => JSON.parse(JSON.stringify(x));
const plan = (...a) => plain(w.ctx.plan(...a)), phaseAt = w.ctx.phaseAt;
// default ladder
assert.deepEqual(plan(100, 600, 5, 3), { reps: [22, 21, 20, 19, 18],
  ends: [66000, 141000, 204000, 279000, 339000, 414000, 471000, 546000, 600000] });
// uneven: extras go to the first sets
assert.deepEqual(plan(100, 600, 4, 3).reps, [27, 26, 24, 23]);
assert.deepEqual(plan(100, 600, 4, 3).ends, [81000, 181000, 259000, 359000, 431000, 531000, 600000]);
// fractional rest still ends exactly at length
assert.deepEqual(plan(100, 601, 4, 3).ends, [81000, 181333, 259333, 359667, 431667, 532000, 601000]);
// one set: no rest, no NaN
assert.deepEqual(plan(100, 600, 1, 3), { reps: [100], ends: [300000] });
// invalid: last set < 1, and work longer than length
assert.equal(plan(5, 600, 9, 3), null);
assert.equal(plan(100, 299, 5, 3), null);
// zero rest is valid
assert.deepEqual(plan(100, 300, 5, 3).ends.slice(0, 3), [66000, 66000, 129000]);
// phaseAt
const p = w.ctx.plan(100, 600, 5, 3);
assert.equal(phaseAt(p, 0), 0); assert.equal(phaseAt(p, 65999), 0);
assert.equal(phaseAt(p, 66000), 1); assert.equal(phaseAt(p, 599999), 8);
assert.equal(phaseAt(p, 600000), 9);
assert.equal(phaseAt(w.ctx.plan(100, 300, 5, 3), 66000), 2);  // skips the zero rest
```

Split these into named `test(...)` blocks: `default ladder`, `uneven split`, `fractional rest`, `one set`, `invalid`, `zero rest`, `phaseAt`.

- [ ] **Step 2: Run them to make sure they fail**

Run: `node --test`
Expected: FAIL, repladder.js not found or `plan` is not a function.

- [ ] **Step 3: Implement `plan` and `phaseAt`**

Rep split: `b = floor((T + n(n-1)/2) / n)`, `r = T - (n*b - n(n-1)/2)`, rep `k` (0-based) = `b - k + (k < r ? 1 : 0)`. It's invalid if the last rep count is `< 1` or `T*pace > length`. Rest `k` (1-based) ends at `Math.round(cumWork_k*1000 + k*restMs)` with `restMs = (length - T*pace)*1000/(n-1)`. Each work end is the previous end plus `reps*pace*1000`. That makes the final end exactly `length*1000` (or `T*pace*1000` when `n = 1`).

- [ ] **Step 4: Run the tests to make sure they pass**

Run: `node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add repladder.js test/repladder-math.test.js
git commit -m "repladder: session math (rep split and phase ends)"
```

### Task 3: Run a session — timeline and display

**Files:**
- Modify: `repladder.js`
- Test: `test/repladder-run.test.js`

**Interfaces:**
- Consumes: `settings`, `plan`, `phaseAt` (Task 2); harness (Task 1).
- Produces (top-level, used by Tasks 4–7):
  - `var IDLE = 0, RUNNING = 1, DONE = 2, EDIT = 3;` and `var state = IDLE, startAt = 0, paused = false, pausedAt = 0, current = null, lastPhase = -1, message = '', messageUntil = 0;`. `current` is the active `plan()`. `startAt` is the timestamp set 1 begins: pressing start sets `startAt = now() + 5000`, so the lead-in is just `elapsed() < 0`.
  - `function elapsed()` returns `(paused ? pausedAt : now()) - startAt`.
  - `function flash(word)` shows `word` on the main digits for 1000 ms.
  - `function draw()` renders the current state; `function schedule()` re-arms the one display `setTimeout`.
  - `function onPhase(i)` is called once each time the phase index changes to `i` while on screen (`i = current.ends.length` means finished). Task 4 adds the sounds there.

**Display rules** (the main digits are 6 chars; `m:ss rr` is written as `m` padded to 2 with a space, then `ss`, then `rr`, colon on):

| State | Day | Main | Colon | LAP |
| --- | --- | --- | --- | --- |
| Idle, valid | `S1` | length `m:ss` + set 1 reps → `'100022'` | on | off |
| Idle, invalid | `Er` | length only → `'1000  '` | on | off |
| Lead-in, 5th second | `GO` | `' StArt'` | off | off |
| Lead-in, 4…1 s left | `GO` | `'     4'` … `'     1'` | off | off |
| Work, set k | `Sk` | time left in the block + this set's reps → `' 10622'` | on | off |
| Rest after set k | `rk` | rest left + next set's reps → `' 11521'` | on | blinks: on when `floor(now()/500)` is even |
| Done | `'  '` | `' donE'` | off | off |
| Any flash | unchanged | the word | off | off |

- Time left = `Math.ceil(msLeft / 1000)` seconds.
- If reps > 99, the last two digits are blank (`' 500  '`).
- **Controls:** A in IDLE starts if `plan(...)` is valid, else `flash('Error')`. Any button in DONE goes back to IDLE.
- **`schedule()`:** on screen, keep exactly one display `setTimeout`, armed for the earliest of the next countdown second change, the next phase end, the next LAP flip (rest only) and the end of the flash. Tests read the screen right after `advance()`, so it has to be exact. Nothing is armed when idle with no flash.

- [ ] **Step 1: Write the failing tests** (defaults unless stated; `t0` = tap A; `at(ms)` = advance so `elapsed()` equals `ms`):
  - `idle screen`: day `'S1'`, main `'100022'`, colon on, LAP off.
  - `invalid idle and start`: set `ctx.settings.total = 5; ctx.settings.sets = 9; ctx.draw()` → day `'Er'`, main `'1000  '`. Tap A → main `' Error'`, `ctx.state === 0`. Advance 1000 → `'1000  '`.
  - `lead-in`: tap A → `' StArt'`, day `'GO'`, colon off. Advance 1000 → `'     4'`. Advance 3000 → `'     1'`.
  - `work countdown`: `at(0)` → day `'S1'`, `' 10622'`, colon on. `at(9000)` → `' 05722'`. `at(9500)` → `' 05722'`.
  - `rest and LAP`: `at(65999)` → `' 00122'`. `at(66000)` → day `'r1'`, `' 11521'`, LAP on. `at(66500)` → LAP off. `at(546000)` → day `'S5'`, `' 05418'`, LAP off.
  - `done`: `at(600000)` → `' donE'`, day `'  '`, colon off. Tap A → `'100022'`.
  - `one set of 100`: settings `{total:100, length:600, sets:1, pace:3}`, `draw()` → `'1000  '`. Start, `at(0)` → `' 500  '`, day `'S1'`. `at(300000)` → `' donE'`.
  - `fractional rest`: settings 100/601/4/3. `at(181332)` → day `'r1'`, `' 00126'`. `at(181333)` → day `'S2'`, `' 11826'`. Advancing 250 ms at a time to `at(601000)`, every main reading matches `/^[ \d]{6}$/` until `' donE'`.

- [ ] **Step 2: Run them to make sure they fail**

Run: `node --test`
Expected: FAIL on `idle screen` (nothing drawn yet).

- [ ] **Step 3: Implement** the state, `elapsed`, `flash`, `draw`, `schedule` and `onPhase` hook point, and the A/L handling above in `button(b, e)`. Act on `E_UP` unless a long press fired, as multitimer does. `enter()` clears and draws; `exit()` clears the display timer id.

- [ ] **Step 4: Run the tests to make sure they pass**

Run: `node --test`
Expected: PASS (all earlier tests too).

- [ ] **Step 5: Commit**

```bash
git add repladder.js test/repladder-run.test.js
git commit -m "repladder: run a session with lead-in, sets, rests and done screen"
```

### Task 4: Sounds

**Files:**
- Modify: `repladder.js`
- Test: `test/repladder-sound.test.js`

**Interfaces:**
- Consumes: `onPhase(i)`, `state`, `startAt` (Task 3).
- Produces: `function startRing(onScreen)` (the finish triple; 10 periods (10 s) on screen, 5 off) and `function stopRing()`. Task 7 calls `startRing(false)`.

**Sounds:**
- Lead-in: `Ollee.beepShort()` at 5, 4, 3, 2, 1 s before set 1 (the first one on the press itself).
- `Ollee.beep()` once when set 1 starts and at each later phase change, except the finish.
- Finish: multitimer's stock triple, with steps every 125 ms, beeping on steps 0–2 of each 8. Any button stops it (and goes to IDLE, per Task 3).

- [ ] **Step 1: Write the failing tests** (`kinds(k)` = beeps filtered by kind):
  - `lead-in shorts`: tap A at `t0`; advance 4000 → 5 `'short'` at `t0 + 0, 1000, 2000, 3000, 4000`, and no `'beep'`.
  - `set 1 start beep`: advance to `t0 + 5000` → exactly 1 `'beep'`, at `t0 + 5000`.
  - `nine change beeps`: run the default session to `at(599999)` → 9 `'beep'`, the 2nd at `elapsed` 66000.
  - `finish ring`: `at(600000)`, then advance 15000 → 30 more `'beep'`; the first six are at `end + 0, 125, 250, 1000, 1125, 1250`.
  - `button stops ring`: at `end + 1100`, tap A → exactly 4 ring beeps, none after advance 5000, and main `'100022'`.
  - `zero rest beeps once`: settings 100/300/5/3; `at(66000)` → 2 `'beep'` in total (set 1 start + one).

- [ ] **Step 2: Run them to make sure they fail**

Run: `node --test`
Expected: FAIL on `lead-in shorts`.

- [ ] **Step 3: Implement** the sounds in `onPhase` and the lead-in seconds (fold the lead-in cue times into `schedule()`), plus `startRing`/`stopRing` with their own `setTimeout` slot.

- [ ] **Step 4: Run the tests to make sure they pass**

Run: `node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add repladder.js test/repladder-sound.test.js
git commit -m "repladder: lead-in countdown, change beeps and finish triple"
```

### Task 5: Pause, resume, reset

**Files:**
- Modify: `repladder.js`
- Test: `test/repladder-pause.test.js`

**Interfaces:**
- Consumes: `paused`, `pausedAt`, `startAt`, `flash`, `elapsed` (Task 3).
- Behaviour: A while RUNNING toggles pause. Pausing sets `pausedAt = now()` and `flash('PAUSE')`; resuming shifts `startAt` forward by the paused time. L while paused does `flash('rESEt')` and goes to IDLE. L while RUNNING and not paused does nothing.

- [ ] **Step 1: Write the failing tests:**
  - `pause in lead-in`: tap A, advance 2500, tap A → `' PAUSE'`; advance 1000 → `'     3'`, day `'GO'`; advance 10000 → still 3 `'short'`. Tap A, advance 2500 → 5 `'short'`, and 1 `'beep'` at exactly resume + 2500.
  - `pause on a boundary`: `at(66000)` (2 `'beep'`), tap A, advance 5000, tap A, advance 100 → still 2 `'beep'`; main `' 11521'`.
  - `no LAP while paused`: pause at `at(70000)`; LAP is off at two readings 500 ms apart.
  - `reset`: while paused, tap L → `' rESEt'`; advance 1000 → `'100022'`, day `'S1'`, `state === 0`.
  - `L ignored while running`: `at(10000)`, tap L → `state === 1`, day `'S1'`.

- [ ] **Step 2: Run them to make sure they fail**

Run: `node --test`
Expected: FAIL on `pause in lead-in`.

- [ ] **Step 3: Implement** pause/resume/reset. `schedule()` arms nothing but the flash while paused.

- [ ] **Step 4: Run the tests to make sure they pass**

Run: `node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add repladder.js test/repladder-pause.test.js
git commit -m "repladder: pause, resume and reset"
```

### Task 6: Edit the settings

**Files:**
- Modify: `repladder.js`
- Test: `test/repladder-edit.test.js`

**Interfaces:**
- Consumes: `settings`, `plan`, `flash`, `state`, `EDIT` (Tasks 2–3).
- Produces: `var field = 0;`, which indexes `FIELDS = ['total', 'length', 'sets', 'pace']` with words `['Count', 'LEngth', 'SEtS', 'PACE']`.
- Behaviour: L in IDLE enters EDIT at `field 0`; each L moves to the next field and flashes its word; L after PACE returns to IDLE (no flash). A increments the current field by its step and wraps to the minimum after the maximum (ranges in Global Constraints). Holding A repeats every 100 ms after `a_long` until release. Edit is reachable from IDLE only.

**Display while editing:** the day digits show set 1's reps (padded to 2), or `Er` if `plan()` is null. The main digits show the field's word for 1 s, then the value: total `'   100'`; length as `m:ss` with blank reps (`'1000  '`, `' 500  '`), colon on; sets `'     5'`; pace `'     3'`.

- [ ] **Step 1: Write the failing tests:**
  - `walk the fields`: tap L → `' Count'`, day `'22'`; advance 1000 → `'   100'`. Tap A → `'   101'`, day `'23'`. Tap L → `'LEngth'`; advance 1000 → `'1000  '`, colon on; tap A → `'1015  '`. Tap L → `'  SEtS'` then `'     5'`. Tap L → `'  PACE'` then `'     3'`. Tap L → `state === 0`, main `'101523'`.
  - `wrap`: in Count, set `ctx.settings.total = 999`, tap A → `'     1'`. In SEtS at 9, tap A → `'     1'`. In LEngth at 5985, tap A → `' 015  '`.
  - `hold repeats`: in Count at 100, `hold('A', 2000)` → value between 105 and 125.
  - `Er while editing`: total 5 and sets 9 → day `'Er'`.
  - `no edit while running`: start, tap L → `state === 1`.

- [ ] **Step 2: Run them to make sure they fail**

Run: `node --test`
Expected: FAIL on `walk the fields`.

- [ ] **Step 3: Implement** EDIT handling in `button`/`a_long`, plus the edit display in `draw()`. Hold-repeat may use a second `setTimeout`/`setInterval` slot, but the total must stay ≤ 4 slots (display, ring, repeat).

- [ ] **Step 4: Run the tests to make sure they pass**

Run: `node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add repladder.js test/repladder-edit.test.js
git commit -m "repladder: edit count, length, sets and pace on the watch"
```

### Task 7: Off screen

**Files:**
- Modify: `repladder.js`
- Test: `test/repladder-offscreen.test.js`

**Interfaces:**
- Consumes: `lastPhase`, `onPhase`, `startRing(onScreen)` (Tasks 3–4).
- Produces: `function catchUp()`, called from `clock_minute()` and `enter()`. It computes `phaseAt(current, elapsed())`; if that is past `lastPhase` it plays **one** `Ollee.beep()`, or `startRing(Ollee.active())` if finished, then sets `lastPhase`. While running and not paused it subscribes `E_CLOCK_MINUTE`, and unsubscribes otherwise. Lead-in shorts don't play off screen.

- [ ] **Step 1: Write the failing tests:**
  - `subscription`: idle → not subscribed. Start → subscribed. Pause → not; resume → subscribed. Reset → not.
  - `one beep per minute tick`: `at(10000)`, `setActive(false)`, advance to `at(130000)`, `minute()` → `'beep'` count +1.
  - `missed boundaries beep once`: `at(10000)`, `setActive(false)`, advance to `at(300000)` (4 boundaries), `minute()` → exactly +1 `'beep'`.
  - `return shows the right screen`: after the previous test, `setActive(true)` → day `'S3'` (300000 is in set 3: 279000–339000), main `' 03920'`, no extra beep.
  - `finish off screen`: `at(10000)`, `setActive(false)`, advance to `at(605000)`, `minute()` → 15 ring `'beep'` within 5000 ms.

- [ ] **Step 2: Run them to make sure they fail**

Run: `node --test`
Expected: FAIL on `subscription`.

- [ ] **Step 3: Implement** `catchUp`, `clock_minute`, `init` (if needed) and the subscription updates.

- [ ] **Step 4: Run the tests to make sure they pass**

Run: `node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add repladder.js test/repladder-offscreen.test.js
git commit -m "repladder: keep time off screen, catch up at the minute tick"
```

### Task 8: Build, size and README

**Files:**
- Modify: `build.js`, `README.md`
- Create: `repladder.min.js` (generated), `test/repladder-min.test.js`

**Interfaces:**
- `node build.js` builds every face in `var FACES = ['multitimer', 'repladder']` (`<name>.js` → `<name>.min.js`), prints `<name>: N bytes` for each, and exits 1 if any is over 8158. The terser options stay as they are.

- [ ] **Step 1: Write the failing test** `test/repladder-min.test.js`: `loadFace('repladder.min.js')` → main `'100022'`. Tap A, advance 5000 → `' 10622'`, 1 `'beep'`.

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test`
Expected: FAIL, repladder.min.js not found.

- [ ] **Step 3: Generalize `build.js`, then build.** Update its header comment. Run `npm install --no-save terser@5` if `node_modules/terser` is missing.

Run: `node build.js && git diff --exit-code multitimer.min.js`
Expected: `multitimer: … bytes`, `repladder: N bytes` with N ≤ 8158, exit 0, and multitimer.min.js unchanged.

- [ ] **Step 4: README.** Add a row to the face table for `repladder.js` (upload `repladder.min.js`): "Declining-rep workout timer: N reps in S sets over a set time, one fewer rep each set." Add a `## repladder.js` section with short tables for the settings (defaults and ranges), buttons, screen (from the Task 3 display table) and sounds, plus the off-screen caveat (catches up at the minute tick). Mention `node --test` next to the rebuild line, and change that line's `multitimer` mention to cover both faces.

- [ ] **Step 5: Run all gates**

Run: `node --test && node build.js && git diff --exit-code multitimer.min.js`
Expected: all pass, exit 0.

- [ ] **Step 6: Commit**

```bash
git add build.js README.md repladder.min.js test/repladder-min.test.js
git commit -m "repladder: build both faces, README section"
```

### Task 9: Visual check in the emulator (controller only, not delegated)

- [ ] Build the site locally with `tools/build-site.sh <scratch>/site` and serve it with `python3 -m http.server` (backgrounded). Open `/?face=repladder`, by headless Chromium screenshot if available; otherwise ask the user to open it on the iPad (Safari to the Pi's LAN address, or VNC).
- [ ] Confirm by eye that every word renders legibly on the real LCD glyphs: `Count`, `LEngth`, `SEtS`, `PACE`, `StArt`, `PAUSE`, `rESEt`, `donE`, `Error`, `GO`, `S1`, `r1`, `Er`. Also check that `m:ss rr` sits correctly around the colon and that LAP blinks during rest.
- [ ] Any word that reads badly is a copy change: update the Global Constraints word list and the tests, then rebuild.
