# Rep Ladder stamina-scored ladder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Rep Ladder's level order so a higher level is never easier than the one before it, with smaller steps.

**Architecture:** A `score()` function models stamina draining per rep and refilling in rest. `eachRung` drops the reset to LEn, cuts time 5 s per level, and uses the score to guard set drops and end a new over-target stretch.

**Tech Stack:** ES5 JavaScript for the Ollee Forge (Espruino), `node --test` with `tools/harness.js`, terser via `node build.js`.

**Spec:** `docs/superpowers/specs/2026-10-30-repladder-stamina-ladder-design.md`

## Delegation

Every task goes to a `model: haiku` subagent. The gate for every task is `node build.js && node --test`, run serially: exit 0 with all tests passing, and `repladder.min.js` at or under 8158 bytes. Commit `repladder.min.js` with every `repladder.js` change. The controller reviews each diff and writes all commit text.

## Global Constraints

- `TAU = 90`, `MIN_REST` stays 30, time cuts are 5 s, the LEn field keeps its 15 s step.
- ES5 only (`var`, `function`). No `Math.exp`: use `decay()`.
- Comments are at most 3 lines and say why. Say LEVEL in docs; `LEUEL` is only the LCD string.
- Don't change `plan()`, LEVEL 0 behaviour, the lead-in or the offer flow.
- Run the gate serially, and don't run two `node --test` at once.

## Review Focus

- A LEVEL 0 slot no ladder can plan (top 1, 5 sets): `maxLevel` must return without throwing or looping forever. Task 2 tests it.
- The biggest allowed tops: no over-target rung passes 999 reps or 5985 s. Task 2 tests it.
- LEn below the rest floor: the set drop still keeps the time. Task 2's `rungs short base` pins it.
- A ladder over 999 levels reached from LEVEL 0: LEVEL stops at 999, then wraps to 0. Task 3 tests it.
- Running an over-target session: 102 reps must run through to the offer. Task 2 tests it.

---

### Task 1: Score

**Files:**
- Modify: `repladder.js` (add above `eachRung`, after `MIN_REST`)
- Create: `test/repladder-stamina.test.js`

**Interfaces:**
- Consumes: `plan(total, length, sets, pace, hold)`, which returns `{ reps, ends }` or null.
- Produces: `TAU`; `decay(x) -> number`; `score(total, length, sets, pace, hold) -> number`, `Infinity` when `plan()` returns null.

- [ ] **Step 1: Write the failing tests** in `test/repladder-stamina.test.js`, using `loadClassic` from `./repladder-helpers`:

```js
test('decay', () => {
  const ctx = loadClassic().ctx;
  assert.equal(ctx.decay(0), 1);
  assert.ok(Math.abs(ctx.decay(1 / 3) - 0.7178) < 0.0001);
  assert.ok(ctx.decay(100) >= 0);
});

test('score', () => {
  const ctx = loadClassic().ctx;
  assert.equal(ctx.score(100, 300, 1, 3), 100);
  assert.ok(Math.abs(ctx.score(100, 600, 5, 3) - 33.70) < 0.01);
  assert.ok(Math.abs(ctx.score(100, 600, 4, 3) - 35.76) < 0.01);
  assert.equal(ctx.score(1, 600, 5, 3), Infinity);
});
```

- [ ] **Step 2: Run** `node --test test/repladder-stamina.test.js`. Expected: FAIL, `ctx.decay is not a function`.

- [ ] **Step 3: Implement.** `decay(x)` sets `v = 1 + x / 32`, squares it 5 times, and returns `1 / v`. `score` computes `e = decay(rest / TAU)` with `rest = (length - total * pace) / (sets - 1)`, or `e = 0` for one set, then for each `r` in `plan().reps` does `d = d * e + r` and keeps the largest `d`. Comment why `decay` isn't `Math.exp`: it isn't in every Espruino build, and a missing one disables the face.

- [ ] **Step 4: Run the gate.** Expected: PASS, 174 tests.

- [ ] **Step 5: Commit** `repladder.js`, `repladder.min.js`, `test/repladder-stamina.test.js`.

### Task 2: The ladder

**Files:**
- Modify: `repladder.js` (`eachRung`)
- Modify: `test/repladder-helpers.js`, `test/repladder-rungs.test.js`, `test/repladder-offer.test.js`, `test/repladder-edit.test.js`, `test/repladder-run.test.js`, `test/repladder-stamina.test.js`

**Interfaces:**
- Consumes: `score`, `MIN_REST`.
- Produces: `eachRung(p, emit)` with its contract unchanged.

- [ ] **Step 1: Add the failing tests** to `test/repladder-stamina.test.js`, with `manual` also imported and `PACE2 = { name: 'X', hold: 0, sets: 5, top: 100, pace: 2, base: 600, level: 1 }`:

```js
test('no rung is easier than the last, across slots', () => {
  const ctx = loadClassic().ctx;
  for (const hold of [0, 1]) for (let sets = 1; sets <= 9; sets++) for (const top of hold ? [60, 300, 1200] : [30, 50, 100, 300]) {
    for (const pace of hold ? [1] : [1, 2, 3, 10]) for (const base of [120, 600, 1800]) {
      const p = { hold, sets, top, pace, base };
      if (top < (hold ? 10 * sets : sets * (sets + 1) / 2)) continue;
      const id = JSON.stringify(p);
      let prev = 0, n = 0;
      // One eachRung walk: rungAt per level is quadratic and takes minutes on a Pi.
      ctx.eachRung(p, (total, length, s) => {
        const v = ctx.score(total, length, s, hold ? 1 : pace, hold);
        n++;
        assert.ok(v < Infinity, `${id} level ${n} plans`);
        assert.ok(v >= prev - 1e-9, `${id} level ${n}: ${v} < ${prev}`);
        prev = v;
        return false;
      });
      assert.ok(n >= 1, id);
    }
  }
});

test('over-target rungs score under the top and sit at the rest floor', () => {
  const ctx = loadClassic().ctx;
  for (let n = 164; n <= 171; n++) {
    const r = ctx.rungAt(PACE2, n);
    assert.equal(r.sets, 2);
    assert.ok(r.total > 100);
    assert.equal(r.length, r.total * 2 + 30);
    assert.ok(ctx.score(r.total, r.length, 2, 2, 0) < 100);
  }
});

test('over target stays on the LCD at the biggest top', () => {
  const ctx = loadClassic().ctx;
  for (const p of [{ hold: 0, sets: 2, top: 900, pace: 6, base: 600 }, { hold: 1, sets: 2, top: 5000, pace: 3, base: 600 }]) {
    const max = ctx.maxLevel(p);
    for (let n = max - 30; n <= max; n++) {
      const r = ctx.rungAt(p, n);
      assert.ok(r.length <= 5985, `length ${r.length}`);
      assert.ok(p.hold || r.total <= 999, `total ${r.total}`);
    }
    assert.deepEqual([ctx.rungAt(p, max).sets, ctx.rungAt(p, max).total], [1, p.top]);
  }
});

test('a manual session no ladder can plan still loads', () => {
  const w = loadClassic();
  manual(w, { top: 1, base: 600, sets: 5, pace: 3 });
  assert.ok(w.ctx.maxLevel(w.ctx.cur()) >= 1);
});

test('an over-target session runs to the offer', () => {
  const w = loadClassic();
  w.advance(1000);
  w.ctx.setLevel(144);
  w.ctx.draw();
  assert.equal(w.ctx.session.total, 102);
  w.tap('A');
  w.advance(5000 + w.ctx.session.length * 1000 + 1000);
  assert.equal(w.ctx.state, w.ctx.OFFER);
});
```

- [ ] **Step 2: Re-pin `test/repladder-rungs.test.js`.** Replace the listed values; keep each test's other lines:

| Test | maxLevel | `checkRungs` cases |
| --- | --- | --- |
| `rungs PUSH` | 152 | `1: [5, 15, 600], 2: [5, 16, 600], 37: [5, 51, 600], 85: [5, 99, 600], 86: [5, 100, 600], 87: [5, 100, 595], 122: [5, 100, 420], 123: [4, 100, 420], 129: [4, 100, 390], 130: [3, 100, 390], 136: [3, 100, 360], 137: [2, 100, 360], 143: [2, 100, 330], 144: [2, 102, 336], 151: [2, 116, 378], 152: [1, 100, 300]` |
| `rungs PUSH at PACE 2` (new; `const p = { ...PUSH, pace: 2 }`) | 172 | `140: [5, 100, 330], 142: [5, 100, 320], 143: [4, 100, 320], 150: [3, 100, 290], 157: [2, 100, 260], 164: [2, 102, 234], 171: [2, 116, 262], 172: [1, 100, 200]` |
| `rungs PULL` | 84 | `1: [5, 15, 360], 36: [5, 50, 360], 37: [5, 50, 355], 54: [5, 50, 270], 55: [4, 50, 270], 62: [3, 50, 240], 69: [2, 50, 210], 76: [2, 51, 183], 83: [2, 58, 204], 84: [1, 50, 150]` |
| `rungs PLAnK` | 117 (its loop runs to 117) | `1: [5, 50, 600], 2: [5, 55, 600], 51: [5, 300, 600], 52: [5, 300, 595], 87: [5, 300, 420], 88: [4, 300, 420], 95: [3, 300, 390], 102: [2, 300, 360], 109: [2, 306, 336], 116: [2, 348, 378], 117: [1, 300, 300]` |
| `rungs short base` | 116 | `1: [5, 15, 300], 86: [5, 100, 420], 87: [4, 100, 420], 94: [3, 100, 390], 101: [2, 100, 360], 116: [1, 100, 300]` |

`rungs one set` doesn't change. In `out of range`, `rungAt(PUSH, 119)` becomes `rungAt(PUSH, 153)`.

- [ ] **Step 3: Re-pin the level numbers in the other tests.**

| File | Change |
| --- | --- |
| `test/repladder-helpers.js` | CLASSIC PUSH `level: 19` to `level: 37` |
| `test/repladder-offer.test.js` | comment "default level 19" to 37; `level, 19` to 37; `level, 20` to 38; `' 20 UP'` to `' 38 UP'`; `session.total, 53` to 52; `setLevel(108)` to 152; `setLevel(107)` to 151 and its comment to "Level 151: 2 sets of 116 in 6:18"; `w.at(340000)` to `w.at(388000)`; `'108 UP'` to `'152 UP'`; `level, 108` to 152 |
| `test/repladder-edit.test.js` | `setLevel(118)` to `setLevel(999)` (all); `level, 19` to 37; `' 19 51'` to `' 37 51'`; `' 20 53'` to `' 38 52'`; `session.total, 53` to 52; `setLevel(55)` to 89; `session.length, 555` to 705 |
| `test/repladder-run.test.js` | `setLevel(118)` to `setLevel(999)`; `setLevel(45)` to 89; `'45 LEU'` to `'89 LEU'` |

- [ ] **Step 4: Run** `node --test test/repladder-stamina.test.js`. Expected: FAIL on the new ladder tests.

- [ ] **Step 5: Replace `eachRung`** with this. Rewrite the comment above it to name the stretches: add reps, cut time, drop sets, over target, last set.

```js
function eachRung(p, emit) {
  var S = p.sets, T = p.top, H = p.hold, P = H ? 1 : p.pace, B = p.base;
  var step = H ? S : Math.ceil(T / 100), t = H ? 10 * S : S * (S + 1) / 2;
  for (;;) {
    t = Math.min(T, t);
    if (emit(t, Math.max(B, t * P + MIN_REST * (S - 1)), S)) return;
    if (t == T) break;
    t += step;
  }
  var len = Math.max(B, T * P + MIN_REST * (S - 1));
  for (var s = S; s > 1; s--) {
    // A set drop keeps the time; rungs still easier than the last one are skipped.
    var floor = T * P + MIN_REST * (s - 1), hi = s < S ? score(T, len, s + 1, P, H) : 0, first = s < S;
    while (first || len > floor) {
      if (!first) len = Math.max(floor, len - 5);
      first = false;
      if (!hi || score(T, len, s, P, H) >= hi) { hi = 0; if (emit(T, len, s)) return; }
    }
  }
  if (S > 1) for (var o = Math.ceil(T / 50), x = T + o; x <= 999 && x * P + MIN_REST <= 5985 && score(x, x * P + MIN_REST, 2, P, H) < T; x += o) if (emit(x, x * P + MIN_REST, 2)) return;
  emit(T, T * P, 1);
}
```

- [ ] **Step 6: Run the gate.** Expected: PASS. If a re-pinned value fails, report it rather than changing `eachRung`; the controller decides.

- [ ] **Step 7: Commit** `repladder.js`, `repladder.min.js` and the six test files.

### Task 3: LEVEL stops at 999

**Files:**
- Modify: `repladder.js` (`bump`, the `level` branch)
- Test: `test/repladder-stamina.test.js`

**Interfaces:**
- Consumes: `maxLevel(p)`.
- Produces: nothing new.

- [ ] **Step 1: Write the failing test:**

```js
test('LEVEL stops at 999 on a ladder longer than that', () => {
  const w = loadClassic();
  const p = w.ctx.cur();
  Object.assign(p, { hold: 1, sets: 1, top: 1200, base: 1800, level: 999 });
  w.ctx.load();
  assert.ok(w.ctx.maxLevel(p) > 999);
  for (let i = 0; i < 4; i++) w.tap('L');
  w.tap('A');
  assert.equal(p.level, 0);
});
```

- [ ] **Step 2: Run** `node --test test/repladder-stamina.test.js`. Expected: FAIL, `1000 !== 0`.

- [ ] **Step 3: Implement.** In `bump`, the level branch becomes `p.level = p.level < Math.min(999, maxLevel(p)) ? p.level + 1 : 0`.

- [ ] **Step 4: Run the gate.** Expected: PASS.

- [ ] **Step 5: Commit** `repladder.js`, `repladder.min.js`, `test/repladder-stamina.test.js`.

### Task 4: Docs and local settings

**Files:**
- Modify: `repladder.md`
- Modify: `local.json` (gitignored; don't commit it)

**Interfaces:**
- Consumes: the level numbers pinned in Task 2.
- Produces: nothing.

- [ ] **Step 1: Update `repladder.md`.**
  - Line 11: the offer's small step becomes "a rep more, 5 s less, one fewer set, or a few reps over LASt".
  - Line 7: LASt stays the last level, and note that the 2-set levels just before it can go past that total.
  - Line 22: LEn is the time the ladder starts from.
  - Ladders table (lines 28–30): Levels 108→152, 76→84, 115→117. It lists push-ups at PACE 3.
  - `## The ladder`: "three stretches" becomes four. **Add reps:** +1 per level, or Count ÷ 100 rounded up. **Cut time:** 5 s per level, reason for 30 s unchanged. **Drop a set:** the time carries over, and any level still easier than the last is skipped. **Go over target (new):** 2 sets at 30 s rest, adding Count ÷ 50 rounded up per level, until the next level would be as hard as the last one.
  - After the stretches add: "A level's score is the fresh max it takes, assuming you hold PACE: reps drain stamina, and rest refills it with a 90 s time constant. Each level scores at least as high as the one before."
  - Key rungs table: push-ups `86: 5 sets, 100 in 10:00`, 123, 130, 137, `152: 1 × 100 in 5:00`; pull-ups `36: 5 sets, 50 in 6:00`, 55, 62, 69, `84: 1 × 50 in 2:30`; plank `51: 5 × 60 s in 10:00`, 88, 95, 102, `117: 1 × 5:00`.
  - Screen table: ` 39 91` to ` 77 91`, `LEU 39` to `LEU 77`.
  - `local.json` example: PUSH `level` 39 to 77.
  - Line 112: replace with "Level numbers changed when the ladder became scored (100 push-ups in 10:00 at PACE 3 moved from level 44 to level 86), so set your level again after upgrading."

- [ ] **Step 2: Set `local.json`** PUSH to `"pace": 2, "level": 140`. Leave the other slots.

- [ ] **Step 3: Run the gate.** Expected: PASS. Then run `grep -n '108\|LEUEL' repladder.md`. Expected: only LCD-string uses of `LEUEL`, and no stale level 108.

- [ ] **Step 4: Commit** `repladder.md`.

### After Task 4 (controller)

- [ ] Load `repladder-local.js` with `loadSource` from `tools/harness` and confirm PUSH boots at level 140: 5 sets, 100 reps, 330 s.
- [ ] Check the push window with `TZ=America/Denver date`, then push `main`.
- [ ] Record the Beta 2 checks from the spec: LEVEL scroll speed, an over-target session, `Math.exp`. They stay open until a real watch exists.
