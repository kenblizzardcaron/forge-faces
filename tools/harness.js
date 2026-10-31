// Headless Forge face runner: runs a face in a vm context with a fake Ollee,
// clock and timers, mirroring upstream/js/app.js dispatch. Node built-ins only.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const START_MS = 1_000_000_000_000;
const SLOTS = 4;
const BG_EVENTS = (1 << 7) | (1 << 8) | (1 << 9); // E_BLE_RX | E_CLOCK_MINUTE | E_CLOCK_HOUR
const E = { E_A_SHORT: 1 << 0, E_A_LONG: 1 << 1, E_L_SHORT: 1 << 2, E_L_LONG: 1 << 3, E_TILT: 1 << 4, E_BUTTONS: 1 << 5, E_TAP: 1 << 6, E_BLE_RX: 1 << 7, E_CLOCK_MINUTE: 1 << 8, E_CLOCK_HOUR: 1 << 9 };
const BUTTONS = {
  A: { id: 0, shortBit: E.E_A_SHORT, shortHook: 'a_short', longBit: E.E_A_LONG, longHook: 'a_long', holdMs: 1000 },
  L: { id: 1, shortBit: E.E_L_SHORT, shortHook: 'l_short', longBit: E.E_L_LONG, longHook: 'l_long', holdMs: 1500 },
};

function createWatch() {
  const w = { clock: START_MS, active: false, timers: [], seq: 0, bgSubs: 0, beeps: [] };
  w.disp = { main: '      ', day: '  ', colon: false, lap: false, pm: false, hr: false, bell: false, led: false };
  w.hold = { A: null, L: null }; // system hold timers, outside the four face slots
  w.ctx = null;
  return w;
}

function addTimer(w, delay, fn, repeat, id) {
  const e = { due: w.clock + Math.max(0, delay), fn, repeat: repeat ? Math.max(1, delay) : 0, seq: w.seq++, id };
  w.timers.push(e);
  return e;
}

function faceSlotFree(w) {
  for (let i = 0; i < SLOTS; i++) if (!w.timers.some((t) => t.id === i)) return i;
  return -1;
}

function clearFace(w, id) {
  if (id === undefined) w.timers = w.timers.filter((t) => t.id === undefined);
  else w.timers = w.timers.filter((t) => t.id !== id);
}

function faceTimer(w, delay, fn, repeat) {
  const slot = faceSlotFree(w);
  if (slot < 0) return -1;
  addTimer(w, delay, fn, repeat, slot);
  return slot;
}

function fire(w, target) {
  for (;;) {
    let next = null;
    for (const t of w.timers) {
      if (t.due <= target && (!next || t.due < next.due || (t.due === next.due && t.seq < next.seq))) next = t;
    }
    if (!next) break;
    w.clock = next.due;
    if (next.repeat) next.due += next.repeat;
    else w.timers = w.timers.filter((t) => t !== next);
    next.fn();
  }
  w.clock = target;
}

function text(v, n) {
  const s = String(v).slice(0, n);
  return ' '.repeat(n - s.length) + s;
}

function callHook(w, name, ...args) {
  const fn = vm.runInContext(`typeof ${name} === 'function' ? ${name} : null`, w.ctx);
  if (fn) fn(...args);
}

function subsOf(w) {
  return vm.runInContext("typeof subscribe === 'number' ? subscribe : 0", w.ctx);
}

function makeOllee(w) {
  const bgBits = (bits) => bits !== 0 && !(bits & ~BG_EVENTS);
  const draw = (fn) => { if (w.active) fn(); };
  return {
    active: () => w.active,
    drawMain: (t) => draw(() => { w.disp.main = text(t, 6); }),
    drawDay: (t) => draw(() => { w.disp.day = text(t, 2); }),
    drawColon: (on) => draw(() => { w.disp.colon = Boolean(on); }),
    drawLap: (on) => draw(() => { w.disp.lap = Boolean(on); }),
    drawPM: (on) => draw(() => { w.disp.pm = Boolean(on); }),
    drawHR: (on) => draw(() => { w.disp.hr = Boolean(on); }),
    drawBell: (on) => draw(() => { w.disp.bell = Boolean(on); }),
    clear: () => draw(() => { Object.assign(w.disp, { main: '      ', day: '  ', colon: false, lap: false, pm: false, hr: false, bell: false }); }),
    led_on: () => { w.disp.led = true; },
    led_off: () => { w.disp.led = false; },
    beep: () => { w.beeps.push({ t: w.clock, kind: 'beep' }); },
    beepShort: () => { w.beeps.push({ t: w.clock, kind: 'short' }); },
    subscribe: (bits) => { if (!bgBits(bits)) return false; w.bgSubs |= bits; return true; },
    unsubscribe: (bits) => { if (!bgBits(bits)) return false; w.bgSubs &= ~bits; return true; },
    setTimeout: (fn, ms) => faceTimer(w, ms, fn, false),
    setInterval: (fn, ms) => faceTimer(w, ms, fn, true),
    clearTimeout: (id) => clearFace(w, id),
    clearInterval: (id) => clearFace(w, id),
  };
}

function makeContext(w) {
  const FakeDate = function () { return { getTime: () => w.clock }; };
  FakeDate.now = () => w.clock;
  w.ctx = vm.createContext({
    ...E, B_A: 0, B_L: 1, E_DOWN: 0, E_UP: 1,
    Ollee: makeOllee(w), console, Date: FakeDate,
  });
  return w.ctx;
}

function press(w, name) {
  const b = BUTTONS[name];
  if (!w.active || w.hold[name]) return;
  const subs = subsOf(w);
  w.hold[name] = { timer: addTimer(w, b.holdMs, () => {
    w.hold[name].timer = null;
    if (subs & b.longBit) callHook(w, b.longHook);
  }, false, undefined) };
  if (subs & b.shortBit) callHook(w, b.shortHook);
  if (subs & E.E_BUTTONS) callHook(w, 'button', b.id, 0, w.clock);
}

function release(w, name) {
  const h = w.hold[name];
  if (!h) return;
  w.hold[name] = null;
  if (h.timer) w.timers = w.timers.filter((t) => t !== h.timer);
  if (w.active && (subsOf(w) & E.E_BUTTONS)) callHook(w, 'button', BUTTONS[name].id, 1, w.clock);
}

function wrap(w) {
  return {
    ctx: w.ctx,
    main: () => w.disp.main,
    day: () => w.disp.day,
    get colon() { return w.disp.colon; },
    get lap() { return w.disp.lap; },
    get pm() { return w.disp.pm; },
    get hr() { return w.disp.hr; },
    get bell() { return w.disp.bell; },
    get led() { return w.disp.led; },
    beeps: w.beeps,
    advance: (ms) => fire(w, w.clock + ms),
    tap: (btn) => { press(w, btn); release(w, btn); },
    hold: (btn, ms) => { press(w, btn); fire(w, w.clock + ms); release(w, btn); },
    setActive: (on) => {
      if (on) { w.active = true; callHook(w, 'enter'); return; }
      if (w.active) callHook(w, 'exit');
      w.timers = [];
      w.hold = { A: null, L: null };
      w.active = false;
    },
    minute: () => { if (w.bgSubs & E.E_CLOCK_MINUTE) callHook(w, 'clock_minute'); },
    hour: () => { if (w.bgSubs & E.E_CLOCK_HOUR) callHook(w, 'clock_hour'); },
    subscribed: (bit) => (w.bgSubs & bit) !== 0,
  };
}

function loadSource(code) {
  const w = createWatch();
  makeContext(w);
  w.active = false;
  vm.runInContext(code, w.ctx);
  callHook(w, 'init');
  w.active = true;
  callHook(w, 'enter');
  return wrap(w);
}

function loadFace(file) {
  const src = fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
  return loadSource(src);
}

module.exports = { loadFace, loadSource };
