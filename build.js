// Builds multitimer.min.js: npm install terser@5 && node build.js
// Top-level names are shortened; the hooks the watch calls by name and `subscribe` are kept.
const fs = require('node:fs');
const { minify } = require('terser');

const RESERVED = ['subscribe', 'init', 'enter', 'exit', 'a_short', 'a_long', 'l_short', 'l_long',
  'tilt', 'tap', 'button', 'ble_rx', 'clock_minute', 'clock_hour'];
const MAX_BYTES = 8158;

async function main() {
  const { code } = await minify(fs.readFileSync('multitimer.js', 'utf8'), {
    mangle: { toplevel: true, reserved: RESERVED },
    compress: { toplevel: false },
    format: { comments: false },
  });
  const bytes = Buffer.byteLength(code);
  fs.writeFileSync('multitimer.min.js', code);
  console.log(`${bytes} bytes`);
  if (bytes > MAX_BYTES) process.exitCode = 1;
}

main();
