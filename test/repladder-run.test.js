const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadFace } = require('../tools/harness');

// Fresh face past its 1 s intro; at(ms) advances the fake clock until elapsed() equals ms.
function fresh() {
  const w = loadFace('repladder.js');
  w.advance(1000);
  w.ctx.settings = { level: 0, goal: 50, total: 100, length: 600, sets: 5, pace: 3 };
  w.ctx.draw();
  w.at = (ms) => w.advance(w.ctx.startAt + ms - w.ctx.now());
  return w;
}

test('intro', () => {
  const w = loadFace('repladder.js');
  assert.equal(w.main(), 'LAddEr');
  assert.equal(w.colon, false);
  w.advance(1000);
  assert.equal(w.main(), '100012');
  const p = loadFace('repladder.js');
  p.tap('A');
  assert.equal(p.main(), ' rEAdy');
});

test('no intro while running', () => {
  const w = fresh();
  w.tap('A');
  w.at(2000);
  w.setActive(false);
  w.setActive(true);
  assert.equal(w.main(), ' 10401');
});

test('idle screen', () => {
  const w = fresh();
  assert.equal(w.day(), 'S1');
  assert.equal(w.main(), '100022');
  assert.equal(w.colon, true);
  assert.equal(w.lap, false);
});

test('idle on the ladder', () => {
  const w = loadFace('repladder.js');
  w.advance(1000);
  assert.equal(w.day(), '25');
  assert.equal(w.main(), '100012');
  assert.equal(w.colon, true);
});

test('invalid idle and start', () => {
  const w = fresh();
  w.ctx.settings.total = 5;
  w.ctx.settings.sets = 9;
  w.ctx.draw();
  assert.equal(w.day(), 'Er');
  assert.equal(w.main(), '1000  ');
  w.tap('A');
  assert.equal(w.main(), ' Error');
  assert.equal(w.ctx.state, 0);
  w.advance(1000);
  assert.equal(w.main(), '1000  ');
});

test('lead-in', () => {
  const w = fresh();
  w.tap('A');
  assert.equal(w.main(), ' rEAdy');
  assert.equal(w.day(), 'GO');
  assert.equal(w.colon, false);
  w.advance(1000);
  assert.equal(w.main(), '     4');
  w.advance(3000);
  assert.equal(w.main(), '     1');
});

test('work countdown', () => {
  const w = fresh();
  w.tap('A');
  w.at(0);
  assert.equal(w.day(), 'S1');
  assert.equal(w.main(), ' 10601');
  assert.equal(w.colon, true);
  w.at(2999);
  assert.equal(w.main(), ' 10401');
  w.at(3000);
  assert.equal(w.main(), ' 10302');
  w.at(9000);
  assert.equal(w.main(), ' 05704');
  w.at(9500);
  assert.equal(w.main(), ' 05704');
  w.at(63000);
  assert.equal(w.main(), ' 00322');
});

test('rest and LAP', () => {
  const w = fresh();
  w.tap('A');
  w.at(65999);
  assert.equal(w.main(), ' 00122');
  w.at(66000);
  assert.equal(w.day(), 'r1');
  assert.equal(w.main(), ' 11521');
  assert.equal(w.lap, true);
  w.at(66500);
  assert.equal(w.lap, false);
  w.at(546000);
  assert.equal(w.day(), 'S5');
  assert.equal(w.main(), ' 05401');
  assert.equal(w.lap, false);
});

test('done', () => {
  const w = fresh();
  w.tap('A');
  w.at(600000);
  assert.equal(w.main(), '  donE');
  assert.equal(w.day(), '  ');
  assert.equal(w.colon, false);
  w.tap('A');
  assert.equal(w.main(), '100022');
});

test('one set of 100', () => {
  const w = fresh();
  w.ctx.settings = { level: 0, goal: 50, total: 100, length: 600, sets: 1, pace: 3 };
  w.ctx.draw();
  assert.equal(w.main(), '1000  ');
  w.tap('A');
  w.at(0);
  assert.equal(w.main(), ' 50001');
  w.at(297000);
  assert.equal(w.main(), ' 003  ');
  assert.equal(w.day(), 'S1');
  w.at(300000);
  assert.equal(w.main(), '  donE');
});

test('fractional rest', () => {
  const w = fresh();
  w.ctx.settings = { level: 0, goal: 50, total: 100, length: 601, sets: 4, pace: 3 };
  w.ctx.draw();
  w.tap('A');
  w.at(181332);
  assert.equal(w.day(), 'r1');
  assert.equal(w.main(), ' 00126');
  w.at(181333);
  assert.equal(w.day(), 'S2');
  assert.equal(w.main(), ' 11801');
  for (let ms = 0; ms <= 601000; ms += 250) {
    w.at(ms);
    if (w.main() === '  donE') {
      assert.equal(ms, 601000);
      break;
    }
    assert.match(w.main(), /^[ \d]{6}$/);
  }
  assert.equal(w.main(), '  donE');
});
