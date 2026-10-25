const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadFace } = require('../tools/harness');
const { manual } = require('./repladder-helpers');

// Fresh face on PUSH at level 0 (top 100, base 600, 5 sets, pace 3); at(ms) advances to elapsed ms.
function fresh() {
  const w = loadFace('repladder.js');
  manual(w, { top: 100, base: 600, sets: 5, pace: 3 });
  w.at = (ms) => w.advance(w.ctx.startAt + ms - w.ctx.now());
  return w;
}

// Fresh face on PUSH's default level 19, idle, past the intro.
function ladder() {
  const w = loadFace('repladder.js');
  w.advance(1000);
  w.at = (ms) => w.advance(w.ctx.startAt + ms - w.ctx.now());
  return w;
}

test('walk the fields on a level', () => {
  const w = ladder();
  w.tap('L');
  assert.equal(w.main(), '  PUSH');
  assert.equal(w.day(), ' 1');
  w.tap('L');
  assert.equal(w.main(), ' LEUEL');
  w.advance(1000);
  assert.equal(w.main(), ' 19 51');
  assert.equal(w.day(), ' 5');
  w.tap('L');
  assert.equal(w.main(), ' Count');
  w.tap('L');
  assert.equal(w.main(), '  SEtS');
  w.tap('L');
  assert.equal(w.main(), '  PACE');
  w.tap('L');
  assert.equal(w.main(), '   LEn');
  w.tap('L');
  assert.equal(w.ctx.state, 0);
});

test('walk the fields at level 0', () => {
  const w = fresh();
  w.tap('L');
  assert.equal(w.main(), '  PUSH');
  for (const word of [' LEUEL', ' Count', '  SEtS', '  PACE', '   LEn']) {
    w.tap('L');
    assert.equal(w.main(), word);
  }
  w.tap('L');
  assert.equal(w.ctx.state, 0);
  assert.equal(w.main(), '100022');
});

test('hold skips PACE', () => {
  const w = ladder();
  w.tap('L');
  w.tap('A');
  w.tap('A');
  assert.equal(w.main(), ' PLAnK');
  for (const word of [' LEUEL', ' Count', '  SEtS', '   LEn']) {
    w.tap('L');
    assert.equal(w.main(), word);
  }
});

test('switching keeps each level', () => {
  const w = ladder();
  w.tap('L');
  w.tap('A');
  assert.equal(w.ctx.cur().name, 'PULL');
  w.tap('L');
  w.tap('A');
  assert.equal(w.ctx.cur().level, 2);
  for (let i = 0; i < 5; i++) w.tap('L');
  assert.equal(w.ctx.state, 0);
  w.tap('L');
  w.tap('A');
  w.tap('A');
  assert.equal(w.ctx.cur().name, 'PUSH');
  assert.equal(w.ctx.cur().level, 19);
  assert.equal(w.ctx.session.total, 51);
  w.tap('A');
  assert.equal(w.ctx.cur().name, 'PULL');
  assert.equal(w.ctx.cur().level, 2);
});

test('top clamps to the ladder start', () => {
  const w = ladder();
  w.ctx.cur().top = 999;
  w.tap('L');
  w.tap('L');
  w.tap('L');
  w.tap('A');
  assert.equal(w.ctx.cur().top, 15);
  w.tap('L');
  w.tap('A');
  assert.equal(w.ctx.cur().sets, 6);
  assert.equal(w.ctx.cur().top, 21);
});

test('level from manual clamps top', () => {
  const w = fresh();
  manual(w, { top: 5, base: 600, sets: 5, pace: 3 });
  w.tap('L');
  w.tap('L');
  w.tap('A');
  assert.equal(w.ctx.cur().level, 1);
  assert.equal(w.ctx.cur().top, 15);
  const s = w.ctx.session;
  assert.notEqual(w.ctx.plan(s.total, s.length, s.sets, s.pace, s.hold), null);
});

test('manual ignores the level cap', () => {
  const w = ladder();
  w.tap('L');
  w.tap('A');
  w.tap('A');
  manual(w, { top: 1005, base: 1200, sets: 1, pace: 3, hold: 1 });
  w.tap('L');
  w.tap('L');
  w.tap('A');
  assert.equal(w.ctx.cur().top, 1010);
});

test('editing clamps the level', () => {
  const w = ladder();
  w.ctx.setLevel(118);
  w.ctx.cur().sets = 9;
  w.tap('L');
  w.tap('L');
  w.tap('L');
  w.tap('L');
  w.tap('A');
  assert.equal(w.ctx.cur().sets, 1);
  assert.equal(w.ctx.cur().level, w.ctx.maxLevel(w.ctx.cur()));
  const s = w.ctx.session;
  assert.notEqual(w.ctx.plan(s.total, s.length, s.sets, s.pace, s.hold), null);
});

test('level cap 999', () => {
  const w = ladder();
  w.tap('L');
  w.tap('A');
  w.tap('A');
  const p = w.ctx.cur();
  assert.equal(p.name, 'PLAnK');
  p.sets = 1;
  p.top = 995;
  w.tap('L');
  w.tap('L');
  w.tap('A');
  assert.equal(p.top, 1000);
  assert.equal(w.ctx.maxLevel(p), 992);
  w.tap('A');
  assert.equal(p.top, 1005);
  assert.equal(w.ctx.maxLevel(p), 997);
  w.tap('A');
  assert.equal(p.top, 10);
});

test('top fits 99:45', () => {
  const w = fresh();
  manual(w, { top: 299, base: 600, sets: 5, pace: 20 });
  w.tap('L');
  w.tap('L');
  w.tap('L');
  w.tap('A');
  assert.equal(w.ctx.cur().top, 1);
});

test('level wrap', () => {
  const w = ladder();
  w.ctx.setLevel(118);
  w.tap('L');
  w.tap('L');
  w.tap('A');
  assert.equal(w.main(), '   oFF');
  assert.equal(w.day(), '  ');
  assert.deepEqual([w.ctx.session.total, w.ctx.session.length, w.ctx.session.sets], [100, 600, 5]);
  w.tap('A');
  assert.equal(w.ctx.cur().level, 1);
  assert.equal(w.main(), '  1 15');
  assert.equal(w.day(), ' 5');
});

test('hold repeats', () => {
  const w = fresh();
  w.tap('L');
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
  w.tap('L');
  assert.equal(w.ctx.state, 0);
  assert.equal(w.main(), '100022');
  const before = JSON.stringify(w.ctx.cur());
  w.advance(1000);
  assert.equal(JSON.stringify(w.ctx.cur()), before);
  assert.equal(w.ctx.state, 0);
});

test('level field', () => {
  const w = ladder();
  w.tap('L');
  w.tap('L');
  assert.equal(w.main(), ' LEUEL');
  w.advance(1000);
  assert.equal(w.main(), ' 19 51');
  assert.equal(w.day(), ' 5');
  w.tap('A');
  assert.equal(w.main(), ' 20 53');
  assert.equal(w.ctx.session.total, 53);
  for (let i = 0; i < 5; i++) w.tap('L');
  assert.equal(w.ctx.state, 0);
  assert.equal(w.day(), 'S1');
});

test('level preview shows sets and total', () => {
  const w = ladder();
  w.ctx.setLevel(98);
  w.tap('L');
  w.tap('L');
  w.advance(1000);
  const r = w.ctx.rungAt(w.ctx.cur(), 98);
  assert.equal(w.main(), ' 98' + String(r.total).padStart(3));
  assert.equal(w.day(), ' ' + r.sets);
  assert.equal(w.colon, false);
});

test('session time on a level', () => {
  const w = ladder();
  for (let i = 0; i < 6; i++) w.tap('L');
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
