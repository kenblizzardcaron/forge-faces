const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadFace } = require('../tools/harness');

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
