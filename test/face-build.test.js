const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'face-build.js'), 'utf8');

test('loads as a browser script', () => {
  const ctx = {};
  vm.runInNewContext(source, ctx);
  assert.equal(ctx.FaceBuild.MAX_BYTES, 8158);
  assert.equal(typeof ctx.FaceBuild.localize, 'function');
});

test('no Node built-ins', () => {
  assert.equal(source.includes('require('), false);
});

test('build.js shares the options', () => {
  const { TERSER_OPTIONS } = require('../face-build');
  assert.ok(TERSER_OPTIONS.mangle.reserved.includes('clock_minute'));
  assert.ok(TERSER_OPTIONS.mangle.reserved.includes('subscribe'));
});

test('workflow is valid', () => {
  const wf = path.join(root, '.github', 'workflows', 'rebuild-site.yml');
  execFileSync('python3', ['-c', 'import yaml,sys; yaml.safe_load(open(sys.argv[1]))', wf]);
  const text = fs.readFileSync(wf, 'utf8');
  assert.ok(text.includes('NETLIFY_BUILD_HOOK'));
  assert.ok(text.includes('repladder.js'));
});
