const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadClassic } = require('./repladder-helpers');

// Fresh face past the intro (default level 19); at(ms) advances until elapsed() equals ms.
function fresh() {
  const w = loadClassic();
  w.advance(1000);
  w.at = (ms) => w.advance(w.ctx.startAt + ms - w.ctx.now());
  return w;
}

test('offer after finish', () => {
  const w = fresh();
  w.tap('A');
  w.at(600000);
  assert.equal(w.main(), ' donE ');
  w.advance(10000);
  assert.equal(w.ctx.state, 4);
  assert.equal(w.day(), '  ');
  assert.equal(w.main(), ' 20 UP');
  w.tap('A');
  assert.equal(w.ctx.state, 0);
  assert.equal(w.ctx.cur().level, 20);
  assert.equal(w.ctx.session.total, 53);
  assert.equal(w.day(), 'S1');
});

test('decline keeps the level', () => {
  const w = fresh();
  w.tap('A');
  w.at(610000);
  w.tap('L');
  assert.equal(w.ctx.state, 0);
  assert.equal(w.ctx.cur().level, 19);
});

test('hush', () => {
  const w = fresh();
  w.tap('A');
  w.at(601100);
  w.tap('A');
  assert.equal(w.ctx.cur().level, 19);
  assert.equal(w.main(), ' 20 UP');
  w.tap('A');
  assert.equal(w.ctx.cur().level, 20);
});

test('no offer after reset', () => {
  const w = fresh();
  w.tap('A');
  w.at(1000);
  w.tap('A');
  w.tap('L');
  w.advance(700000);
  assert.equal(w.ctx.state, 0);
  assert.equal(w.ctx.cur().level, 19);
});

test('no offer at max', () => {
  const w = fresh();
  w.ctx.setLevel(108);
  w.tap('A');
  w.at(310000);
  assert.equal(w.ctx.state, 2);
  w.tap('A');
  assert.equal(w.ctx.state, 0);
  assert.equal(w.ctx.cur().level, 108);
});

test('offer to max', () => {
  const w = fresh();
  // Level 107: 2 sets of 100 in 5:30 (the 30 s rest floor); the offer follows the finish ring.
  w.ctx.setLevel(107);
  w.tap('A');
  w.at(340000);
  assert.equal(w.main(), '108 UP');
  w.tap('A');
  assert.equal(w.main(), '  GOAL');
  w.advance(2999);
  assert.equal(w.main(), '  GOAL');
  w.advance(1);
  assert.equal(w.day(), 'S1');
  assert.equal(w.ctx.cur().level, 108);
});

test('offer off screen', () => {
  const w = fresh();
  w.tap('A');
  w.at(590000);
  w.setActive(false);
  w.at(660000);
  w.minute();
  w.advance(10000);
  w.setActive(true);
  assert.equal(w.main(), ' 20 UP');
  w.tap('A');
  assert.equal(w.ctx.cur().level, 20);
});

test('overlapping presses during the ring', () => {
  const w = fresh();
  w.tap('A');
  w.at(601100);
  w.ctx.button(0, 0);
  w.ctx.button(1, 0);
  w.ctx.button(0, 1);
  assert.equal(w.ctx.cur().level, 19);
  assert.equal(w.ctx.state, 4);
  w.ctx.button(1, 1);
  assert.equal(w.ctx.state, 0);
  assert.equal(w.ctx.cur().level, 19);
});

test('offer keeps base', () => {
  const w = fresh();
  w.ctx.cur().base = 720;
  w.ctx.setLevel(25);
  w.tap('A');
  w.at(730000);
  w.tap('A');
  assert.equal(w.ctx.cur().level, 26);
  assert.equal(w.ctx.session.length, 720);
});
