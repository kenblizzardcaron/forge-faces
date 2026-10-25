const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadClassic, manual } = require('./repladder-helpers');

// PLAnK level 1 past its intro: 5 holds of 10 s in 10:00; at(ms) advances to elapsed() == ms.
function hold() {
  const w = loadClassic();
  w.advance(1000);
  w.ctx.settings.profile = 2;
  w.ctx.load();
  w.ctx.draw();
  w.at = (ms) => w.advance(w.ctx.startAt + ms - w.ctx.now());
  return w;
}

test('hold idle', () => {
  const w = hold();
  assert.equal(w.day(), 'S1');
  assert.equal(w.main(), '100010');
});

test('hold lead-in', () => {
  const w = hold();
  w.tap('A');
  assert.equal(w.main(), '  HOLd');
  assert.equal(w.day(), ' 5');
  assert.equal(w.colon, false);
  w.advance(1000);
  assert.equal(w.main(), '1000  ');
  assert.equal(w.day(), ' 4');
  assert.equal(w.colon, true);
  w.advance(1000);
  assert.equal(w.main(), 'SEtS 5');
  w.advance(1000);
  assert.equal(w.main(), 'LEU  1');
  w.advance(1000);
  assert.equal(w.main(), 'GO  10');
  assert.equal(w.day(), ' 1');
  assert.equal(w.colon, false);
});

test('hold work counts down', () => {
  const w = hold();
  w.tap('A');
  w.at(0);
  assert.equal(w.day(), 'S1');
  assert.equal(w.main(), ' 010  ');
  w.at(5000);
  assert.equal(w.main(), ' 005  ');
});

test('hold rest', () => {
  const w = hold();
  w.tap('A');
  w.at(10000);
  assert.equal(w.day(), 'r1');
  assert.equal(w.main(), ' 21810');
});

test('manual hold', () => {
  const w = hold();
  manual(w, { top: 120, base: 300, sets: 3, pace: 3, hold: 1 });
  assert.equal(w.ctx.session.total, 120);
  w.tap('A');
  assert.deepEqual([...w.ctx.current.reps], [40, 40, 40]);
  w.advance(3000);
  assert.equal(w.main(), '   oFF');
  w.at(0);
  assert.equal(w.main(), ' 040  ');
});

test('intro shows the profile name', () => {
  const w = loadClassic();
  assert.equal(w.main(), '  PUSH');
  w.advance(1000);
  w.setActive(false);
  w.ctx.settings.profile = 1;
  w.setActive(true);
  assert.equal(w.main(), '  PULL');
});
