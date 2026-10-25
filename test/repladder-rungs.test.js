const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadClassic } = require('./repladder-helpers');

const PUSH = { name: 'PUSH', hold: 0, sets: 5, top: 100, pace: 3, base: 600, level: 1 };
const PULL = { name: 'PULL', hold: 0, sets: 5, top: 50, pace: 3, base: 360, level: 1 };
const PLANK = { name: 'PLAnK', hold: 1, sets: 5, top: 300, pace: 3, base: 600, level: 1 };
const ONE = { name: 'X', hold: 0, sets: 1, top: 20, pace: 3, base: 120, level: 1 };
const SHORT = { name: 'X', hold: 0, sets: 5, top: 100, pace: 3, base: 300, level: 1 };

// Expected rung for a profile: pace is 1 and hold is 1 for holds.
const R = (total, length, sets, p) => ({ total, length, sets, pace: p.hold ? 1 : p.pace, hold: p.hold });

// Checks [sets, total, length] for each listed level of profile p.
function checkRungs(ctx, p, cases) {
  for (const [n, [sets, total, length]] of Object.entries(cases)) {
    assert.deepEqual({ ...ctx.rungAt(p, Number(n)) }, R(total, length, sets, p), `${p.name} level ${n}`);
  }
}

test('rungs PUSH', () => {
  const ctx = loadClassic().ctx;
  // Rest floor 30 s a gap: 5 sets bottom out at 420 s, 4 at 390, 3 at 360, 2 at 330.
  assert.equal(ctx.maxLevel(PUSH), 108);
  checkRungs(ctx, PUSH, {
    1: [5, 15, 600], 2: [5, 17, 600], 19: [5, 51, 600], 43: [5, 99, 600], 44: [5, 100, 600],
    45: [5, 100, 585], 56: [5, 100, 420], 57: [4, 100, 600], 71: [4, 100, 390], 72: [3, 100, 600],
    88: [3, 100, 360], 89: [2, 100, 600], 107: [2, 100, 330], 108: [1, 100, 300],
  });
});

test('rungs PULL', () => {
  const ctx = loadClassic().ctx;
  assert.equal(ctx.maxLevel(PULL), 76);
  checkRungs(ctx, PULL, {
    1: [5, 15, 360], 36: [5, 50, 360], 37: [5, 50, 345], 42: [5, 50, 270], 43: [4, 50, 360],
    52: [3, 50, 360], 63: [2, 50, 360], 75: [2, 50, 180], 76: [1, 50, 150],
  });
});

test('rungs PLAnK', () => {
  const ctx = loadClassic().ctx;
  assert.equal(ctx.maxLevel(PLANK), 115);
  checkRungs(ctx, PLANK, {
    1: [5, 50, 600], 2: [5, 55, 600], 51: [5, 300, 600], 52: [5, 300, 585], 63: [5, 300, 420],
    64: [4, 300, 600], 114: [2, 300, 330], 115: [1, 300, 300],
  });
  for (let n = 1; n <= 115; n++) {
    const r = ctx.rungAt(PLANK, n);
    assert.equal(r.pace, 1, `level ${n} pace`);
    assert.equal(r.hold, 1, `level ${n} hold`);
  }
});

test('rungs one set', () => {
  const ctx = loadClassic().ctx;
  assert.equal(ctx.maxLevel(ONE), 21);
  checkRungs(ctx, ONE, { 1: [1, 1, 120], 2: [1, 2, 120], 20: [1, 20, 120], 21: [1, 20, 60] });
});

test('rungs short base', () => {
  const ctx = loadClassic().ctx;
  assert.equal(ctx.maxLevel(SHORT), 48);
  checkRungs(ctx, SHORT, { 1: [5, 15, 300], 44: [5, 100, 420], 45: [4, 100, 390], 46: [3, 100, 360], 47: [2, 100, 330] });
});

test('out of range', () => {
  const ctx = loadClassic().ctx;
  assert.equal(ctx.rungAt(PUSH, 0), null);
  assert.equal(ctx.rungAt(PUSH, -1), null);
  assert.equal(ctx.rungAt(PUSH, 119), null);
});

test('every rung plans', () => {
  const ctx = loadClassic().ctx;
  for (const p of [PUSH, PULL, PLANK, ONE, SHORT]) {
    const max = ctx.maxLevel(p);
    for (let n = 1; n <= max; n++) {
      const r = ctx.rungAt(p, n);
      assert.ok(ctx.plan(r.total, r.length, r.sets, r.pace, r.hold), `${p.name} level ${n}`);
    }
  }
});

test('hold plan', () => {
  const ctx = loadClassic().ctx;
  assert.deepEqual([...ctx.plan(50, 600, 5, 1, 1).reps], [10, 10, 10, 10, 10]);
  assert.deepEqual([...ctx.plan(52, 600, 5, 1, 1).reps], [11, 11, 10, 10, 10]);
  assert.deepEqual([...ctx.plan(300, 300, 1, 1, 1).ends], [300000]);
});

test('rep plan unchanged', () => {
  const ctx = loadClassic().ctx;
  assert.deepEqual([...ctx.plan(100, 600, 4, 3).reps], [27, 26, 24, 23]);
});
