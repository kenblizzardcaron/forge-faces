const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadClassic } = require('./repladder-helpers');

const w = loadClassic();
// vm objects have another realm's prototypes; deepStrictEqual needs plain copies
const plain = (x) => JSON.parse(JSON.stringify(x));
const plan = (...a) => plain(w.ctx.plan(...a));
const phaseAt = w.ctx.phaseAt;

test('default ladder', () => {
  assert.deepEqual(plan(100, 600, 5, 3), { reps: [22, 21, 20, 19, 18],
    ends: [66000, 141000, 204000, 279000, 339000, 414000, 471000, 546000, 600000] });
});

test('uneven split', () => {
  // extras go to the first sets
  assert.deepEqual(plan(100, 600, 4, 3).reps, [27, 26, 24, 23]);
  assert.deepEqual(plan(100, 600, 4, 3).ends, [81000, 181000, 259000, 359000, 431000, 531000, 600000]);
});

test('fractional rest', () => {
  // fractional rest still ends exactly at length
  assert.deepEqual(plan(100, 601, 4, 3).ends, [81000, 181333, 259333, 359667, 431667, 532000, 601000]);
});

test('one set', () => {
  // no rest, no NaN
  assert.deepEqual(plan(100, 600, 1, 3), { reps: [100], ends: [300000] });
});

test('invalid', () => {
  // last set < 1, and work longer than length
  assert.equal(plan(5, 600, 9, 3), null);
  assert.equal(plan(100, 299, 5, 3), null);
});

test('zero rest', () => {
  // zero rest is valid
  assert.deepEqual(plan(100, 300, 5, 3).ends.slice(0, 3), [66000, 66000, 129000]);
});

test('phaseAt', () => {
  const p = w.ctx.plan(100, 600, 5, 3);
  assert.equal(phaseAt(p, 0), 0);
  assert.equal(phaseAt(p, 65999), 0);
  assert.equal(phaseAt(p, 66000), 1);
  assert.equal(phaseAt(p, 599999), 8);
  assert.equal(phaseAt(p, 600000), 9);
  assert.equal(phaseAt(w.ctx.plan(100, 300, 5, 3), 66000), 2); // skips the zero rest
});
