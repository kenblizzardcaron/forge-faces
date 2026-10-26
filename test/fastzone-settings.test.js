const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadFace } = require('../tools/harness');
const { damage } = require('./lcd-helpers');

const H = 3600000;
function fresh() {
  const w = loadFace('fastzone.js');
  return { w, ctx: w.ctx };
}

test('hold L edits the goal', () => {
  const { w, ctx } = fresh();
  w.hold('L', 1600);
  assert.equal(ctx.mode, ctx.SET);
  assert.equal(w.main(), '168   ');
  assert.equal(w.day(), ' G');
  w.tap('A');
  assert.equal(w.main(), '177   ');
  assert.equal(ctx.fastStart, 0);
  for (let i = 0; i < 32; i++) w.tap('A');
  assert.equal(ctx.settings.goal, 12);
  assert.equal(w.main(), '1212  ');
  assert.equal(ctx.fastStart, 0);
});

test('beep toggles and L returns', () => {
  const { w, ctx } = fresh();
  w.hold('L', 1600);
  w.tap('L');
  assert.equal(w.main(), ' bEEP ');
  assert.equal(w.day(), ' 1');
  w.tap('A');
  assert.equal(w.day(), ' 0');
  assert.equal(ctx.settings.beep, 0);
  w.tap('L');
  assert.equal(ctx.mode, ctx.TIMER);
  assert.equal(ctx.settings.beep, 0);
});

test('hold L does not enter SET from PICK', () => {
  const { w, ctx } = fresh();
  w.hold('A', 1000);
  assert.equal(ctx.mode, ctx.PICK);
  w.hold('L', 1600);
  assert.equal(ctx.mode, ctx.PICK);
  assert.equal(ctx.longFired, 0);
});

test('goal change re-arms or quiets the beep', () => {
  const { w, ctx } = fresh();
  const t = ctx.now();
  ctx.startFast(t - 17 * H);
  w.advance(25000);
  assert.equal(ctx.rung, 1);
  ctx.setGoal(18);
  assert.equal(ctx.rung, 0);
  const before = w.beeps.length;
  w.advance(H + 60000);
  assert.ok(w.beeps.length > before);

  const f = fresh();
  f.ctx.startFast(f.ctx.now() - 17 * H);
  f.ctx.setGoal(18);
  f.ctx.setGoal(16);
  assert.equal(f.ctx.rung, 1);
  f.w.advance(2000);
  assert.equal(f.w.beeps.length, 0);
});

test('settings words keep their letters whole', () => {
  assert.deepEqual(damage(' bEEP '), []);
  const { w } = fresh();
  w.hold('L', 1600);
  for (let i = 0; i < 37; i++) {
    assert.deepEqual(damage(w.main()), [], w.main());
    w.tap('A');
  }
});
