const fs = require('node:fs');
const path = require('node:path');
const { localize } = require('../build');
const { loadSource } = require('../tools/harness');

// The fixed classic list the tests run on, so the shipped slots can change without moving them.
const CLASSIC = [
  { name: 'PUSH', hold: 0, sets: 5, top: 100, pace: 3, base: 600, level: 19 },
  { name: 'PULL', hold: 0, sets: 5, top: 50, pace: 3, base: 360, level: 1 },
  { name: 'PLAnK', hold: 1, sets: 5, top: 300, pace: 3, base: 600, level: 1 },
];

// Fresh face on the CLASSIC profile list, booted on PUSH.
function loadClassic() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'repladder.js'), 'utf8');
  return loadSource(localize(src, 'repladder', { profiles: CLASSIC }));
}

// Puts the face on a manual session: the active profile's fields at level 0, then loads and draws.
function manual(w, { top, base, sets, pace, hold = 0 }) {
  Object.assign(w.ctx.cur(), { top, base, sets, pace, hold, level: 0 });
  w.ctx.load();
  w.ctx.draw();
}

module.exports = { loadClassic, manual };
