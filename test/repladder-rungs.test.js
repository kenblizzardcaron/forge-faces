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
  assert.equal(ctx.maxLevel(PUSH), 152);
  checkRungs(ctx, PUSH, {
    1: [5, 15, 600], 2: [5, 16, 600], 37: [5, 51, 600], 85: [5, 99, 600], 86: [5, 100, 600],
    87: [5, 100, 595], 122: [5, 100, 420], 123: [4, 100, 420], 129: [4, 100, 390], 130: [3, 100, 390],
    136: [3, 100, 360], 137: [2, 100, 360], 143: [2, 100, 330], 144: [2, 102, 336], 151: [2, 116, 378],
    152: [1, 100, 300],
  });
});

test('rungs PUSH at PACE 2', () => {
  const ctx = loadClassic().ctx;
  const p = { ...PUSH, pace: 2 };
  assert.equal(ctx.maxLevel(p), 172);
  checkRungs(ctx, p, {
    140: [5, 100, 330], 142: [5, 100, 320], 143: [4, 100, 320], 150: [3, 100, 290], 157: [2, 100, 260],
    164: [2, 102, 234], 171: [2, 116, 262], 172: [1, 100, 200],
  });
});

test('rungs PULL', () => {
  const ctx = loadClassic().ctx;
  assert.equal(ctx.maxLevel(PULL), 84);
  checkRungs(ctx, PULL, {
    1: [5, 15, 360], 36: [5, 50, 360], 37: [5, 50, 355], 54: [5, 50, 270], 55: [4, 50, 270],
    62: [3, 50, 240], 69: [2, 50, 210], 76: [2, 51, 183], 83: [2, 58, 204], 84: [1, 50, 150],
  });
});

test('rungs PLAnK', () => {
  const ctx = loadClassic().ctx;
  assert.equal(ctx.maxLevel(PLANK), 117);
  checkRungs(ctx, PLANK, {
    1: [5, 50, 600], 2: [5, 55, 600], 51: [5, 300, 600], 52: [5, 300, 595], 87: [5, 300, 420],
    88: [4, 300, 420], 95: [3, 300, 390], 102: [2, 300, 360], 109: [2, 306, 336], 116: [2, 348, 378],
    117: [1, 300, 300],
  });
  for (let n = 1; n <= 117; n++) {
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
  assert.equal(ctx.maxLevel(SHORT), 116);
  checkRungs(ctx, SHORT, { 1: [5, 15, 300], 86: [5, 100, 420], 87: [4, 100, 420], 94: [3, 100, 390], 101: [2, 100, 360], 116: [1, 100, 300] });
});

test('out of range', () => {
  const ctx = loadClassic().ctx;
  assert.equal(ctx.rungAt(PUSH, 0), null);
  assert.equal(ctx.rungAt(PUSH, -1), null);
  assert.equal(ctx.rungAt(PUSH, 153), null);
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
