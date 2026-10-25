const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadFace } = require('../tools/harness');

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
  const ctx = loadFace('repladder.js').ctx;
  assert.equal(ctx.maxLevel(PUSH), 118);
  checkRungs(ctx, PUSH, {
    1: [5, 15, 600], 2: [5, 17, 600], 19: [5, 51, 600], 43: [5, 99, 600], 44: [5, 100, 600],
    45: [5, 100, 585], 60: [5, 100, 360], 61: [4, 100, 600], 78: [4, 100, 345], 79: [3, 100, 600],
    97: [3, 100, 330], 98: [2, 100, 600], 117: [2, 100, 315], 118: [1, 100, 300],
  });
});

test('rungs PULL', () => {
  const ctx = loadFace('repladder.js').ctx;
  assert.equal(ctx.maxLevel(PULL), 86);
  checkRungs(ctx, PULL, {
    1: [5, 15, 360], 36: [5, 50, 360], 37: [5, 50, 345], 46: [5, 50, 210], 47: [4, 50, 360],
    85: [2, 50, 165], 86: [1, 50, 150],
  });
});

test('rungs PLAnK', () => {
  const ctx = loadFace('repladder.js').ctx;
  assert.equal(ctx.maxLevel(PLANK), 125);
  checkRungs(ctx, PLANK, {
    1: [5, 50, 600], 2: [5, 55, 600], 51: [5, 300, 600], 52: [5, 300, 585], 67: [5, 300, 360],
    68: [4, 300, 600], 124: [2, 300, 315], 125: [1, 300, 300],
  });
  for (let n = 1; n <= 125; n++) {
    const r = ctx.rungAt(PLANK, n);
    assert.equal(r.pace, 1, `level ${n} pace`);
    assert.equal(r.hold, 1, `level ${n} hold`);
  }
});

test('rungs one set', () => {
  const ctx = loadFace('repladder.js').ctx;
  assert.equal(ctx.maxLevel(ONE), 21);
  checkRungs(ctx, ONE, { 1: [1, 1, 120], 2: [1, 2, 120], 20: [1, 20, 120], 21: [1, 20, 60] });
});

test('rungs short base', () => {
  const ctx = loadFace('repladder.js').ctx;
  assert.equal(ctx.maxLevel(SHORT), 48);
  checkRungs(ctx, SHORT, { 1: [5, 15, 300], 44: [5, 100, 360], 45: [4, 100, 345], 46: [3, 100, 330] });
});

test('out of range', () => {
  const ctx = loadFace('repladder.js').ctx;
  assert.equal(ctx.rungAt(PUSH, 0), null);
  assert.equal(ctx.rungAt(PUSH, -1), null);
  assert.equal(ctx.rungAt(PUSH, 119), null);
});

test('every rung plans', () => {
  const ctx = loadFace('repladder.js').ctx;
  for (const p of [PUSH, PULL, PLANK, ONE, SHORT]) {
    const max = ctx.maxLevel(p);
    for (let n = 1; n <= max; n++) {
      const r = ctx.rungAt(p, n);
      assert.ok(ctx.plan(r.total, r.length, r.sets, r.pace, r.hold), `${p.name} level ${n}`);
    }
  }
});

test('hold plan', () => {
  const ctx = loadFace('repladder.js').ctx;
  assert.deepEqual([...ctx.plan(50, 600, 5, 1, 1).reps], [10, 10, 10, 10, 10]);
  assert.deepEqual([...ctx.plan(52, 600, 5, 1, 1).reps], [11, 11, 10, 10, 10]);
  assert.deepEqual([...ctx.plan(300, 300, 1, 1, 1).ends], [300000]);
});

test('rep plan unchanged', () => {
  const ctx = loadFace('repladder.js').ctx;
  assert.deepEqual([...ctx.plan(100, 600, 4, 3).reps], [27, 26, 24, 23]);
});
