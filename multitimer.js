// Multi-timer: three concurrent countdown timers on one face.
// Over the 8158-byte limit unminified: upload the minified build (emulator: Minify, then Run minified).
const subscribe = E_BUTTONS + E_A_LONG + E_L_LONG;

// Timer states: 0 IDLE, 1 RUN, 2 PAUSE, 3 RUNG, 4 ARMED
// Timer modes: 0 normal, 1 fast, 2 interval
function mk() { return { s: 0, st: 0, e: 0, r: 0, m: 0, k: 0 }; }
var P = [60, 180, 300, 600, 900, 1500, 1800, 2700, 3600, 64800];
var T = [mk(), mk(), mk()];
var cur = 0, ui = 0, ef = 0, pb = 0, rep = 0, mt = 0;
var dn = [0, 0], lf = 0, cb = 0;
var tk = -1, rg = -1, nx = -1;
var rq = [], ri = -1, rn = 0, ron = 0;
var bb = '', bs = 0;  // BLE reassembly: bytes so far, next expected seq

function now() { return new Date().getTime(); }
function pad(n) { return ('0' + n).slice(-2); }
function fmt(s) { return pad(Math.floor(s / 3600)) + pad(Math.floor(s / 60) % 60) + pad(s % 60); }
function g(i) { return i == 9 ? '0' : String(i + 1); }

function rem(t) {
  if (t.st == 1) return Math.max(0, t.e - now());
  if (t.st == 2) return t.r;
  if (t.st === 0) return t.s * 1000;
  return 0;
}

function draw() {
  if (!Ollee.active()) return;
  var ph = Math.floor(now() / 500) % 2 == 0;
  var t = T[cur];
  var main, c;
  if (mt > 0) main = 'InTEr';
  else if (ui == 2) main = fmt(P[pb]);
  else if (ui == 1) {
    main = fmt(t.s);
    if (!ph && !rep) { var i = 4 - 2 * ef; main = main.slice(0, i) + '  ' + main.slice(i + 2); }
  } else if (t.st == 3) main = ph ? '000000' : '      ';
  else main = fmt(Math.ceil(rem(t) / 1000));
  Ollee.drawMain(main);
  Ollee.drawColon(mt == 0);

  if (ui == 2) c = g(pb);
  else if (t.m == 2 && (t.st == 1 || t.st == 2)) c = g(t.k);
  else if (t.m == 1 || (t.s === 0 && (t.st === 0 || t.st == 4))) c = 'F';
  else c = ' ';
  Ollee.drawDay(String(cur + 1) + c);

  Ollee.drawLap(ui === 0 && mt == 0 && (t.st == 1 || t.st == 4) && ph);
  var pm = false;
  for (var j = 0; j < 3; j++) if (j != cur && (T[j].st == 1 || T[j].st == 4)) pm = true;
  Ollee.drawPM(pm);
}

function tick() {
  if (mt > 0) mt--;
  if (rep == 1 && ui == 1 && dn[0]) inc();
  // Guarded by !cb: an A+L combo can switch cur mid-hold onto another fast timer.
  if (rep == 2 && dn[1] && !cb && fast(T[cur])) addMin(T[cur]);
  chk();
  draw();
}

function init() { Ollee.subscribe(E_CLOCK_MINUTE + E_BLE_RX); }

function enter() {
  Ollee.clear();
  tk = Ollee.setInterval(tick, 250);
  ui = 0; rep = 0; dn = [0, 0]; cb = 0; lf = 0;
  pick();
  draw();
}

// Shows the rung timer, else the running timer ending soonest, else keeps cur.
function pick() {
  var b = -1;
  for (var i = 0; i < 3; i++) if (T[i].st == 3) { cur = i; return; }
  for (var j = 0; j < 3; j++) if (T[j].st == 1 && (b < 0 || T[j].e < T[b].e)) b = j;
  if (b >= 0) cur = b;
}

// Runs on and off screen: rings anything due, then arms a one-shot if an expiry is near.
function clock_minute() { chk(); arm(); }

// Off screen the 250 ms tick is gone, so a one-shot wakes the face at the next expiry within a minute.
function arm() {
  if (Ollee.active()) return;
  if (nx != -1) Ollee.clearTimeout(nx);
  nx = -1;
  var d = 60001, x;  // sentinel: nothing due within a minute
  for (var i = 0; i < 3; i++) if (T[i].st == 1) { x = T[i].e - now(); if (x < d) d = x; }
  if (d <= 60000) nx = Ollee.setTimeout(function () { nx = -1; chk(); arm(); }, Math.max(d, 1));
}

function exit() {
  if (ri >= 0 && ron && T[ri].st == 3) clr(T[ri]);
  stopRing();
  rq = [];
  if (tk != -1) Ollee.clearInterval(tk);
  if (nx != -1) Ollee.clearTimeout(nx);
  tk = nx = -1;
  Ollee.led_off();
}

// Edit field ef: 0 seconds, 1 minutes, 2 hours. Wraps without carry.
function inc() {
  var s = T[cur].s, sec = s % 60, min = Math.floor(s / 60) % 60, hr = Math.floor(s / 3600);
  if (ef == 0) sec = (sec + 1) % 60;
  else if (ef == 1) min = (min + 1) % 60;
  else hr = (hr + 1) % 24;
  T[cur].s = hr * 3600 + min * 60 + sec;
}

function start(t) { t.st = 1; t.m = 0; t.e = now() + t.s * 1000; }
function clr(t) { t.st = 0; t.m = 0; t.k = 0; }

function aTap() {
  if (ui == 1) inc();
  else if (ui == 2) { T[cur].s = P[pb]; ui = 0; }
  else if (ui == 0) {
    var t = T[cur];
    if (t.st == 0 && t.s > 0) start(t);
    else if (t.st == 1) { t.r = Math.max(0, t.e - now()); t.st = 2; }
    else if (t.st == 2) { t.e = now() + t.r; t.st = 1; }
    else if (t.st === 0) { t.st = 4; t.m = 1; }
    else if (t.st == 4) clr(t);
  }
}
function lTap() {
  if (ui == 2) pb = (pb + 1) % 10;
  else if (ui == 0 && T[cur].st == 0) { ui = 1; ef = 0; }
  else if (ui == 1 && ++ef > 2) ui = 0;
  else if (ui == 0 && T[cur].st == 2) clr(T[cur]);
  else if (ui == 0 && fast(T[cur])) addMin(T[cur]);
}
// Fast mode: a timer armed at zero starts on the first add; adds cap at 23:59:59.
function fast(t) { return t.m == 1 && (t.st == 1 || t.st == 4); }
function addMin(t) {
  if (t.st == 4) { t.st = 1; t.e = now(); }
  t.e = Math.min(t.e + 60000, now() + 86399000);
}
function aHold() {
  if (ui == 1) { rep = 1; inc(); }
  else if (ui == 0 && T[cur].st == 0 && P[0] > 0) ivl(T[cur]);
}
// Interval: runs preset slots 1..10 in turn; the zero slot ends the run.
function ivl(t) { t.m = 2; t.k = 0; t.st = 1; t.e = now() + P[0] * 1000; mt = 4; }

// Bluetooth: a 45-byte message comes as 3 writes, each [seq] + data. Bad order resets.
function ble_rx(d) {
  try {
    var q = d.charCodeAt(0);
    if (q == 0) { bb = ''; bs = 0; }
    if (q != bs || q > 2) { bb = ''; bs = 0; return; }
    bb += d.substr(1); bs++;
    if (bb.length >= 45) { apply(bb); bb = ''; bs = 0; }
  } catch (e) { bb = ''; bs = 0; }
}
// Message: [timer] [HH MM SS mode] then 10 little-endian uint32 presets.
// Mode 0 saves, 1 saves and starts the timer, 2 saves and starts interval mode.
function apply(b) {
  if (b.charCodeAt(0) > 2) return;
  var n = b.charCodeAt(0), t = T[n], i, v, sec;
  for (i = 0; i < 10; i++) {
    v = ((b.charCodeAt(5 + 4 * i) | (b.charCodeAt(6 + 4 * i) << 8) |
      (b.charCodeAt(7 + 4 * i) << 16) | (b.charCodeAt(8 + 4 * i) << 24)) >>> 0);
    P[i] = Math.min(v, 86399);
  }
  sec = b.charCodeAt(1) * 3600 + b.charCodeAt(2) * 60 + b.charCodeAt(3);
  var md = b.charCodeAt(4);
  if (md == 1 && sec > 0) { t.s = Math.min(sec, 86399); start(t); }
  else if (md == 2 && P[0] > 0) { ivl(t); if (t !== T[cur]) mt = 0; }
  else md = 0;
  if (md && ri == n) { stopRing(); nextRing(); }
  if (md && t === T[cur]) ui = 0;
  arm(); draw();
}
function lHold() {
  if (ui == 0 && T[cur].st == 0) { ui = 2; pb = 0; }
  else if (ui == 2) { P[pb] = T[cur].s; Ollee.beep(); }
  else if (ui == 0 && fast(T[cur])) { rep = 2; addMin(T[cur]); }
}
function combo() { if (ui == 0) cur = (cur + 1) % 3; }

// Expiry: a timer reaching zero is RUNG and joins the ring queue.
function chk() {
  for (var i = 0; i < 3; i++) if (T[i].st == 1 && now() >= T[i].e) expire(i);
}
function expire(i) {
  var t = T[i], stepped = false;
  while (t.m == 2 && t.k < 9 && P[t.k + 1] > 0 && now() >= t.e) {
    t.k++; t.e += P[t.k] * 1000; stepped = true;
  }
  if (now() < t.e) { if (stepped) Ollee.beep(); return; }
  T[i].st = 3;
  if (Ollee.active()) { cur = i; ui = 0; rep = 0; }
  ring(i);
}
function ring(i) {
  rq.push(i);
  if (ri < 0) nextRing();
}
function nextRing() {
  if (rq.length === 0) { ri = -1; Ollee.led_off(); return; }
  ri = rq.shift();
  ron = Ollee.active() ? 1 : 0;
  rn = ron ? 40 : 10;
  bp();
}
// One beep per 500 ms: 40 beeps on screen (~20 s), 10 off screen (~5 s).
function bp() {
  rg = -1;
  if (ri < 0) return;
  Ollee.beep();
  if (rn % 2 === 0) Ollee.led_on(); else Ollee.led_off();
  rn--;
  if (rn > 0) rg = Ollee.setTimeout(bp, 500);
  else { Ollee.led_off(); if (!ron) rq = []; nextRing(); }
}
function stopRing() {
  if (rg != -1) Ollee.clearTimeout(rg);
  rg = -1; ri = -1;
  Ollee.led_off();
}

// Any press while ringing or rung silences it; the press is not a tap or hold.
function ack() {
  var was = ri;
  cb = 1;
  stopRing();
  for (var i = 0; i < 3; i++) if (T[i].st == 3 && (i == cur || i == was)) clr(T[i]);
  for (var j = 0; j < 3; j++) if (T[j].st == 3) { cur = j; break; }
  nextRing();
}

function button(b, e) {
  if (e == E_DOWN) {
    if (Ollee.active() && (ri >= 0 || T[cur].st == 3)) ack();
    dn[b] = 1;
    if (dn[0] && dn[1] && !cb) { cb = 1; combo(); }
  } else {
    dn[b] = 0;
    rep = 0;
    if (!cb && !lf) { if (b == B_A) aTap(); else lTap(); }
    if (!dn[0] && !dn[1]) { cb = 0; lf = 0; }
  }
  draw();
}

function a_long() {
  if (cb) return;
  lf = 1;
  aHold();
  draw();
}

function l_long() {
  if (cb) return;
  lf = 1;
  lHold();
  draw();
}
