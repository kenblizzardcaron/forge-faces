const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadFace } = require('../tools/harness');

const H = 3600000, MIN = 60000;
const E_CLOCK_MINUTE = 1 << 8;
function fresh() {
  const w = loadFace('fastzone.js');
  return { w, ctx: w.ctx };
}
// A fast that crosses its 16 h goal 2 s from now, so the next tick rings it.
function nearGoal(ctx) { ctx.startFast(ctx.now() - 16 * H + 2000); }

test('goal rings once on screen', () => {
  const { w, ctx } = fresh();
  nearGoal(ctx);
  w.advance(3000);
  assert.ok(w.beeps.length > 0);
  w.advance(30000);
  assert.equal(w.beeps.length, 40);
  w.advance(H);
  assert.equal(w.beeps.length, 40);
});

test('beep off stays silent', () => {
  const { w, ctx } = fresh();
  ctx.settings.beep = 0;
  nearGoal(ctx);
  w.advance(3000);
  assert.equal(w.beeps.length, 0);
  assert.equal(ctx.rung, 1);
});

test('off-screen goal rings on the minute tick for 5 s', () => {
  const { w, ctx } = fresh();
  ctx.startFast(ctx.now() - 16 * H + MIN);
  ctx.updateSubscriptions();
  w.setActive(false);
  assert.equal(w.subscribed(E_CLOCK_MINUTE), true);
  w.advance(60000);
  w.minute();
  w.advance(6000);
  assert.equal(w.beeps.length, 10);
  assert.equal(w.subscribed(E_CLOCK_MINUTE), false);
  w.setActive(true);
  assert.equal(w.day(), ' 4');
});

test('silencing press is swallowed', () => {
  const { w, ctx } = fresh();
  nearGoal(ctx);
  w.advance(3000);
  const n = w.beeps.length;
  w.tap('A');
  assert.equal(ctx.ringTimer, -1);
  assert.equal(ctx.mode, ctx.TIMER);
  assert.notEqual(ctx.fastStart, 0);
  assert.equal(ctx.flashing(), false);
  w.advance(5000);
  assert.equal(w.beeps.length, n);
});

test('a hold that silences the ring opens no picker', () => {
  const { w, ctx } = fresh();
  nearGoal(ctx);
  w.advance(3000);
  w.hold('A', 1100);
  assert.equal(ctx.ringTimer, -1);
  assert.equal(ctx.mode, ctx.TIMER);
  assert.notEqual(ctx.fastStart, 0);
  assert.equal(ctx.hush, 0);
});

test('entering mid-fast subscribes to the minute tick', () => {
  const { w, ctx } = fresh();
  ctx.fastStart = ctx.now() - 15 * H;
  w.setActive(false);
  w.setActive(true);
  assert.equal(w.subscribed(E_CLOCK_MINUTE), true);
});
