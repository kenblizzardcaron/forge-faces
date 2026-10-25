// Builds each face's <name>.js into <name>.min.js: npm install terser@5 && node build.js
// Top-level names are shortened; the hooks the watch calls by name and `subscribe` are kept.
// Optional local.json (gitignored), e.g. {"repladder": {"level": 45}}, also writes <name>-local.js and its <name>-local.min.js.
const fs = require('node:fs');
const { minify } = require('terser');

const FACES = ['multitimer', 'repladder'];
const RESERVED = ['subscribe', 'init', 'enter', 'exit', 'a_short', 'a_long', 'l_short', 'l_long',
  'tilt', 'tap', 'button', 'ble_rx', 'clock_minute', 'clock_hour'];
const MAX_BYTES = 8158;

const LOCAL = fs.existsSync('local.json') ? JSON.parse(fs.readFileSync('local.json', 'utf8')) : {};

const PROFILE_DEFAULTS = { hold: 0, sets: 5, top: 100, pace: 3, base: 600, level: 1 };

// Fills each local.json profile with the defaults; a missing name or unknown key throws.
function fillProfiles(profiles) {
  return profiles.map((p, i) => {
    if (!p.name) throw new Error(`local.json: repladder profiles[${i}] needs a name`);
    for (const key of Object.keys(p)) {
      if (key !== 'name' && !Object.hasOwn(PROFILE_DEFAULTS, key)) throw new Error(`local.json: repladder profiles[${i}] has no setting "${key}"`);
    }
    return { name: p.name, ...PROFILE_DEFAULTS, ...p };
  });
}

// Swaps each setting into the face's `var settings = { ... };`; `profiles` replaces its list.
function localize(src, name, overrides) {
  const { profiles, ...settings } = overrides;
  let out = src.replace(/var settings = \{[^}]*\}/, (literal) => {
    for (const [key, value] of Object.entries(settings)) {
      const re = new RegExp(`\\b${key}: [^,}]+`);
      if (!re.test(literal)) throw new Error(`local.json: ${name} has no setting "${key}"`);
      literal = literal.replace(re, `${key}: ${JSON.stringify(value)}`);
    }
    return literal;
  });
  if (profiles) {
    const re = /var profiles = \[[\s\S]*?\];/;
    if (!re.test(out)) throw new Error(`local.json: ${name} has no profiles list`);
    const list = JSON.stringify(fillProfiles(profiles));
    out = out.replace(re, () => `var profiles = ${list};`);
  }
  return out;
}

async function build(name, src = fs.readFileSync(`${name}.js`, 'utf8'), out = `${name}.min.js`) {
  const { code } = await minify(src, {
    mangle: { toplevel: true, reserved: RESERVED },
    compress: { toplevel: false },
    format: { comments: false },
  });
  const bytes = Buffer.byteLength(code);
  fs.writeFileSync(out, code);
  console.log(`${out}: ${bytes} bytes`);
  if (bytes > MAX_BYTES) process.exitCode = 1;
}

async function main() {
  for (const name of FACES) {
    await build(name);
    if (LOCAL[name]) {
      const src = localize(fs.readFileSync(`${name}.js`, 'utf8'), name, LOCAL[name]);
      fs.writeFileSync(`${name}-local.js`, src);
      await build(name, src, `${name}-local.min.js`);
    }
  }
}

if (require.main === module) main();

module.exports = { localize };
