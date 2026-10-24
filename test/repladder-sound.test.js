const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadFace } = require('../tools/harness');

// Fresh face; at(ms) advances the fake clock until elapsed() equals ms.
function fresh() {
  const w = loadFace('repladder.js');
  w.at = (ms) => w.advance(w.ctx.startAt + ms - w.ctx.now());
  return w;
}
// Beeps of one kind.
function kinds(w, k) { return w.beeps.filter((b) => b.kind === k); }

test('lead-in shorts', () => {
  const w = fresh();
  const t0 = w.ctx.now();
  w.tap('A');
  w.advance(4000);
  const shorts = kinds(w, 'short').map((b) => b.t - t0);
  assert.deepEqual(shorts, [0, 1000, 2000, 3000, 4000]);
  assert.equal(kinds(w, 'beep').length, 0);
});

test('set 1 start beep', () => {
  const w = fresh();
  const t0 = w.ctx.now();
  w.tap('A');
  w.advance(5000);
  const beeps = kinds(w, 'beep');
  assert.equal(beeps.length, 1);
  assert.equal(beeps[0].t - t0, 5000);
});

test('nine change beeps', () => {
  const w = fresh();
  w.tap('A');
  w.at(599999);
  const beeps = kinds(w, 'beep');
  assert.equal(beeps.length, 9);
  assert.equal(beeps[1].t - w.ctx.startAt, 66000);
});

test('finish ring', () => {
  const w = fresh();
  w.tap('A');
  w.at(599999);
  const before = kinds(w, 'beep').length;
  const end = w.ctx.startAt + 600000;
  w.at(600000);
  w.advance(15000);
  const ring = kinds(w, 'beep').slice(before);
  assert.equal(ring.length, 30);
  assert.deepEqual(ring.slice(0, 6).map((b) => b.t - end), [0, 125, 250, 1000, 1125, 1250]);
});

test('button stops ring', () => {
  const w = fresh();
  w.tap('A');
  w.at(599999);
  const before = kinds(w, 'beep').length;
  w.at(601100);
  w.tap('A');
  assert.equal(kinds(w, 'beep').slice(before).length, 4);
  w.advance(5000);
  assert.equal(kinds(w, 'beep').slice(before).length, 4);
  assert.equal(w.main(), '100022');
});

test('zero rest beeps once', () => {
  const w = fresh();
  w.ctx.settings = { total: 100, length: 300, sets: 5, pace: 3 };
  w.ctx.draw();
  w.tap('A');
  w.at(66000);
  assert.equal(kinds(w, 'beep').length, 2);
});
