const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadFace } = require('../tools/harness');

test('minified build starts and beeps', () => {
  const w = loadFace('repladder.min.js');
  assert.equal(w.main(), 'SLOt 1');
  w.advance(1000);
  assert.equal(w.main(), '100005');
  w.tap('A');
  w.advance(5000);
  assert.equal(w.main(), ' 23405');
  assert.equal(w.beeps.filter((b) => b.kind === 'beep').length, 1);
});
