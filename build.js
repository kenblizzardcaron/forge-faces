// Builds multitimer-<style>.min.js for each beep style: npm install terser@5 && node build.js
// Top-level names are shortened; the hooks the watch calls by name and `subscribe` are kept.
const fs = require('node:fs');
const { minify } = require('terser');

const RESERVED = ['subscribe', 'init', 'enter', 'exit', 'a_short', 'a_long', 'l_short', 'l_long',
  'tilt', 'tap', 'button', 'ble_rx', 'clock_minute', 'clock_hour'];
const STYLES = ['stock', 'ping', 'countdown'];
const MAX_BYTES = 8158;

async function main() {
  // The style line is removed so global_defs can fold BEEP_STYLE to a constant per build.
  const source = fs.readFileSync('multitimer.js', 'utf8').replace(/^var BEEP_STYLE = '[^']*';\n?/m, '');
  for (const style of STYLES) {
    const { code } = await minify(source, {
      mangle: { toplevel: true, reserved: RESERVED },
      compress: { toplevel: false, global_defs: { BEEP_STYLE: style } },
      format: { comments: false },
    });
    const bytes = Buffer.byteLength(code);
    fs.writeFileSync(`multitimer-${style}.min.js`, code);
    console.log(`${style}: ${bytes} bytes`);
    if (bytes > MAX_BYTES) process.exitCode = 1;
  }
}

main();
