// Builds each face's <name>.js into <name>.min.js: npm install terser@5 && node build.js
// Top-level names are shortened; the hooks the watch calls by name and `subscribe` are kept.
// Optional local.json (gitignored), e.g. {"repladder": {"level": 45}}, also builds <name>.local.min.js.
const fs = require('node:fs');
const { minify } = require('terser');

const FACES = ['multitimer', 'repladder'];
const RESERVED = ['subscribe', 'init', 'enter', 'exit', 'a_short', 'a_long', 'l_short', 'l_long',
  'tilt', 'tap', 'button', 'ble_rx', 'clock_minute', 'clock_hour'];
const MAX_BYTES = 8158;

const LOCAL = fs.existsSync('local.json') ? JSON.parse(fs.readFileSync('local.json', 'utf8')) : {};

// Swaps each override into the face's `var settings = { ... };` defaults.
function localize(src, name, overrides) {
  return src.replace(/var settings = \{[^}]*\}/, (literal) => {
    for (const [key, value] of Object.entries(overrides)) {
      const re = new RegExp(`\\b${key}: [^,}]+`);
      if (!re.test(literal)) throw new Error(`local.json: ${name} has no setting "${key}"`);
      literal = literal.replace(re, `${key}: ${JSON.stringify(value)}`);
    }
    return literal;
  });
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
      await build(name, src, `${name}.local.min.js`);
    }
  }
}

main();
