const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// The firmware's character table and per-position substitutions, from the emulator.
const lcd = {};
vm.createContext(lcd);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../upstream/js/lcdChars.js'), 'utf8') + ';this.seg=lcdSegmentsForPosition;', lcd);

// Main cells 0 and 2 (watch positions 4 and 6) drive their top and bottom bars together: a character whose
// a and d differ there gains or loses a bar, and an L becomes a top-half L.
function damage(main) {
  const text = ('      ' + main).slice(-6), bad = [];
  for (const i of [0, 2]) {
    const ch = text[i], s = lcd.seg(4 + i, ch);
    if (s.a !== s.d || ch === 'L') bad.push(`${ch} in cell ${i}`);
  }
  return bad;
}

module.exports = { damage };
