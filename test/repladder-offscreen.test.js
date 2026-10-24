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
const MINUTE = 1 << 8; // E_CLOCK_MINUTE

test('subscription', () => {
  const w = fresh();
  assert.equal(w.subscribed(MINUTE), false);
  w.tap('A');
  assert.equal(w.subscribed(MINUTE), true);
  w.tap('A');
  assert.equal(w.subscribed(MINUTE), false);
  w.tap('A');
  assert.equal(w.subscribed(MINUTE), true);
  w.tap('A');
  w.tap('L');
  assert.equal(w.ctx.state, 0);
  assert.equal(w.subscribed(MINUTE), false);
});

test('one beep per minute tick', () => {
  const w = fresh();
  w.tap('A');
  w.at(10000);
  w.setActive(false);
  w.advance(120000);
  assert.equal(w.ctx.now() - w.ctx.startAt, 130000);
  const before = kinds(w, 'beep').length;
  w.minute();
  assert.equal(kinds(w, 'beep').length, before + 1);
});

test('missed boundaries beep once', () => {
  const w = fresh();
  w.tap('A');
  w.at(10000);
  w.setActive(false);
  w.advance(290000);
  const before = kinds(w, 'beep').length;
  w.minute();
  assert.equal(kinds(w, 'beep').length, before + 1);
});

test('return shows the right screen', () => {
  const w = fresh();
  w.tap('A');
  w.at(10000);
  w.setActive(false);
  w.advance(290000);
  w.minute();
  const before = kinds(w, 'beep').length;
  w.setActive(true);
  assert.equal(w.day(), 'S3');
  assert.equal(w.main(), ' 03908');
  assert.equal(kinds(w, 'beep').length, before);
});

test('finish off screen', () => {
  const w = fresh();
  w.tap('A');
  w.at(10000);
  w.setActive(false);
  w.advance(595000);
  const before = kinds(w, 'beep').length;
  w.minute();
  w.advance(5000);
  assert.equal(kinds(w, 'beep').slice(before).length, 15);
  assert.equal(w.ctx.state, 2);
  assert.equal(w.subscribed(MINUTE), false);
});

test('lead-in does not beep off screen', () => {
  const w = fresh();
  w.tap('A');
  w.advance(2000);
  w.setActive(false);
  w.advance(2000);
  const before = kinds(w, 'short').length + kinds(w, 'beep').length;
  w.minute();
  assert.equal(kinds(w, 'short').length + kinds(w, 'beep').length, before);
});

test('enter during due finish rings on-screen length', () => {
  const w = fresh();
  w.tap('A');
  w.at(10000);
  w.setActive(false);
  w.advance(605000);
  const before = kinds(w, 'beep').length;
  w.setActive(true);
  assert.equal(w.ctx.state, 2);
  w.advance(20000);
  assert.equal(kinds(w, 'beep').length - before, 30);
});
