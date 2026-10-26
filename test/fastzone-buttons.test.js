const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadFace } = require('../tools/harness');

const MIN = 60000;
function fresh() {
  const w = loadFace('fastzone.js');
  return { w, ctx: w.ctx };
}

test('tap A starts a fast now', () => {
  const { w, ctx } = fresh();
  w.tap('A');
  assert.equal(ctx.fastStart, ctx.now());
  assert.equal(w.lap, true);
});

test('hold A opens the picker without starting', () => {
  const { w, ctx } = fresh();
  w.hold('A', 1100);
  assert.equal(ctx.fastStart, 0);
  assert.equal(w.main(), '-000  ');
  assert.equal(w.day(), ' S');
});

test('picker backdates the start', () => {
  const { w, ctx } = fresh();
  w.hold('A', 1100);
  w.tap('A');
  w.tap('A');
  const t = ctx.now();
  w.tap('L');
  assert.equal(ctx.fastStart, t - 30 * MIN);
  assert.equal(ctx.mode, ctx.TIMER);
});

test('picker max respects lastEnd and 6 h', () => {
  const { w, ctx } = fresh();
  const t = ctx.now();
  ctx.startFast(t - 2 * 3600000);
  ctx.endFast(t - 40 * MIN);
  w.hold('A', 1100);
  w.tap('A');
  assert.equal(w.main(), '-015  ');
  w.tap('A');
  assert.equal(w.main(), '-030  ');
  w.tap('A');
  assert.equal(w.main(), '-000  ');
});

test('picker max without lastEnd is 6 h', () => {
  const { w } = fresh();
  w.hold('A', 1100);
  for (let i = 0; i < 24; i++) w.tap('A');
  assert.equal(w.main(), '-600  ');
  w.tap('A');
  assert.equal(w.main(), '-000  ');
});

test('ending a fast always goes through the picker', () => {
  const { w, ctx } = fresh();
  w.tap('A');
  w.tap('A');
  assert.notEqual(ctx.fastStart, 0);
  w.advance(15 * 60000);
  w.hold('A', 1100);
  w.tap('L');
  assert.equal(ctx.fastStart, 0);
  assert.equal(ctx.history.length, 1);
});

test('picker cancels after 10 s idle', () => {
  const { w, ctx } = fresh();
  w.hold('A', 1100);
  // The release at 1.1 s makes the 1 s tick past 10 s idle land at 12 s on the clock.
  w.advance(12000);
  assert.equal(ctx.mode, ctx.TIMER);
  assert.equal(ctx.fastStart, 0);
});

test('leaving the face mid-picker returns to the timer', () => {
  const { w, ctx } = fresh();
  w.hold('A', 1100);
  assert.equal(ctx.mode, ctx.PICK);
  w.setActive(false);
  w.setActive(true);
  assert.equal(ctx.mode, ctx.TIMER);
});
