const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { localize } = require('../build');
const { loadSource } = require('../tools/harness');

const mt = fs.readFileSync(path.join(__dirname, '..', 'multitimer.js'), 'utf8');
const SHIPPED_PRESETS = [60, 180, 300, 600, 900, 1500, 1800, 2700, 3600, 64800];

test('baked beepStyle out of range loads as stock', () => {
  assert.equal(loadSource(localize(mt, 'multitimer', { beepStyle: 7 })).ctx.beepStyle, 0);
});

test('default build keeps stock and the shipped presets', () => {
  const ctx = loadSource(mt).ctx;
  assert.equal(ctx.beepStyle, 0);
  assert.deepEqual([...ctx.presets], SHIPPED_PRESETS);
});

test('Bluetooth S2 still overrides a baked style', () => {
  const ctx = loadSource(localize(mt, 'multitimer', { beepStyle: 1 })).ctx;
  ctx.ble_rx('S2');
  assert.equal(ctx.beepStyle, 2);
});
