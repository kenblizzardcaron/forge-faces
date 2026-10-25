const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { localize } = require('../build');
const { loadSource } = require('../tools/harness');

const src = fs.readFileSync(path.join(__dirname, '..', 'repladder.js'), 'utf8');

test('profiles replace the list', () => {
  const out = localize(src, 'repladder', { profiles: [{ name: 'PULL', top: 40 }] });
  const ctx = loadSource(out).ctx;
  assert.equal(ctx.profiles.length, 1);
  assert.deepEqual({ ...ctx.profiles[0] }, { name: 'PULL', hold: 0, sets: 5, top: 40, pace: 3, base: 600, level: 1 });
});

test('profile picks the boot slot', () => {
  const out = localize(src, 'repladder', { profiles: [{ name: 'PUSH' }, { name: 'PULL' }], profile: 1 });
  assert.equal(loadSource(out).ctx.cur().name, 'PULL');
});

test('misspelled profile key fails', () => {
  assert.throws(() => localize(src, 'repladder', { profiles: [{ name: 'X', toop: 5 }] }),
    /profiles\[0\] has no setting "toop"/);
});

test('nameless profile fails', () => {
  assert.throws(() => localize(src, 'repladder', { profiles: [{ top: 5 }] }), /profiles\[0\] needs a name/);
});

test('profile out of range fails', () => {
  assert.throws(() => localize(src, 'repladder', { profile: 5 }), /repladder profile 5 is out of range \(0\.\.4\)/);
  assert.throws(() => localize(src, 'repladder', { profile: 2, profiles: [{ name: 'A' }] }),
    /repladder profile 2 is out of range \(0\.\.0\)/);
});

test('profiles must be a list', () => {
  assert.throws(() => localize(src, 'repladder', { profiles: {} }), /repladder profiles must be a non-empty list/);
  assert.throws(() => localize(src, 'repladder', { profiles: [] }), /repladder profiles must be a non-empty list/);
});

test('faces without profiles skip the check', () => {
  const multitimer = fs.readFileSync(path.join(__dirname, '..', 'multitimer.js'), 'utf8');
  assert.doesNotThrow(() => localize(multitimer, 'multitimer', {}));
});

test('old level key fails', () => {
  assert.throws(() => localize(src, 'repladder', { level: 45 }), /has no setting "level"/);
});

const mt = fs.readFileSync(path.join(__dirname, '..', 'multitimer.js'), 'utf8');

test('presets replace the list', () => {
  const out = localize(mt, 'multitimer', { presets: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] });
  assert.deepEqual([...loadSource(out).ctx.presets], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('bad presets fail', () => {
  for (const p of [[1, 2, 3, 4, 5, 6, 7, 8, 9], Array(10).fill(86400), Array(10).fill(1.5), Array(10).fill(-1), 'x']) {
    assert.throws(() => localize(mt, 'multitimer', { presets: p }), /multitimer presets must be 10 whole seconds from 0 to 86399/);
  }
});

test('faces without presets reject them', () => {
  assert.throws(() => localize(src, 'repladder', { presets: Array(10).fill(60) }), /repladder has no presets list/);
});

test('beepStyle bakes in', () => {
  assert.equal(loadSource(localize(mt, 'multitimer', { beepStyle: 2 })).ctx.beepStyle, 2);
});
