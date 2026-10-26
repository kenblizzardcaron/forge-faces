// Builds each face's <name>.js into <name>.min.js: npm install terser@5 && node build.js
// Top-level names are shortened; the hooks the watch calls by name and `subscribe` are kept.
// Optional local.json (gitignored), e.g. {"repladder": {"level": 45}}, also writes <name>-local.js and its <name>-local.min.js.
const fs = require('node:fs');
const { minify } = require('terser');
const { MAX_BYTES, TERSER_OPTIONS, localize } = require('./face-build');

const FACES = ['multitimer', 'repladder', 'fastzone'];

const LOCAL = fs.existsSync('local.json') ? JSON.parse(fs.readFileSync('local.json', 'utf8')) : {};

async function build(name, src = fs.readFileSync(`${name}.js`, 'utf8'), out = `${name}.min.js`) {
  const { code } = await minify(src, TERSER_OPTIONS);
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
