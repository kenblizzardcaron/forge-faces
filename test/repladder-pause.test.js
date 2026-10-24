const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadFace } = require('../tools/harness');

// Fresh face; at(ms) advances the fake clock until elapsed() equals ms.
function fresh() {
  const w = loadFace('repladder.js');
  w.ctx.settings = { level: 0, goal: 50, total: 100, length: 600, sets: 5, pace: 3 };
  w.ctx.draw();
  w.at = (ms) => w.advance(w.ctx.startAt + ms - w.ctx.now());
  return w;
}
// Beeps of one kind.
function kinds(w, k) { return w.beeps.filter((b) => b.kind === k); }

test('pause in lead-in', () => {
  const w = fresh();
  w.tap('A');
  w.advance(2500);
  w.tap('A');
  assert.equal(w.main(), ' PAUSE');
  w.advance(1000);
  assert.equal(w.main(), '     3');
  assert.equal(w.day(), 'GO');
  w.advance(10000);
  assert.equal(kinds(w, 'short').length, 3);
  const resumeAt = w.ctx.now();
  w.tap('A');
  w.advance(2500);
  assert.equal(kinds(w, 'short').length, 5);
  assert.deepEqual(kinds(w, 'beep').map((b) => b.t - resumeAt), [2500]);
});

test('pause on a boundary', () => {
  const w = fresh();
  w.tap('A');
  w.at(66000);
  assert.equal(kinds(w, 'beep').length, 2);
  w.tap('A');
  w.advance(5000);
  w.tap('A');
  w.advance(100);
  assert.equal(kinds(w, 'beep').length, 2);
  assert.equal(w.main(), ' 11521');
});

test('no LAP while paused', () => {
  const w = fresh();
  w.tap('A');
  w.at(70000);
  w.tap('A');
  assert.equal(w.lap, false);
  w.advance(250);
  assert.equal(w.lap, false);
});

test('reset', () => {
  const w = fresh();
  w.tap('A');
  w.at(10000);
  w.tap('A');
  w.tap('L');
  assert.equal(w.main(), ' rESEt');
  w.advance(1000);
  assert.equal(w.main(), '100022');
  assert.equal(w.day(), 'S1');
  assert.equal(w.ctx.state, 0);
});

test('L ignored while running', () => {
  const w = fresh();
  w.tap('A');
  w.at(10000);
  w.tap('L');
  assert.equal(w.ctx.state, 1);
  assert.equal(w.day(), 'S1');
});

test('start after reset is not paused', () => {
  const w = fresh();
  w.tap('A');
  w.advance(2500);
  w.tap('A');
  w.tap('L');
  w.advance(1000);
  w.tap('A');
  w.advance(5000);
  assert.equal(w.ctx.paused, false);
  assert.equal(w.main(), ' 10601');
});
