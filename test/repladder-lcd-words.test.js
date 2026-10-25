const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadFace } = require('../tools/harness');

// The firmware's character table and per-position substitutions, from the emulator.
const lcd = {};
vm.createContext(lcd);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../upstream/js/lcdChars.js'), 'utf8') + ';this.seg=lcdSegmentsForPosition;', lcd);

// Main cells 0 and 2 (watch positions 4 and 6) drive their top and bottom bars together: a character whose
// a and d differ there gains or loses a bar, and an L becomes a top-half L.
function damage(main) {
  const text = ('      ' + main).slice(-6), bad = [];
  for (const i of [0, 2]) {
    const ch = text[i], s = lcd.seg(4 + i, ch);
    if (s.a !== s.d || ch === 'L') bad.push(`${ch} in cell ${i}`);
  }
  return bad;
}

test('every word the face draws keeps its letters whole on the tied cells', () => {
  const ctx = loadFace('repladder.js').ctx;
  const words = [
    ...['level', 'sets', 'pace', 'base'].map((k) => ctx.wordFor(k)), ctx.wordFor('top'),
    ' donE ', '  rEPS', '  HOLd', '   oFF', 'PAUSE', 'rESEt', 'Error', 'GOAL',
    ...[1, 9, 15, 91, 100, 999].map((n) => ctx.tag(n, 'rEP')),
    ...[1, 5, 9].map((n) => ctx.tag(n, 'SEtS')),
    ...[1, 39, 118, 999].map((n) => ctx.tag(n, 'LEU')),
    ...[1, 3, 20].map((n) => ctx.tag(n, 'SEC')),
    ...[2, 40, 118].map((n) => ctx.tag(n, 'UP')),
    ...ctx.profiles.map((p) => p.name),
  ];
  for (const w of words) assert.deepEqual(damage(w), [], JSON.stringify(w));
});
