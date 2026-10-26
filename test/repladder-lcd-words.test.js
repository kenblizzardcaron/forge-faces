const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadFace } = require('../tools/harness');
const { damage } = require('./lcd-helpers');

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
