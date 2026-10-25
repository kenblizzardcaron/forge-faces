const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadFace } = require('../tools/harness');
const { manual } = require('./repladder-helpers');

// Fresh face; at(ms) advances the fake clock until elapsed() equals ms.
function fresh() {
  const w = loadFace('repladder.js');
  manual(w, { top: 100, base: 600, sets: 5, pace: 3 });
  w.at = (ms) => w.advance(w.ctx.startAt + ms - w.ctx.now());
  return w;
}

test('walk the fields', () => {
  const w = fresh();
  w.tap('L');
  assert.equal(w.main(), ' LEUEL');
  w.tap('L');
  assert.equal(w.main(), ' Count');
  assert.equal(w.day(), '22');
  w.advance(1000);
  assert.equal(w.main(), '   100');
  w.tap('A');
  assert.equal(w.main(), '   101');
  assert.equal(w.day(), '23');
  w.tap('L');
  assert.equal(w.main(), '   LEn');
  w.advance(1000);
  assert.equal(w.main(), '1000  ');
  assert.equal(w.colon, true);
  w.tap('A');
  assert.equal(w.main(), '1015  ');
  w.tap('L');
  assert.equal(w.main(), '  SEtS');
  w.advance(1000);
  assert.equal(w.main(), '     5');
  w.tap('L');
  assert.equal(w.main(), '  PACE');
  w.advance(1000);
  assert.equal(w.main(), '     3');
  w.tap('L');
  assert.equal(w.ctx.state, 0);
  assert.equal(w.main(), '101523');
});

test('wrap', () => {
  const w = fresh();
  w.tap('L');
  w.tap('L');
  w.advance(1000);
  w.ctx.cur().top = 999;
  w.tap('A');
  assert.equal(w.main(), '     1');

  const s = fresh();
  s.tap('L');
  s.tap('L');
  s.tap('L');
  s.tap('L');
  s.advance(1000);
  s.ctx.cur().sets = 9;
  s.tap('A');
  assert.equal(s.main(), '     1');

  const l = fresh();
  l.tap('L');
  l.tap('L');
  l.tap('L');
  l.advance(1000);
  l.ctx.cur().base = 5985;
  l.tap('A');
  assert.equal(l.main(), ' 015  ');
});

test('hold repeats', () => {
  const w = fresh();
  w.tap('L');
  w.tap('L');
  w.advance(1000);
  w.hold('A', 2000);
  const v = w.ctx.session.total;
  assert.ok(v >= 105 && v <= 125, `total was ${v}`);
  w.advance(1000);
  assert.equal(w.ctx.session.total, v);
});

test('Er while editing', () => {
  const w = fresh();
  w.tap('L');
  w.tap('L');
  w.advance(1000);
  manual(w, { top: 5, base: 600, sets: 9, pace: 3 });
  assert.equal(w.day(), 'Er');
});

test('no edit while running', () => {
  const w = fresh();
  w.tap('A');
  w.tap('L');
  assert.equal(w.ctx.state, 1);
});

test('leaving edit stops a held repeat', () => {
  const w = fresh();
  w.tap('L');
  w.tap('L');
  w.tap('L');
  w.tap('L');
  w.tap('L');
  assert.equal(w.main(), '  PACE');
  w.advance(1000);
  // Start a hold on A without releasing it, as a long press would.
  w.ctx.button(0, 0);
  w.ctx.a_long();
  w.advance(300);
  w.tap('L');
  assert.equal(w.ctx.state, 0);
  assert.equal(w.main(), '100022');
  const before = JSON.stringify(w.ctx.cur());
  w.advance(1000);
  assert.equal(JSON.stringify(w.ctx.cur()), before);
  assert.equal(w.ctx.state, 0);
});

// Ladder face at the default level 19, idle.
function ladder() {
  const w = loadFace('repladder.js');
  w.advance(1000);
  w.at = (ms) => w.advance(w.ctx.startAt + ms - w.ctx.now());
  return w;
}

test('level field', () => {
  const w = ladder();
  w.tap('L');
  assert.equal(w.main(), ' LEUEL');
  assert.equal(w.day(), '13');
  w.advance(1000);
  assert.equal(w.main(), '    19');
  assert.equal(w.day(), '13');
  w.tap('A');
  assert.equal(w.day(), '13');
  assert.equal(w.main(), '    20');
  assert.equal(w.ctx.session.total, 53);
  w.tap('L');
  assert.equal(w.main(), '   LEn');
  w.tap('L');
  assert.equal(w.ctx.state, 0);
  assert.equal(w.day(), 'S1');
});

test('two-set rung blanks day', () => {
  const w = ladder();
  w.ctx.setLevel(98);
  w.tap('L');
  w.advance(1000);
  assert.equal(w.main(), '    98');
  assert.equal(w.colon, false);
  assert.equal(w.day(), '  ');
});

test('level wrap', () => {
  const w = ladder();
  w.ctx.setLevel(118);
  w.tap('L');
  w.advance(1000);
  w.tap('A');
  assert.equal(w.ctx.cur().level, 0);
  assert.equal(w.main(), '   oFF');
  assert.equal(w.day(), '  ');
  assert.deepEqual([w.ctx.session.total, w.ctx.session.length, w.ctx.session.sets], [100, 600, 5]);
  w.tap('A');
  assert.equal(w.ctx.cur().level, 1);
  assert.equal(w.main(), '     1');
  assert.equal(w.day(), ' 5');
});

test('level 0 goes to the manual fields; a level skips them', () => {
  const w = ladder();
  w.tap('L');
  w.tap('L');
  assert.equal(w.main(), '   LEn');
  w.tap('L');
  assert.equal(w.ctx.state, 0);
  w.ctx.setLevel(0);
  w.tap('L');
  w.tap('L');
  assert.equal(w.main(), ' Count');
});

test('session time on a level', () => {
  const w = ladder();
  w.tap('L');
  w.tap('L');
  assert.equal(w.main(), '   LEn');
  w.advance(1000);
  assert.equal(w.main(), '1000  ');
  assert.equal(w.colon, true);
  w.tap('A');
  assert.equal(w.main(), '1015  ');
  assert.equal(w.ctx.cur().base, 615);
  assert.equal(w.ctx.session.length, 615);
  w.tap('L');
  assert.equal(w.ctx.state, 0);
  assert.equal(w.main(), '101513');
});

test('base carries through levels', () => {
  const w = ladder();
  w.ctx.cur().base = 720;
  w.ctx.setLevel(55);
  assert.equal(w.ctx.session.length, 555);
  w.ctx.setLevel(26);
  assert.equal(w.ctx.session.length, 720);
});
