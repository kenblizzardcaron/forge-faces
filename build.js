// Builds each face's <name>.js into <name>.min.js: npm install terser@5 && node build.js
// Top-level names are shortened; the hooks the watch calls by name and `subscribe` are kept.
const fs = require('node:fs');
const { minify } = require('terser');

const FACES = ['multitimer', 'repladder'];
const RESERVED = ['subscribe', 'init', 'enter', 'exit', 'a_short', 'a_long', 'l_short', 'l_long',
  'tilt', 'tap', 'button', 'ble_rx', 'clock_minute', 'clock_hour'];
const MAX_BYTES = 8158;

async function build(name) {
  const { code } = await minify(fs.readFileSync(`${name}.js`, 'utf8'), {
    mangle: { toplevel: true, reserved: RESERVED },
    compress: { toplevel: false },
    format: { comments: false },
  });
  const bytes = Buffer.byteLength(code);
  fs.writeFileSync(`${name}.min.js`, code);
  console.log(`${name}: ${bytes} bytes`);
  if (bytes > MAX_BYTES) process.exitCode = 1;
}

async function main() {
  for (const name of FACES) await build(name);
}

main();
