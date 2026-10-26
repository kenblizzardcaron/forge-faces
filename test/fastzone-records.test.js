const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadFace } = require('../tools/harness');

const H = 3600000, D = 86400000, MIN = 60000;
function fresh() {
  const ctx = loadFace('fastzone.js').ctx;
  return { ctx, t: ctx.now() };
}
function fast(ctx, s, e) { ctx.startFast(s); ctx.endFast(e); }

test('a fast that reaches the goal hits and grows the streak', () => {
  const { ctx, t } = fresh();
  ctx.startFast(t - 17 * H);
  ctx.endFast(t);
  assert.equal(ctx.history[0].hit, true);
  assert.equal(ctx.streak, 1);
  assert.equal(ctx.longest, 17 * H);
  assert.equal(ctx.lastEnd, t);
  assert.equal(ctx.fastStart, 0);
});

test('a short fast resets the streak', () => {
  const { ctx, t } = fresh();
  fast(ctx, t - 40 * H, t - 23 * H);
  fast(ctx, t - 22 * H, t - 5 * H);
  assert.equal(ctx.streak, 2);
  assert.equal(ctx.longest, 17 * H);
  ctx.startFast(t);
  ctx.endFast(t + 15 * H);
  assert.equal(ctx.streak, 0);
  assert.equal(ctx.history[0].hit, false);
  assert.equal(ctx.longest, 17 * H);
});

test('the goal in effect at the end judges the fast', () => {
  const { ctx, t } = fresh();
  ctx.settings.goal = 16;
  ctx.startFast(t);
  ctx.settings.goal = 18;
  ctx.endFast(t + 17 * H);
  assert.equal(ctx.history[0].hit, false);
});

test('history keeps the newest 30', () => {
  const { ctx, t } = fresh();
  for (let i = 0; i < 31; i++) fast(ctx, t + 2 * i * H, t + 2 * i * H + H);
  assert.equal(ctx.history.length, 30);
  assert.equal(ctx.history[0].s, t + 60 * H);
});

test('week counts days, not fasts', () => {
  const { ctx, t } = fresh();
  fast(ctx, t - 20 * H, t - 1 * H);
  fast(ctx, t - 18 * H, t);
  fast(ctx, t - 8 * D - 20 * H, t - 8 * D);
  assert.equal(ctx.weekHits(t), 1);
  fast(ctx, t - 6 * D - 20 * H, t - 6 * D);
  assert.equal(ctx.weekHits(t), 2);
});

test('average covers the last 7 days', () => {
  const { ctx, t } = fresh();
  assert.equal(ctx.avgMs(t), 0);
  fast(ctx, t - 17 * H, t - 1 * H);
  fast(ctx, t - 20 * H, t - 2 * H);
  fast(ctx, t - 8 * D - 30 * H, t - 8 * D);
  assert.equal(ctx.avgMs(t), 17 * H);
});

test('a fast under 15 min is cancelled, not recorded', () => {
  const w = loadFace('fastzone.js'), ctx = w.ctx;
  ctx.streak = 2;
  w.tap('A');
  w.advance(5 * MIN);
  w.hold('A', 1100);
  w.tap('L');
  assert.equal(ctx.history.length, 0);
  assert.equal(ctx.streak, 2);
  assert.equal(ctx.longest, 0);
  assert.equal(ctx.lastEnd, 0);
  assert.equal(ctx.fastStart, 0);
});

test('a fast of exactly 15 min is recorded', () => {
  const w = loadFace('fastzone.js'), ctx = w.ctx;
  w.tap('A');
  w.advance(15 * MIN);
  ctx.endFast(ctx.now());
  assert.equal(ctx.history.length, 1);
  assert.equal(ctx.longest, 15 * MIN);
});
