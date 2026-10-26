const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadFace } = require('../tools/harness');

test('minified build starts, fasts and rings', () => {
  const w = loadFace('fastzone.min.js');
  assert.equal(w.main(), ' rEAdY');
  w.tap('A');
  w.advance(16 * 3600000 + 2000);
  assert.ok(w.beeps.length >= 1);
  const size = fs.statSync(path.resolve(__dirname, '..', 'fastzone.min.js')).size;
  assert.ok(size <= 8158, `fastzone.min.js is ${size} bytes`);
});
