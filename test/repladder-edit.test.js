const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadFace } = require('../tools/harness');

// Fresh face; at(ms) advances the fake clock until elapsed() equals ms.
function fresh() {
  const w = loadFace('repladder.js');
  w.ctx.settings = { level: 0, goal: 100, total: 100, length: 600, sets: 5, pace: 3 };
  w.ctx.draw();
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
  w.ctx.settings.total = 999;
  w.tap('A');
  assert.equal(w.main(), '     1');

  const s = fresh();
  s.tap('L');
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
  l.tap('L');
  l.advance(1000);
  l.ctx.settings.length = 5985;
  l.tap('A');
  assert.equal(l.main(), ' 015  ');
});

test('hold repeats', () => {
  const w = fresh();
  w.tap('L');
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

// Ladder face at the default level 25, idle.
function ladder() {
  const w = loadFace('repladder.js');
  w.advance(1000);
  w.at = (ms) => w.advance(w.ctx.startAt + ms - w.ctx.now());
  return w;
}

test('level and goal fields', () => {
  const w = ladder();
  w.tap('L');
  assert.equal(w.main(), ' LEUEL');
  assert.equal(w.day(), '12');
  w.advance(1000);
  assert.equal(w.main(), '    25');
  assert.equal(w.day(), '12');
  w.tap('A');
  assert.equal(w.day(), '13');
  assert.equal(w.main(), '    26');
  assert.equal(w.ctx.settings.total, 52);
  w.tap('L');
  assert.equal(w.main(), '  GOAL');
  w.advance(1000);
  assert.equal(w.main(), '   100');
  assert.equal(w.day(), '  ');
  w.tap('A');
  assert.equal(w.main(), '    10');
  assert.equal(w.day(), ' 6');
  assert.equal(w.ctx.settings.goal, 10);
  assert.equal(w.ctx.settings.total, 52);
  w.tap('L');
  assert.equal(w.main(), '   LEn');
  w.tap('L');
  assert.equal(w.ctx.state, 0);
  assert.equal(w.day(), 'S1');
});

test('two-set rung blanks day', () => {
  const w = ladder();
  w.ctx.setLevel(85);
  w.tap('L');
  w.advance(1000);
  assert.equal(w.main(), '    85');
  assert.equal(w.colon, false);
  assert.equal(w.day(), '  ');
});

test('level wrap', () => {
  const w = ladder();
  w.ctx.setLevel(100);
  w.tap('L');
  w.advance(1000);
  w.tap('A');
  assert.equal(w.ctx.settings.level, 0);
  assert.equal(w.main(), '   oFF');
  assert.equal(w.day(), '  ');
  assert.deepEqual([w.ctx.settings.total, w.ctx.settings.length, w.ctx.settings.sets], [100, 300, 1]);
  w.tap('A');
  assert.equal(w.ctx.settings.level, 10);
  assert.equal(w.main(), '    10');
  assert.equal(w.day(), ' 6');
});

test('goal wrap', () => {
  const w = ladder();
  w.ctx.settings.goal = 100;
  w.tap('L');
  w.tap('L');
  w.advance(1000);
  w.tap('A');
  assert.equal(w.ctx.settings.goal, 10);
});

test('level 0 goes to the manual fields; a level skips them', () => {
  const w = ladder();
  w.tap('L');
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
  w.tap('L');
  assert.equal(w.main(), '   LEn');
  w.advance(1000);
  assert.equal(w.main(), '1000  ');
  assert.equal(w.colon, true);
  w.tap('A');
  assert.equal(w.main(), '1015  ');
  assert.equal(w.ctx.settings.base, 615);
  assert.equal(w.ctx.settings.length, 615);
  w.tap('L');
  assert.equal(w.ctx.state, 0);
  assert.equal(w.main(), '101512');
});

test('base carries through levels', () => {
  const w = ladder();
  w.ctx.settings.base = 720;
  w.ctx.setLevel(55);
  assert.equal(w.ctx.settings.length, 645);
  w.ctx.setLevel(26);
  assert.equal(w.ctx.settings.length, 720);
});
