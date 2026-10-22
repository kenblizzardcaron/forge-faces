// Multi-timer: three concurrent countdown timers on one face.
// Readable source is over the 8158-byte limit: upload the built multitimer.min.js.
// Build it: node tools/build-face.js examples/multitimer.js examples
const subscribe = E_BUTTONS + E_A_LONG + E_L_LONG;
var STOCK = 0, PING = 1, COUNTDOWN = 2;
var beepStyle = STOCK;  // set over Bluetooth: text S0, S1 or S2
var SETTINGS_MESSAGE = 0x53;
var IDLE = 0, RUNNING = 1, PAUSED = 2, RUNG = 3, ARMED = 4;
var NORMAL = 0, FAST = 1, INTERVAL = 2;
var VIEW_TIMER = 0, VIEW_EDIT = 1, VIEW_PRESETS = 2;
var REPEAT_NONE = 0, REPEAT_EDIT = 1, REPEAT_ADD = 2;
// Stock triple: 8 steps of 125 ms per 1000 ms period; beeps on steps 0-2, LED on steps 0-3.
var RING_STEP_MS = 125, STEPS_PER_PERIOD = 8, BEEPS_PER_TRIPLE = 3, LED_STEPS = 4;
var TRIPLES_ON_EXPIRY = 20, TRIPLES_ON_INTERVAL = 10, TRIPLES_OFF_SCREEN = 5, TRIPLES_COUNTDOWN_CHANGE = 1;
// Ping: one beep per PING_STEP_MS.
var PING_STEP_MS = 500, PING_BEEPS_ON_SCREEN = 40, PING_BEEPS_OFF_SCREEN = 10;
// Countdown: spacing of the three beeps for an interval change; tuned on hardware.
var CHANGE_BEEP_MS = RING_STEP_MS;
// Countdown cues beep at 5, 4, 3, 2, 1 s left. A timer's cue holds the last second beeped (CUE_FROM_S + 1 = none).
var CUE_FROM_S = 5;

function newTimer() { return { seconds: 0, state: IDLE, endsAt: 0, pausedMs: 0, mode: NORMAL, slot: 0, cue: CUE_FROM_S + 1 }; }
var presets = [60, 180, 300, 600, 900, 1500, 1800, 2700, 3600, 64800];
var timers = [newTimer(), newTimer(), newTimer()];
var current = 0, view = VIEW_TIMER, editField = 0, presetIndex = 0, repeating = REPEAT_NONE, messageTicks = 0;
var buttonDown = [0, 0], longFired = 0, comboActive = 0;
var tickTimer = -1, ringTimer = -1, expiryTimer = -1;
var ringQueue = [], ringingIndex = -1, ringIsTriple = false, ringStepMs = PING_STEP_MS, ringStepsDone = 0, ringStepsTotal = 0, ringOnScreen = false;
var bleBuffer = '', bleNextSeq = 0;  // BLE reassembly: bytes so far, next expected seq

function now() { return new Date().getTime(); }
function pad(n) { return ('0' + n).slice(-2); }
function formatHMS(s) { return pad(Math.floor(s / 3600)) + pad(Math.floor(s / 60) % 60) + pad(s % 60); }
function slotGlyph(i) { return i == 9 ? '0' : String(i + 1); }

function remainingMs(t) {
  if (t.state == RUNNING) return Math.max(0, t.endsAt - now());
  if (t.state == PAUSED) return t.pausedMs;
  if (t.state === IDLE) return t.seconds * 1000;
  return 0;
}

function draw() {
  if (!Ollee.active()) return;
  var blinkOn = Math.floor(now() / 500) % 2 == 0;
  var t = timers[current];
  var main, corner;
  if (messageTicks > 0) main = 'InTEr';
  else if (view == VIEW_PRESETS) main = formatHMS(presets[presetIndex]);
  else if (view == VIEW_EDIT) {
    main = formatHMS(t.seconds);
    if (!blinkOn && !repeating) { var i = 4 - 2 * editField; main = main.slice(0, i) + '  ' + main.slice(i + 2); }
  } else if (t.state == RUNG) main = blinkOn ? '000000' : '      ';
  else main = formatHMS(Math.ceil(remainingMs(t) / 1000));
  Ollee.drawMain(main);
  Ollee.drawColon(messageTicks == 0);

  if (view == VIEW_PRESETS) corner = slotGlyph(presetIndex);
  else if (t.mode == INTERVAL && (t.state == RUNNING || t.state == PAUSED)) corner = slotGlyph(t.slot);
  else if (t.mode == FAST || (t.seconds === 0 && (t.state === IDLE || t.state == ARMED))) corner = 'F';
  else corner = ' ';
  Ollee.drawDay(String(current + 1) + corner);

  Ollee.drawLap(view === VIEW_TIMER && messageTicks == 0 && (t.state == RUNNING || t.state == ARMED) && blinkOn);
  var pm = false;
  for (var j = 0; j < 3; j++) if (j != current && (timers[j].state == RUNNING || timers[j].state == ARMED)) pm = true;
  Ollee.drawPM(pm);
}

function tick() {
  if (messageTicks > 0) messageTicks--;
  if (repeating == REPEAT_EDIT && view == VIEW_EDIT && buttonDown[0]) incrementField();
  // Guarded by !comboActive: an A+L combo can switch current mid-hold onto another fast timer.
  if (repeating == REPEAT_ADD && buttonDown[1] && !comboActive && isFastActive(timers[current])) addMinute(timers[current]);
  checkDue();
  draw();
}

function init() { Ollee.subscribe(E_CLOCK_MINUTE + E_BLE_RX); }

function enter() {
  Ollee.clear();
  tickTimer = Ollee.setInterval(tick, 250);
  view = VIEW_TIMER; repeating = REPEAT_NONE; buttonDown = [0, 0]; comboActive = 0; longFired = 0;
  pickTimerToShow();
  draw();
}

// Shows the rung timer, else the running timer ending soonest, else keeps current.
function pickTimerToShow() {
  var soonest = -1;
  for (var i = 0; i < 3; i++) if (timers[i].state == RUNG) { current = i; return; }
  for (var j = 0; j < 3; j++) if (timers[j].state == RUNNING && (soonest < 0 || timers[j].endsAt < timers[soonest].endsAt)) soonest = j;
  if (soonest >= 0) current = soonest;
}

// Runs on and off screen: rings anything due, then arms a one-shot if an expiry is near.
function clock_minute() { checkDue(); armExpiryWake(); }

// Off screen the 250 ms tick is gone, so a one-shot wakes the face at the next expiry or cue within a minute.
function armExpiryWake() {
  if (Ollee.active()) return;
  if (expiryTimer != -1) Ollee.clearTimeout(expiryTimer);
  expiryTimer = -1;
  var d = 60001, x;  // sentinel: nothing due within a minute
  for (var i = 0; i < 3; i++) if (timers[i].state == RUNNING) {
    x = timers[i].endsAt - now(); if (x < d) d = x;
    x = nextCueAt(timers[i]) - now(); if (x < d) d = x;
  }
  if (d <= 60000) expiryTimer = Ollee.setTimeout(function () { expiryTimer = -1; checkDue(); armExpiryWake(); }, Math.max(d, 1));
}

function exit() {
  if (ringingIndex >= 0 && ringOnScreen && timers[ringingIndex].state == RUNG) clearTimer(timers[ringingIndex]);
  stopRing();
  ringQueue = [];
  if (tickTimer != -1) Ollee.clearInterval(tickTimer);
  if (expiryTimer != -1) Ollee.clearTimeout(expiryTimer);
  tickTimer = expiryTimer = -1;
  Ollee.led_off();
}

// Edit field editField: 0 seconds, 1 minutes, 2 hours. Wraps without carry.
function incrementField() {
  var s = timers[current].seconds, sec = s % 60, min = Math.floor(s / 60) % 60, hr = Math.floor(s / 3600);
  if (editField == 0) sec = (sec + 1) % 60;
  else if (editField == 1) min = (min + 1) % 60;
  else hr = (hr + 1) % 24;
  timers[current].seconds = hr * 3600 + min * 60 + sec;
}

function startTimer(t) { t.state = RUNNING; t.mode = NORMAL; t.endsAt = now() + t.seconds * 1000; t.cue = CUE_FROM_S + 1; }
function clearTimer(t) { t.state = IDLE; t.mode = NORMAL; t.slot = 0; t.cue = CUE_FROM_S + 1; }

function onATap() {
  if (view == VIEW_EDIT) incrementField();
  else if (view == VIEW_PRESETS) { timers[current].seconds = presets[presetIndex]; view = VIEW_TIMER; }
  else if (view == VIEW_TIMER) {
    var t = timers[current];
    if (t.state == IDLE && t.seconds > 0) startTimer(t);
    else if (t.state == RUNNING) { t.pausedMs = Math.max(0, t.endsAt - now()); t.state = PAUSED; }
    else if (t.state == PAUSED) { t.endsAt = now() + t.pausedMs; t.state = RUNNING; }
    else if (t.state === IDLE) { t.state = ARMED; t.mode = FAST; }
    else if (t.state == ARMED) clearTimer(t);
  }
}
function onLTap() {
  if (view == VIEW_PRESETS) presetIndex = (presetIndex + 1) % 10;
  else if (view == VIEW_TIMER && timers[current].state == IDLE) { view = VIEW_EDIT; editField = 0; }
  else if (view == VIEW_EDIT && ++editField > 2) view = VIEW_TIMER;
  else if (view == VIEW_TIMER && timers[current].state == PAUSED) clearTimer(timers[current]);
  else if (view == VIEW_TIMER && isFastActive(timers[current])) addMinute(timers[current]);
}
// Fast mode: a timer armed at zero starts on the first add; adds cap at 23:59:59.
function isFastActive(t) { return t.mode == FAST && (t.state == RUNNING || t.state == ARMED); }
function addMinute(t) {
  if (t.state == ARMED) { t.state = RUNNING; t.endsAt = now(); }
  t.endsAt = Math.min(t.endsAt + 60000, now() + 86399000);
  t.cue = CUE_FROM_S + 1;
}
function onAHold() {
  if (view == VIEW_EDIT) { repeating = REPEAT_EDIT; incrementField(); }
  else if (view == VIEW_TIMER && timers[current].state == IDLE && presets[0] > 0) startInterval(timers[current]);
}
// Interval: runs preset slots 1..10 in turn; the zero slot ends the run.
function startInterval(t) { t.mode = INTERVAL; t.slot = 0; t.state = RUNNING; t.endsAt = now() + presets[0] * 1000; t.cue = CUE_FROM_S + 1; messageTicks = 4; }

// Bluetooth: a 45-byte message comes as 3 writes, each [seq] + data. Bad order resets.
function ble_rx(d) {
  try {
    // Settings: 'S' then the style as a digit (text S0-S2) or a raw byte 0-2; other values are ignored.
    if (d.charCodeAt(0) == SETTINGS_MESSAGE) {
      var style = d.charCodeAt(1);
      if (style >= 0x30) style -= 0x30;
      if (d.length >= 2 && style <= COUNTDOWN) { beepStyle = style; armExpiryWake(); draw(); }
      return;
    }
    var q = d.charCodeAt(0);
    if (q == 0) { bleBuffer = ''; bleNextSeq = 0; }
    if (q != bleNextSeq || q > 2) { bleBuffer = ''; bleNextSeq = 0; return; }
    bleBuffer += d.substr(1); bleNextSeq++;
    if (bleBuffer.length >= 45) { applyBleMessage(bleBuffer); bleBuffer = ''; bleNextSeq = 0; }
  } catch (e) { bleBuffer = ''; bleNextSeq = 0; }
}
// Message: [timer] [HH MM SS mode] then 10 little-endian uint32 presets.
// Mode 0 saves, 1 saves and starts the timer, 2 saves and starts interval mode.
function applyBleMessage(b) {
  if (b.charCodeAt(0) > 2) return;
  var n = b.charCodeAt(0), t = timers[n], i, v, sec;
  for (i = 0; i < 10; i++) {
    v = ((b.charCodeAt(5 + 4 * i) | (b.charCodeAt(6 + 4 * i) << 8) |
      (b.charCodeAt(7 + 4 * i) << 16) | (b.charCodeAt(8 + 4 * i) << 24)) >>> 0);
    presets[i] = Math.min(v, 86399);
  }
  sec = b.charCodeAt(1) * 3600 + b.charCodeAt(2) * 60 + b.charCodeAt(3);
  var md = b.charCodeAt(4);
  if (md == 1 && sec > 0) { t.seconds = Math.min(sec, 86399); startTimer(t); }
  else if (md == 2 && presets[0] > 0) { startInterval(t); if (t !== timers[current]) messageTicks = 0; }
  else md = 0;
  if (md && ringingIndex == n) { stopRing(); nextRing(); }
  if (md && t === timers[current]) view = VIEW_TIMER;
  armExpiryWake(); draw();
}
function onLHold() {
  if (view == VIEW_TIMER && timers[current].state == IDLE) { view = VIEW_PRESETS; presetIndex = 0; }
  else if (view == VIEW_PRESETS) { presets[presetIndex] = timers[current].seconds; Ollee.beep(); }
  else if (view == VIEW_TIMER && isFastActive(timers[current])) { repeating = REPEAT_ADD; addMinute(timers[current]); }
}
function onCombo() { if (view == VIEW_TIMER) current = (current + 1) % 3; }

// Expiry: a timer reaching zero is RUNG and joins the ring queue.
function checkExpiries() {
  for (var i = 0; i < 3; i++) if (timers[i].state == RUNNING && now() >= timers[i].endsAt) expireTimer(i);
}
function checkDue() { checkExpiries(); checkCues(); }

// Countdown: beeps once when a running timer first reaches each whole second from 5 down to 1.
function checkCues() {
  if (beepStyle != COUNTDOWN) return;
  for (var i = 0; i < 3; i++) {
    var t = timers[i], s;
    if (t.state != RUNNING) continue;
    s = Math.ceil(remainingMs(t) / 1000);
    if (s >= 1 && s < t.cue) { t.cue = s; Ollee.beep(); }
  }
}
// Clock time of a running countdown timer's next cue, or Infinity when none is left this slot.
function nextCueAt(t) {
  if (beepStyle != COUNTDOWN || t.cue <= 1) return Infinity;
  return t.endsAt - (t.cue - 1) * 1000;
}
function expireTimer(i) {
  var t = timers[i], stepped = false;
  while (t.mode == INTERVAL && t.slot < 9 && presets[t.slot + 1] > 0 && now() >= t.endsAt) {
    t.slot++; t.endsAt += presets[t.slot] * 1000; t.cue = CUE_FROM_S + 1; stepped = true;
  }
  if (now() < t.endsAt) {
    if (stepped) { if (beepStyle == PING) Ollee.beep(); else queueRing(i, true); }
    return;
  }
  timers[i].state = RUNG;
  if (Ollee.active()) { current = i; view = VIEW_TIMER; repeating = REPEAT_NONE; }
  queueRing(i, false);
}
// Interval changes ring fewer triples than expiry in stock; countdown rings one triple for them.
function queueRing(index, interval) {
  ringQueue.push({ index: index, interval: interval });
  if (ringingIndex < 0) nextRing();
}
function nextRing() {
  if (ringQueue.length === 0) { ringingIndex = -1; Ollee.led_off(); return; }
  var entry = ringQueue.shift();
  ringingIndex = entry.index;
  ringOnScreen = Ollee.active();
  ringIsTriple = beepStyle == STOCK || (beepStyle == COUNTDOWN && entry.interval);
  ringStepMs = !ringIsTriple ? PING_STEP_MS : (beepStyle == COUNTDOWN ? CHANGE_BEEP_MS : RING_STEP_MS);
  ringStepsTotal = ringStepsFor(entry);
  ringStepsDone = 0;
  ringStep();
}
// Triples count 8 steps each; ping counts single beeps.
function ringStepsFor(entry) {
  if (ringIsTriple) {
    var triples = TRIPLES_OFF_SCREEN;
    if (beepStyle == COUNTDOWN) triples = TRIPLES_COUNTDOWN_CHANGE;
    else if (ringOnScreen) triples = entry.interval ? TRIPLES_ON_INTERVAL : TRIPLES_ON_EXPIRY;
    return triples * STEPS_PER_PERIOD;
  }
  return ringOnScreen ? PING_BEEPS_ON_SCREEN : PING_BEEPS_OFF_SCREEN;
}
// Triple steps are ringStepMs apart; ping beeps are PING_STEP_MS apart and the LED alternates.
function ringStep() {
  ringTimer = -1;
  if (ringingIndex < 0) return;
  var stepInPeriod = ringIsTriple ? ringStepsDone % STEPS_PER_PERIOD : ringStepsDone % 2;
  var beeps = !ringIsTriple || stepInPeriod < BEEPS_PER_TRIPLE;
  var ledOn = ringIsTriple ? stepInPeriod < LED_STEPS : stepInPeriod === 0;
  if (beeps) Ollee.beep();
  if (ledOn) Ollee.led_on(); else Ollee.led_off();
  ringStepsDone++;
  if (ringStepsDone === ringStepsTotal) {
    if (!ringOnScreen) ringQueue = [];
    nextRing();
    return;
  }
  ringTimer = Ollee.setTimeout(ringStep, ringStepMs);
}
function stopRing() {
  if (ringTimer != -1) Ollee.clearTimeout(ringTimer);
  ringTimer = -1; ringingIndex = -1;
  Ollee.led_off();
}

// Any press while ringing or rung silences it; the press is not a tap or hold.
function acknowledgeRing() {
  var was = ringingIndex;
  comboActive = 1;
  stopRing();
  for (var i = 0; i < 3; i++) if (timers[i].state == RUNG && (i == current || i == was)) clearTimer(timers[i]);
  for (var j = 0; j < 3; j++) if (timers[j].state == RUNG) { current = j; break; }
  nextRing();
}

function button(b, e) {
  if (e == E_DOWN) {
    if (Ollee.active() && (ringingIndex >= 0 || timers[current].state == RUNG)) acknowledgeRing();
    buttonDown[b] = 1;
    if (buttonDown[0] && buttonDown[1] && !comboActive) { comboActive = 1; onCombo(); }
  } else {
    buttonDown[b] = 0;
    repeating = REPEAT_NONE;
    if (!comboActive && !longFired) { if (b == B_A) onATap(); else onLTap(); }
    if (!buttonDown[0] && !buttonDown[1]) { comboActive = 0; longFired = 0; }
  }
  draw();
}

function a_long() {
  if (comboActive) return;
  longFired = 1;
  onAHold();
  draw();
}

function l_long() {
  if (comboActive) return;
  longFired = 1;
  onLHold();
  draw();
}
