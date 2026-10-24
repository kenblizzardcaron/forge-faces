const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadFace } = require('../tools/harness');

// Fresh face; at(ms) advances the fake clock until elapsed() equals ms.
function fresh() {
  const w = loadFace('repladder.js');
  w.at = (ms) => w.advance(w.ctx.startAt + ms - w.ctx.now());
  return w;
}

test('walk the fields', () => {
  const w = fresh();
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
  w.advance(1000);
  w.ctx.settings.total = 999;
  w.tap('A');
  assert.equal(w.main(), '     1');

  const s = fresh();
  s.tap('L');
  s.tap('L');
  s.tap('L');
  s.advance(1000);
  s.ctx.settings.sets = 9;
  s.tap('A');
  assert.equal(s.main(), '     1');

  const l = fresh();
  l.tap('L');
  l.tap('L');
  l.advance(1000);
  l.ctx.settings.length = 5985;
  l.tap('A');
  assert.equal(l.main(), ' 015  ');
});

test('hold repeats', () => {
  const w = fresh();
  w.tap('L');
  w.advance(1000);
  w.hold('A', 2000);
  const v = w.ctx.settings.total;
  assert.ok(v >= 105 && v <= 125, `total was ${v}`);
  w.advance(1000);
  assert.equal(w.ctx.settings.total, v);
});

test('Er while editing', () => {
  const w = fresh();
  w.tap('L');
  w.advance(1000);
  w.ctx.settings.total = 5;
  w.ctx.settings.sets = 9;
  w.ctx.draw();
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
  assert.equal(w.main(), '  PACE');
  w.advance(1000);
  // Start a hold on A without releasing it, as a long press would.
  w.ctx.button(0, 0);
  w.ctx.a_long();
  w.advance(300);
  w.tap('L');
  assert.equal(w.ctx.state, 0);
  assert.equal(w.main(), '100022');
  const before = JSON.stringify(w.ctx.settings);
  w.advance(1000);
  assert.equal(JSON.stringify(w.ctx.settings), before);
  assert.equal(w.ctx.state, 0);
});
