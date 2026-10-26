# fastzone face Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `fastzone.js`, an intermittent-fasting Forge face: backdatable start/end, countdown to a whole-hour goal, zones 1–5, one goal beep, stats (week, streak, average, longest, history) and settings.

**Architecture:** One ES5 file in the style of `repladder.js`: top-level state vars, a `draw()` that renders from state, a 1 s on-screen tick, and the minute tick off screen. Buttons act on release (`E_BUTTONS`) unless the long hook fired, as repladder does. Everything is computed from timestamps (`now()`), never by counting ticks.

**Tech Stack:** Forge (Espruino ES5), `tools/harness.js` (fake clock) + `node --test`, terser via `build.js`.

**Spec:** `docs/superpowers/specs/2026-10-25-fastzone-design.md`. The site page is a separate plan in kenblizzardcaron-11ty, written after this face ships.

**Delegation:** Tasks 1–9 are each a haiku subagent unit, gated by `node --test` (Task 9 also by `node build.js` under 8158 bytes). Task 10 is controller (Opus) work: the guide prose and the emulator visual check.

## Global Constraints

- ES5 only (`var`, `function`); hooks are top-level functions; no global `setTimeout`/`setInterval`; at most 4 `Ollee` timer slots (this face uses 2: `tickTimer`, `ringTimer`).
- `fastzone.min.js` ≤ **8158 bytes**.
- Main digits are 6 cells, right-aligned; the colon sits between cells 1 and 2. **Cells 0 and 2 share their top and bottom bars**: any word drawn must pass `damage()` (Task 1). Digits are always safe.
- Day digits: the first cell can only show 1–3 or a space.
- Comments: why, not what, ≤ 3 lines; match `repladder.js` density.
- Times: `var HOUR = 3600000, MIN = 60000, DAY = 86400000;`. `Date` has no timezone, so a calendar day is `Math.floor(ms / DAY)`.
- **Builder's call (spec left layout open):** past the goal, main counts **up** the time over as `HHMMSS` and the LAP light blinks (on during even seconds), instead of the spec's `+1:20`. A `+` in cell 0 would light the shared bars and read as `E`.

## Review Focus

1. A hold of A also delivers a press: a hold must never start a fast "now" before the picker opens (Task 5 test `hold A opens the picker without starting`).
2. A button that silences the goal ring must do nothing else, including on release and after a hold (Task 6 test `silencing press is swallowed`).
3. Backdating past the previous fast's end or past 6 h must clamp, not create overlapping or negative fasts (Task 5 test `picker max respects lastEnd and 6 h`).
4. Lowering the goal below the time already fasted must not ring; raising it past must re-arm (Task 8 test `goal change re-arms or quiets the beep`).
5. The face left on another face for hours must catch the goal on the minute tick and still show the right zone on return (Task 6 test `off-screen goal rings on the minute tick for 5 s`).

---

### Task 1: Shared LCD word check

**Files:**
- Create: `test/lcd-helpers.js`
- Modify: `test/repladder-lcd-words.test.js` (drop its local `lcd` context and `damage`, require them)

**Interfaces:**
- Produces: `module.exports = { damage }`; `damage(main: string) -> string[]` exactly as it is in `repladder-lcd-words.test.js` today (right-aligns to 6, flags cells 0 and 2 whose `a`≠`d`, or an `L`).

- [ ] **Step 1:** Move the `lcd` vm context and `damage()` (with its comment) into `test/lcd-helpers.js`; in the repladder test, `const { damage } = require('./lcd-helpers');`.
- [ ] **Step 2:** Run `node --test`. Expected: all pass, same count as before.
- [ ] **Step 3:** Commit `test: share the tied-cell LCD word check`.

### Task 2: Skeleton, settings and formatting helpers

**Files:**
- Create: `fastzone.js`, `test/fastzone-format.test.js`
- Modify: `build.js:8` → `const FACES = ['multitimer', 'repladder', 'fastzone'];`

**Interfaces:**
- Produces (top-level in `fastzone.js`):
  - `const subscribe = E_BUTTONS + E_A_LONG + E_L_LONG;`
  - `var settings = { goal: 16, beep: 1 };` (single line; `face-build.js` rewrites it)
  - `var HOUR, MIN, DAY` (Global Constraints), `var ZONE_HOURS = [4, 12, 16, 24];`
  - `var ZONE_WORDS = ['   FEd', ' CAtAb', '   FAt', '  HEtO', '  AUtO'];`
  - `function now()`, `function pad(n)` as in repladder
  - `function init()`: clamps baked settings — `goal` not an integer in 12..48 → 16; `beep` not 0/1 → 1
  - `function zoneOf(ms) -> 1..5` (ms fasted; boundary hours belong to the higher zone: 4 h → 2)
  - `function hms(ms) -> 'HHMMSS'` (floors to whole seconds; anything past 99:59:59 shows `'995959'`)
  - `function hm(ms) -> 'HHMM  '` (two trailing spaces; same 99:59 cap)
  - `function goalMain(g) -> string`: `g < 24` → `pad(g) + (24 - g) + spaces to 6` (`16` → `'168   '`, `12` → `'1212  '`); `g >= 24` → `pad(g) + '    '`. Colon on iff `g < 24` (the caller draws it).
  - Stubs so the face loads: `function enter() { Ollee.clear(); }`, `function exit() {}`, `function button() {}`, `function a_long() {}`, `function l_long() {}`

- [ ] **Step 1: Write the failing tests** in `test/fastzone-format.test.js` (load with `loadFace('fastzone.js')`, and `localize` from `../build` for baked settings):

```js
test('zones change at 4, 12, 16 and 24 h', () => {
  const H = 3600000;
  assert.deepEqual([0, 4 * H - 1, 4 * H, 12 * H, 16 * H, 24 * H, 60 * H].map(ctx.zoneOf), [1, 1, 2, 3, 4, 5, 5]);
});
test('hms and hm', () => {
  assert.equal(ctx.hms(5 * 3600000 + 42 * 60000 + 18500), '054218');
  assert.equal(ctx.hms(150 * 3600000), '995959');
  assert.equal(ctx.hm(17 * 3600000 + 42 * 60000), '1742  ');
});
test('goal labels', () => {
  assert.deepEqual([16, 17, 18, 23, 12, 36].map(ctx.goalMain), ['168   ', '177   ', '184   ', '231   ', '1212  ', '36    ']);
});
test('baked goal and beep clamp', () => {
  assert.equal(loadSource(localize(src, 'fastzone', { goal: 99, beep: 5 })).ctx.settings.goal, 16);
  assert.equal(loadSource(localize(src, 'fastzone', { goal: 99, beep: 5 })).ctx.settings.beep, 1);
  assert.equal(loadSource(localize(src, 'fastzone', { goal: 18 })).ctx.settings.goal, 18);
});
test('zone words keep their letters whole', () => {
  for (const w of ctx.ZONE_WORDS) assert.deepEqual(damage(w), [], w);
});
```

- [ ] **Step 2:** Run `node --test test/fastzone-format.test.js`. Expected: FAIL (`fastzone.js` missing).
- [ ] **Step 3:** Create `fastzone.js` with the header comment style of repladder (`// fastzone: …` / `// Upload fastzone.min.js, the built copy of this file.`) and the interfaces above; add `fastzone` to `build.js`.
- [ ] **Step 4:** Run `node --test`. Expected: all pass.
- [ ] **Step 5:** Commit `fastzone: skeleton, settings and display helpers`.

### Task 3: Fast records, streak and stats math

**Files:**
- Modify: `fastzone.js`
- Create: `test/fastzone-records.test.js`

**Interfaces:**
- Consumes: Task 2's `settings`, `HOUR`, `DAY`, `now()`.
- Produces:
  - `var fastStart = 0, lastEnd = 0, history = [], streak = 0, longest = 0, rung = 0;` (`fastStart` 0 = not fasting; `history` newest first, entries `{ s, e, hit }`)
  - `function startFast(at)`: sets `fastStart = at`, `rung = 0`
  - `function endFast(at)`: `hit = at - fastStart >= settings.goal * HOUR` (goal in effect now); `history.unshift({ s: fastStart, e: at, hit: hit })`, keep at most 30; `streak = hit ? streak + 1 : 0`; `longest = max(longest, at - fastStart)`; `lastEnd = at`; `fastStart = 0`
  - `function weekHits(t) -> 0..7`: number of distinct days `d` with `floor(t/DAY) - 6 <= d <= floor(t/DAY)` that have a history entry with `hit` and `floor(e/DAY) == d`
  - `function avgMs(t) -> ms`: mean `e - s` over entries with `e > t - 7 * DAY`; 0 if none

- [ ] **Step 1: Write the failing tests** (drive the functions on `w.ctx`; `const H = 3600000, D = 86400000; const t = ctx.now();`):
  - `a fast that reaches the goal hits and grows the streak`: goal 16; `startFast(t - 17*H); endFast(t)` → `history[0].hit === true`, `streak === 1`, `longest === 17*H`, `lastEnd === t`, `fastStart === 0`.
  - `a short fast resets the streak`: after two hits, `startFast(t); endFast(t + 15*H)` → `streak === 0`, `history[0].hit === false`, `longest` unchanged at the earlier max.
  - `the goal in effect at the end judges the fast`: start under goal 16, set `settings.goal = 18` before `endFast` at 17 h → miss.
  - `history keeps the newest 30`: 31 fasts → `history.length === 30`, `history[0]` is the 31st.
  - `week counts days, not fasts`: two hits ending on the same day plus one hit 8 days earlier → `weekHits(t) === 1`; a hit ending 6 days earlier → 2.
  - `average covers the last 7 days`: fasts of 16 h and 18 h inside the window and a 30 h one 8 days back → `avgMs(t) === 17*H`; empty history → 0.
- [ ] **Step 2:** Run `node --test test/fastzone-records.test.js`. Expected: FAIL (`startFast is not a function`).
- [ ] **Step 3:** Implement the interfaces above in `fastzone.js`.
- [ ] **Step 4:** Run `node --test`. Expected: all pass.
- [ ] **Step 5:** Commit `fastzone: fast records, streak, week and average`.

### Task 4: Timer screens, tick and zone word on enter

**Files:**
- Modify: `fastzone.js`
- Create: `test/fastzone-screen.test.js`

**Interfaces:**
- Consumes: Tasks 2–3.
- Produces:
  - `var TIMER = 0, PICK = 1, STATS = 2, SET = 3, mode = TIMER;`
  - `var message = '', messageUntil = 0, tickTimer = -1;`
  - `function flash(word, ms)`: shows `word` on main for `ms` (default 1000), then `draw()` resumes the screen
  - `function draw()`: renders the current `mode`; this task implements `TIMER` only (other modes are added by Tasks 5, 7, 8 as branches of `draw()`)
  - `function tick()`: runs every 1000 ms while on screen (`tickTimer`); calls `draw()` (later tasks add goal and idle checks here)
  - `function enter()`: `Ollee.clear()`, starts `tickTimer`; if fasting, `flash(ZONE_WORDS[zone - 1], 1500)`, else `draw()`
  - `function exit()`: resets `tickTimer = -1` (the platform cancels it)

TIMER screen, exactly:

| State | main | colon | day | LAP |
| --- | --- | --- | --- | --- |
| Fresh (`fastStart == 0 && lastEnd == 0`) | `' rEAdY'` | off | `'  '` | off |
| Fasting, under goal | `hms(goal*HOUR - e)` | on | `' ' + zoneOf(e)` | on |
| Fasting, at/over goal | `hms(e - goal*HOUR)` | on | `' ' + zoneOf(e)` | on in even seconds of `e`, off in odd |
| Eating, goal < 24, window left | `hms(lastEnd + (24-goal)*HOUR - now)` | on | `'  '` | off |
| Eating, goal < 24, window over | `' rEAdY'` | off | `'  '` | off |
| Eating, goal ≥ 24 | `hms(now - lastEnd)` | on | `'  '` | off |

(`e = now - fastStart`.) A flashing `message` replaces main, with the colon off.

- [ ] **Step 1: Write the failing tests** (`w = loadFace('fastzone.js')`; set state through `w.ctx.startFast`/`endFast`, then `w.ctx.draw()` or `w.advance(1000)`):
  - `fresh face reads rEAdY`: `w.main() === ' rEAdY'`, `w.lap === false`.
  - `fasting counts down with the zone`: `startFast(now - 13*H)`, advance 1000 → main `'025959'`, day `' 3'`, `lap === true`, `colon === true`.
  - `past the goal counts up and blinks LAP`: `startFast(now - (16*H + 90000))`, draw → main `'000130'`; LAP differs between two draws 1000 ms apart.
  - `eating counts down the window`: goal 18, `startFast(now - 18*H); endFast(now - H)` → main `'050000'`, day `'  '`, `lap === false`.
  - `window over reads rEAdY` and `goal 36 counts up since the fast ended`.
  - `entering mid-fast flashes the zone word`: `startFast(now - 17*H)`, `w.setActive(false); w.setActive(true)` → main `'  HEtO'`; after `w.advance(2000)` main is a countdown.
- [ ] **Step 2:** Run `node --test test/fastzone-screen.test.js`. Expected: FAIL.
- [ ] **Step 3:** Implement. Draw only while `Ollee.active()`; recompute from `now()` every draw.
- [ ] **Step 4:** Run `node --test`. Expected: all pass.
- [ ] **Step 5:** Commit `fastzone: timer screens and zone word on enter`.

### Task 5: Buttons and the backdate picker

**Files:**
- Modify: `fastzone.js`
- Create: `test/fastzone-buttons.test.js`

**Interfaces:**
- Consumes: Tasks 2–4.
- Produces:
  - `var longFired = 0, lastPress = 0;` (`longFired` is a bitmask by button id, as in repladder; `lastPress` = `now()` at the latest button event)
  - `var pickStart = 1, pickBack = 0;` (`pickStart` 1 = starting a fast, 0 = ending one; `pickBack` in minutes)
  - `function pickMax() -> minutes`: `min(360, floor(limit / 15) * 15)`, where limit = `(now - lastEnd)/MIN` when starting with a `lastEnd`, `(now - fastStart)/MIN` when ending, else 360
  - `function button(b, e)`: acts on release (`e == E_UP`) unless that button's `longFired` bit is set (then clears it and does nothing)
  - `function a_long()`, `function l_long()`: set the bit, then act (L long is Task 8's; here it only sets the bit)

Behavior:

| Mode | A tap | Hold A | L tap |
| --- | --- | --- | --- |
| TIMER, not fasting | `startFast(now)` | open PICK, `pickStart = 1`, `pickBack = 0` | Task 7 |
| TIMER, fasting | `flash` the current zone word, 1500 ms | open PICK, `pickStart = 0`, `pickBack = 0` | Task 7 |
| PICK | `pickBack += 15`, past `pickMax()` wraps to 0 | — | confirm: `startFast(now - pickBack*MIN)` or `endFast(now - pickBack*MIN)`, back to TIMER |

PICK screen: main `'-' + floor(pickBack/60) + pad(pickBack % 60) + '  '`, colon on, day `' S'` (starting) or `' E'` (ending), LAP off. `tick()` returns PICK, STATS and SET to TIMER (PICK cancels) once `now - lastPress >= 10000`.

- [ ] **Step 1: Write the failing tests** (`w.tap('A')`, `w.hold('A', 1100)`, `w.tap('L')`):
  - `tap A starts a fast now`: fresh → `fastStart === now`, `lap === true`.
  - `hold A opens the picker without starting`: fresh, `w.hold('A', 1100)` → `fastStart === 0`, main `'-000  '`, day `' S'`.
  - `picker backdates the start`: hold A, tap A twice, tap L → `fastStart === now - 30*MIN`, mode TIMER.
  - `picker max respects lastEnd and 6 h`: a fast ended 40 min ago, then hold A and tap A three times → main reads `'-015  '`, `'-030  '`, `'-000  '` (the max is 30). With no `lastEnd`, 24 taps reach `'-600  '` and the 25th wraps to `'-000  '`.
  - `ending a fast always goes through the picker`: fasting, tap A → still fasting (main shows the zone word); hold A, tap L → `fastStart === 0`, `history.length === 1`.
  - `picker cancels after 10 s idle`: hold A, `w.advance(10000)` → mode TIMER, `fastStart === 0`.
- [ ] **Step 2:** Run `node --test test/fastzone-buttons.test.js`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `node --test`. Expected: all pass.
- [ ] **Step 5:** Commit `fastzone: start, end and the backdate picker`.

### Task 6: Goal beep, on and off screen

**Files:**
- Modify: `fastzone.js`
- Create: `test/fastzone-beep.test.js`

**Interfaces:**
- Consumes: Tasks 2–5 (`rung` from Task 3).
- Produces:
  - `var ringTimer = -1, ringLeft = 0, hush = 0;` (`hush`: bitmask of buttons whose press silenced the ring)
  - `function startRing(onScreen)`: `Ollee.beep()` every 500 ms on `ringTimer`, 40 beeps on screen, 10 off screen (multitimer's ping counts)
  - `function stopRing()`
  - `function checkGoal()`: if fasting, `!rung` and `now - fastStart >= goal*HOUR` → `rung = 1`; ring if `settings.beep`
  - `function updateSubscriptions()`: `Ollee.subscribe(E_CLOCK_MINUTE)` iff fasting and `!rung` and `settings.beep`, else unsubscribe; called after start, end, settings changes and `checkGoal`
  - `function clock_minute()`: `checkGoal()`
  - `tick()` and `enter()` call `checkGoal()` first

A button press (`e != E_UP`) while ringing stops it and sets that button's `hush` bit; its release, and its long hook if the hold continues, then do nothing and clear the bit.

- [ ] **Step 1: Write the failing tests:**
  - `goal rings once on screen`: `startFast(now - 16*H + 2000)`, advance 3000 → beeps start; advance 30000 → exactly 40 beeps total; advance another hour → still 40.
  - `beep off stays silent`: `settings.beep = 0`, same setup → 0 beeps, `rung === 1`.
  - `off-screen goal rings on the minute tick for 5 s`: fasting 15 h 59 m, `setActive(false)`, `w.subscribed(E_CLOCK_MINUTE) === true`; advance 60000, `w.minute()` → beeps total 10 after advancing 6000; `w.subscribed(E_CLOCK_MINUTE) === false`; `setActive(true)` → day `' 4'`.
  - `silencing press is swallowed`: ringing, `w.tap('A')` → ring stopped, `mode === TIMER`, still fasting, no flash of the zone word; `w.hold('A', 1100)` during a ring → no picker.
- [ ] **Step 2:** Run `node --test test/fastzone-beep.test.js`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `node --test`. Expected: all pass.
- [ ] **Step 5:** Commit `fastzone: goal beep on and off screen`.

### Task 7: Stats pages

**Files:**
- Modify: `fastzone.js`
- Create: `test/fastzone-stats.test.js`

**Interfaces:**
- Consumes: Tasks 3–5 (`weekHits`, `avgMs`, `history`, `streak`, `longest`, `mode`, `lastPress`, `flash`).
- Produces: `var page = 0, histIdx = 0;` and the STATS branch of `draw()`.

L tap in TIMER enters STATS on page 0; in STATS, L goes to the next page, and after page 4 back to TIMER. Entering a page sets `histIdx = 0`. A tap in STATS only acts on page 4 (`histIdx + 1`, wrapping to 0 past the last entry); it never starts or ends a fast. Colon on for durations, off otherwise; LAP off except on page 4.

| Page | Flash on entering (1000 ms) | main | day |
| --- | --- | --- | --- |
| 0 week | — | `weekHits(now) + ' oF 7'` | `'  '` |
| 1 streak | — | `'Str' + ('   ' + min(streak, 999)).slice(-3)` | `'  '` |
| 2 average | `'   AUG'` | `hm(avgMs(now))`, or `'  ----'` if 0 | `' A'` |
| 3 longest | `'   tOP'` | `hm(longest)`, or `'  ----'` if 0 | `' t'` |
| 4 history | — | `hm(e - s)` of `history[histIdx]`, or `'  ----'` if empty | `pad(histIdx + 1)` with a leading space for 1–9 (`' 1'`, `'30'`) |

On page 4, LAP is on iff that entry hit its goal.

- [ ] **Step 1: Write the failing tests** (seed with `startFast`/`endFast` at chosen times, then tap L):
  - `L walks the pages and returns to the timer`: six L taps from TIMER → mode back to TIMER.
  - `week and streak`: two hit days → page 0 main `'2 oF 7'`; page 1 `'Str  2'`.
  - `average and longest flash their word, then the time`: page 2 main `'   AUG'`, after `advance(1100)` `'1700  '`, day `' A'`; page 3 likewise with `'   tOP'`.
  - `history pages with A and marks hits`: page 4 main `hm` of the newest fast, day `' 1'`, `lap` matches `hit`; A → day `' 2'`; A past the end → `' 1'`.
  - `empty stats show dashes`: fresh face, pages 2–4 main `'  ----'` (after the flash on 2 and 3).
  - `A in stats never starts a fast`: fresh, L then A → `fastStart === 0`.
  - `stats words keep their letters whole`: `damage()` is empty for `'   AUG'`, `'   tOP'`, `'  ----'`, `' rEAdY'`, `'7 oF 7'`, `'Str999'`.
- [ ] **Step 2:** Run `node --test test/fastzone-stats.test.js`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `node --test`. Expected: all pass.
- [ ] **Step 5:** Commit `fastzone: stats pages`.

### Task 8: Settings

**Files:**
- Modify: `fastzone.js`
- Create: `test/fastzone-settings.test.js`

**Interfaces:**
- Consumes: Tasks 2–7 (`l_long`, `rung`, `updateSubscriptions`).
- Produces: `var setField = 0;` (0 goal, 1 beep), `function setGoal(g)`, and the SET branch of `draw()`.

Hold L from TIMER or STATS enters SET on the goal. In SET: A steps the field (goal +1, 48 wraps to 12; beep toggles 1/0); L moves to beep, then back to TIMER. Goal screen: main `goalMain(goal)`, colon iff goal < 24, day `' G'`. Beep screen: main `' bEEP '`, day `' 1'` or `' 0'`.

`setGoal(g)`: `settings.goal = g`; while fasting, `rung = now - fastStart >= g*HOUR ? 1 : 0` (lowering below the time fasted never rings; raising past it re-arms); then `updateSubscriptions()`. Toggling beep also calls `updateSubscriptions()`.

- [ ] **Step 1: Write the failing tests:**
  - `hold L edits the goal`: `w.hold('L', 1600)` → main `'168   '`, day `' G'`; A → `'177   '`; 32 more A taps from 17 wrap through 48 to 12 → `'1212  '`.
  - `beep toggles and L returns`: hold L, L → main `' bEEP '`, day `' 1'`; A → `' 0'`; L → mode TIMER, `settings.beep === 0`.
  - `goal change re-arms or quiets the beep`: fasting 17 h with goal 16 already rung; setGoal(18) → `rung === 0`, advancing past 18 h rings; then fasting 17 h, goal 18, setGoal(16) → `rung === 1` and no beeps.
  - `settings words keep their letters whole`: `damage(' bEEP ') ` is empty.
- [ ] **Step 2:** Run `node --test test/fastzone-settings.test.js`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `node --test`. Expected: all pass.
- [ ] **Step 5:** Commit `fastzone: goal and beep settings`.

### Task 9: Build, size and README

**Files:**
- Create: `fastzone.min.js` (generated), `test/fastzone-min.test.js`
- Modify: `README.md` (face table row)

**Interfaces:**
- Consumes: the finished `fastzone.js`.

- [ ] **Step 1: Write the failing test** `test/fastzone-min.test.js`: `minified build starts, fasts and rings` — `loadFace('fastzone.min.js')`: main `' rEAdY'`; tap A; `advance(16 * 3600000 + 2000)` → at least one beep; and `fs.statSync('fastzone.min.js').size <= 8158`.
- [ ] **Step 2:** Run it. Expected: FAIL (no min file).
- [ ] **Step 3:** Run `node build.js`. Expected: a `fastzone.min.js: N bytes` line with N ≤ 8158 and exit 0. If N > 8158, cut in the spec's order (Longest page → Average page → history 30 → 10 → zone-word flash), removing the matching tests, and report what was cut.
- [ ] **Step 4:** Add the README row after repladder's, matching its columns: `| [fastzone.js](fastzone.js) (upload [fastzone.min.js](fastzone.min.js)) | [fastzone.md](fastzone.md) | [Open in emulator](https://kenblizzardcaron.github.io/forge-faces/?face=fastzone) | Intermittent fasting timer: start or end a fast now or backdated, count down to a whole-hour goal (16:8, 18:4, 23:1…) through five fasting zones, one beep at the goal, and stats for the week, streak, average, longest and the last 30 fasts. |`
- [ ] **Step 5:** Run `node --test`. Expected: all pass.
- [ ] **Step 6:** Commit `fastzone: minified build and README row`.

### Task 10 (controller, not delegated): Guide and on-LCD check

- [ ] Write `fastzone.md` in the style of `multitimer.md`/`repladder.md`: what it is, zones table, buttons table, screens table, stats, settings, off screen (goal beep up to 59 s late), `local.json` (`{"fastzone": {"goal": 18, "beep": 1}}`), no storage. The README links it, so `?face=fastzone` and the `.md` must both resolve.
- [ ] Run the face in the local emulator (`tools/build-site.sh` output, `?face=fastzone`) and screenshot the zone words, picker, stats and settings screens; fix any word that reads badly on the LCD.
- [ ] Check the push window, `git fetch`, rebase if needed, `node --test`, push `main`.
