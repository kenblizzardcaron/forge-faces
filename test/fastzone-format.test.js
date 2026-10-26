const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { localize } = require('../build');
const { loadFace, loadSource } = require('../tools/harness');
const { damage } = require('./lcd-helpers');

const src = fs.readFileSync(path.join(__dirname, '..', 'fastzone.js'), 'utf8');
const ctx = loadFace('fastzone.js').ctx;

test('zones change at 4, 12, 16 and 24 h', () => {
  const H = 3600000;
  assert.deepEqual([0, 4 * H - 1, 4 * H, 12 * H, 16 * H, 24 * H, 60 * H].map(ctx.zoneOf), [1, 1, 2, 3, 4, 5, 5]);
});
test('hms and hm', () => {
  assert.equal(ctx.hms(5 * 3600000 + 42 * 60000 + 18500), '054218');
  assert.equal(ctx.hms(150 * 3600000), '995959');
  assert.equal(ctx.hm(17 * 3600000 + 42 * 60000), '1742  ');
});
test('goal labels', () => {
  assert.deepEqual([16, 17, 18, 23, 12, 36].map(ctx.goalMain), ['168   ', '177   ', '186   ', '231   ', '1212  ', '36    ']);
});
test('baked goal and beep clamp', () => {
  assert.equal(loadSource(localize(src, 'fastzone', { goal: 99, beep: 5 })).ctx.settings.goal, 16);
  assert.equal(loadSource(localize(src, 'fastzone', { goal: 99, beep: 5 })).ctx.settings.beep, 1);
  assert.equal(loadSource(localize(src, 'fastzone', { goal: 18 })).ctx.settings.goal, 18);
});
test('zone words keep their letters whole', () => {
  for (const w of ctx.ZONE_WORDS) assert.deepEqual(damage(w), [], w);
});
