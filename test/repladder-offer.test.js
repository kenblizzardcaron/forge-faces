const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadFace } = require('../tools/harness');

// Fresh face past the intro (default level 45, goal 100); at(ms) advances until elapsed() equals ms.
function fresh() {
  const w = loadFace('repladder.js');
  w.advance(1000);
  w.at = (ms) => w.advance(w.ctx.startAt + ms - w.ctx.now());
  return w;
}

test('offer after finish', () => {
  const w = fresh();
  w.tap('A');
  w.at(600000);
  assert.equal(w.main(), '  donE');
  w.advance(10000);
  assert.equal(w.ctx.state, 4);
  assert.equal(w.day(), '  ');
  assert.equal(w.main(), 'UP  46');
  w.tap('A');
  assert.equal(w.ctx.state, 0);
  assert.equal(w.ctx.settings.level, 46);
  assert.equal(w.ctx.settings.total, 92);
  assert.equal(w.day(), 'S1');
});

test('decline keeps the level', () => {
  const w = fresh();
  w.tap('A');
  w.at(610000);
  w.tap('L');
  assert.equal(w.ctx.state, 0);
  assert.equal(w.ctx.settings.level, 45);
});

test('hush', () => {
  const w = fresh();
  w.tap('A');
  w.at(601100);
  w.tap('A');
  assert.equal(w.ctx.settings.level, 45);
  assert.equal(w.main(), 'UP  46');
  w.tap('A');
  assert.equal(w.ctx.settings.level, 46);
});

test('no offer after reset', () => {
  const w = fresh();
  w.tap('A');
  w.at(1000);
  w.tap('A');
  w.tap('L');
  w.advance(700000);
  assert.equal(w.ctx.state, 0);
  assert.equal(w.ctx.settings.level, 45);
});

test('at goal', () => {
  const w = fresh();
  w.ctx.settings.goal = 50;
  w.ctx.setLevel(50);
  w.tap('A');
  w.at(610000);
  assert.equal(w.ctx.state, 2);
  w.tap('A');
  assert.equal(w.ctx.state, 0);
  assert.equal(w.ctx.settings.level, 50);
});

test('goal reached', () => {
  const w = fresh();
  w.ctx.settings.goal = 50;
  w.ctx.setLevel(49);
  w.tap('A');
  w.at(610000);
  assert.equal(w.main(), 'UP  50');
  w.tap('A');
  assert.equal(w.main(), '  GOAL');
  w.advance(2999);
  assert.equal(w.main(), '  GOAL');
  w.advance(1);
  assert.equal(w.day(), 'S1');
  assert.equal(w.main(), '100022');
});

test('offer to 100', () => {
  const w = fresh();
  w.ctx.setLevel(99);
  w.tap('A');
  w.at(325000);
  assert.equal(w.main(), 'UP 100');
  w.tap('A');
  assert.equal(w.main(), '  GOAL');
  assert.equal(w.ctx.settings.level, 100);
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
  assert.equal(w.main(), 'UP  46');
  w.tap('A');
  assert.equal(w.ctx.settings.level, 46);
});

test('overlapping presses during the ring', () => {
  const w = fresh();
  w.tap('A');
  w.at(601100);
  w.ctx.button(0, 0);
  w.ctx.button(1, 0);
  w.ctx.button(0, 1);
  assert.equal(w.ctx.settings.level, 45);
  assert.equal(w.ctx.state, 4);
  w.ctx.button(1, 1);
  assert.equal(w.ctx.state, 0);
  assert.equal(w.ctx.settings.level, 45);
});

test('offer keeps base', () => {
  const w = fresh();
  w.ctx.settings.base = 720;
  w.ctx.setLevel(45);
  w.tap('A');
  w.at(730000);
  w.tap('A');
  assert.equal(w.ctx.settings.level, 46);
  assert.equal(w.ctx.settings.length, 720);
});
