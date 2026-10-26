const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadFace } = require('../tools/harness');

const H = 3600000;

test('fresh face reads rEAdY', () => {
  const w = loadFace('fastzone.js');
  assert.equal(w.main(), ' rEAdY');
  assert.equal(w.lap, false);
  assert.equal(w.colon, false);
});

test('fasting counts down with the zone', () => {
  const w = loadFace('fastzone.js');
  const { ctx } = w;
  ctx.startFast(ctx.now() - 13 * H);
  w.advance(1000);
  assert.equal(w.main(), '025959');
  assert.equal(w.day(), ' 3');
  assert.equal(w.lap, true);
  assert.equal(w.colon, true);
});

test('past the goal counts up and blinks LAP', () => {
  const w = loadFace('fastzone.js');
  const { ctx } = w;
  ctx.startFast(ctx.now() - (16 * H + 90000));
  ctx.draw();
  assert.equal(w.main(), '000130');
  const a = w.lap;
  w.advance(1000);
  assert.notEqual(w.lap, a);
});

test('eating counts down the window', () => {
  const w = loadFace('fastzone.js');
  const { ctx } = w;
  ctx.settings.goal = 18;
  const t = ctx.now();
  ctx.startFast(t - 18 * H);
  ctx.endFast(t - H);
  ctx.draw();
  assert.equal(w.main(), '050000');
  assert.equal(w.day(), '  ');
  assert.equal(w.lap, false);
});

test('window over reads rEAdY', () => {
  const w = loadFace('fastzone.js');
  const { ctx } = w;
  ctx.settings.goal = 18;
  const t = ctx.now();
  ctx.startFast(t - 20 * H);
  ctx.endFast(t - 7 * H);
  ctx.draw();
  assert.equal(w.main(), ' rEAdY');
  assert.equal(w.colon, false);
});

test('goal 36 counts up since the fast ended', () => {
  const w = loadFace('fastzone.js');
  const { ctx } = w;
  ctx.settings.goal = 36;
  const t = ctx.now();
  ctx.startFast(t - 40 * H);
  ctx.endFast(t - 2 * H - 5000);
  ctx.draw();
  assert.equal(w.main(), '020005');
  assert.equal(w.colon, true);
});

test('entering mid-fast flashes the zone word', () => {
  const w = loadFace('fastzone.js');
  const { ctx } = w;
  ctx.startFast(ctx.now() - 17 * H);
  w.setActive(false);
  w.setActive(true);
  assert.equal(w.main(), '  HEtO');
  w.advance(2000);
  assert.notEqual(w.main(), '  HEtO');
  assert.match(w.main(), /^\d{6}$/);
});
