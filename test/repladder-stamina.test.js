const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadClassic } = require('./repladder-helpers');

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
