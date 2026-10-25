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

test('old level key fails', () => {
  assert.throws(() => localize(src, 'repladder', { level: 45 }), /has no setting "level"/);
});
