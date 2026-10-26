const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadFace } = require('../tools/harness');
const { damage } = require('./lcd-helpers');

const H = 3600000, D = 86400000;
function fresh() {
  const w = loadFace('fastzone.js');
  return { w, ctx: w.ctx };
}
function fast(ctx, s, e) { ctx.startFast(s); ctx.endFast(e); }

test('L walks the pages and returns to the timer', () => {
  const { w, ctx } = fresh();
  w.tap('L');
  assert.equal(ctx.mode, ctx.STATS);
  assert.equal(ctx.page, 0);
  for (let i = 0; i < 4; i++) w.tap('L');
  assert.equal(ctx.mode, ctx.STATS);
  assert.equal(ctx.page, 4);
  w.tap('L');
  assert.equal(ctx.mode, ctx.TIMER);
});

test('week and streak', () => {
  const { w, ctx } = fresh();
  const t = ctx.now();
  fast(ctx, t - 2 * D - 20 * H, t - 2 * D);
  fast(ctx, t - 1 * D - 20 * H, t - 1 * D);
  w.tap('L');
  assert.equal(w.main(), '2 oF 7');
  assert.equal(w.day(), '  ');
  w.tap('L');
  assert.equal(w.main(), 'Str  2');
  assert.equal(w.day(), '  ');
});

test('average and longest flash their word, then the time', () => {
  const { w, ctx } = fresh();
  const t = ctx.now();
  fast(ctx, t - 3 * D - 16 * H, t - 3 * D);
  fast(ctx, t - 1 * D - 18 * H, t - 1 * D);
  w.tap('L');
  w.tap('L');
  w.tap('L');
  assert.equal(w.main(), '   AUG');
  assert.equal(w.day(), ' A');
  w.advance(2000);
  assert.equal(w.main(), '1700  ');
  assert.equal(w.day(), ' A');
  w.tap('L');
  assert.equal(w.main(), '   tOP');
  assert.equal(w.day(), ' t');
  w.advance(2000);
  assert.equal(w.main(), '1800  ');
  assert.equal(w.day(), ' t');
});

test('history pages with A and marks hits', () => {
  const { w, ctx } = fresh();
  const t = ctx.now();
  fast(ctx, t - 2 * D - 10 * H, t - 2 * D);
  fast(ctx, t - 1 * D - 17 * H, t - 1 * D);
  for (let i = 0; i < 5; i++) w.tap('L');
  assert.equal(ctx.page, 4);
  assert.equal(w.main(), '1700  ');
  assert.equal(w.day(), ' 1');
  assert.equal(w.lap, true);
  w.tap('A');
  assert.equal(w.day(), ' 2');
  assert.equal(w.main(), '1000  ');
  assert.equal(w.lap, false);
  w.tap('A');
  assert.equal(w.day(), ' 1');
  assert.equal(w.main(), '1700  ');
});

test('empty stats show dashes', () => {
  const { w } = fresh();
  w.tap('L');
  w.tap('L');
  w.tap('L');
  w.advance(2000);
  assert.equal(w.main(), '  ----');
  w.tap('L');
  w.advance(2000);
  assert.equal(w.main(), '  ----');
  w.tap('L');
  assert.equal(w.main(), '  ----');
  assert.equal(w.day(), ' 1');
});

test('A in stats never starts a fast', () => {
  const { w, ctx } = fresh();
  w.tap('L');
  w.tap('A');
  assert.equal(ctx.fastStart, 0);
});

test('stats words keep their letters whole', () => {
  for (const word of ['   AUG', '   tOP', '  ----', ' rEAdY', '7 oF 7', 'Str999']) {
    assert.deepEqual(damage(word), [], word);
  }
});
