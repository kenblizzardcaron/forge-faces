// Rep Ladder: a set-by-set rep ladder timer with a work/rest session plan.
// Upload repladder.min.js, the built copy of this file.
const subscribe = E_BUTTONS + E_A_LONG;
var settings = { total: 100, length: 600, sets: 5, pace: 3 };

var IDLE = 0, RUNNING = 1, DONE = 2, EDIT = 3;
var state = IDLE, startAt = 0, paused = false, pausedAt = 0, current = null, lastPhase = -1, message = '', messageUntil = 0;
var displayTimer = -1, longFired = 0;
// Finish ring: stock triple, 125 ms steps, beeping on steps 0-2 of each 8; own timer slot.
var RING_STEP_MS = 125, ringTimer = -1, ringStepNo = 0, ringSteps = 0, cue = 6;

function now() { return new Date().getTime(); }
function pad(n) { return ('0' + n).slice(-2); }
// m:ss from seconds, with m padded to two chars; reps over 99 blank out.
function fmtTime(secs) { var m = Math.floor(secs / 60); return (m < 10 ? ' ' : '') + m + pad(secs % 60); }
function fmtReps(r) { return r > 99 ? '  ' : pad(r); }
function elapsed() { return (paused ? pausedAt : now()) - startAt; }
function flashing() { return now() < messageUntil; }
function flash(word) { message = word; messageUntil = now() + 1000; draw(); }
// ms until ceil(msLeft / 1000) changes; always in (0, 1000].
function secondStep(msLeft) { return msLeft - 1000 * (Math.ceil(msLeft / 1000) - 1); }
function earliest(d, x) { return d && d < x ? d : x; }

// One beep per work/rest change; the last phase end rings the finish and sets DONE.
function onPhase(i) {
  lastPhase = i;
  if (i == current.ends.length) { state = DONE; startRing(Ollee.active()); return; }
  Ollee.beep();
}
// Catches up with the clock: a short beep per lead-in second, then fires onPhase when the phase index moves.
function sync() {
  if (state != RUNNING) return;
  var e = elapsed(), i = e < 0 ? -1 : phaseAt(current, e);
  // Lead-in cues land on schedule()'s whole-second wakeups, at 5..1 s before set 1.
  if (e < 0 && Math.ceil(-e / 1000) < cue) { cue = Math.ceil(-e / 1000); Ollee.beepShort(); }
  if (i != lastPhase) onPhase(i);
}
// 10 periods (80 steps) on screen, 5 off screen.
function startRing(onScreen) {
  ringStepNo = 0; ringSteps = onScreen ? 80 : 40;
  ringStep();
}
function ringStep() {
  ringTimer = -1;
  if (ringStepNo % 8 < 3) Ollee.beep();
  if (++ringStepNo < ringSteps) ringTimer = Ollee.setTimeout(ringStep, RING_STEP_MS);
}
function stopRing() {
  if (ringTimer != -1) Ollee.clearTimeout(ringTimer);
  ringTimer = -1;
}

function draw() {
  if (!Ollee.active()) return;
  sync();
  var day = '  ', main = ' donE', colon = false, lap = false;
  if (state == IDLE) {
    var p = plan(settings.total, settings.length, settings.sets, settings.pace);
    day = p ? 'S1' : 'Er';
    main = fmtTime(settings.length) + (p ? fmtReps(p.reps[0]) : '  ');
    colon = true;
  } else if (state == RUNNING && elapsed() < 0) {
    var s = Math.ceil(-elapsed() / 1000);
    day = 'GO';
    main = s >= 5 ? 'StArt' : String(s);
  } else if (state == RUNNING) {
    var i = phaseAt(current, elapsed()), left = Math.ceil((current.ends[i] - elapsed()) / 1000);
    colon = true;
    if (i % 2 == 0) {
      day = 'S' + (i / 2 + 1);
      main = fmtTime(left) + fmtReps(current.reps[i / 2]);
    } else {
      day = 'r' + ((i + 1) / 2);
      main = fmtTime(left) + fmtReps(current.reps[(i + 1) / 2]);
      lap = !paused && Math.floor(now() / 500) % 2 == 0;
    }
  }
  if (flashing()) { main = message; colon = false; lap = false; }
  Ollee.drawDay(day);
  Ollee.drawMain(main);
  Ollee.drawColon(colon);
  Ollee.drawLap(lap);
  schedule();
}

// Arms exactly one display timer for the next change: flash end, countdown second or LAP flip.
function schedule() {
  var e = elapsed(), d = 0, i;
  if (displayTimer != -1) Ollee.clearTimeout(displayTimer);
  displayTimer = -1;
  if (flashing()) d = messageUntil - now();
  // Paused: the clock is frozen, so only the flash end needs a wakeup.
  if (state == RUNNING && !paused) {
    i = e < 0 ? -1 : phaseAt(current, e);
    // A second change never passes a phase end, so the phase end is covered too.
    d = earliest(d, e < 0 ? secondStep(-e) : secondStep(current.ends[i] - e));
    if (e >= 0 && i % 2 == 1) d = earliest(d, 500 - now() % 500);
  }
  if (d) displayTimer = Ollee.setTimeout(redraw, d);
}
function redraw() { displayTimer = -1; draw(); }

function start() {
  var p = plan(settings.total, settings.length, settings.sets, settings.pace);
  if (!p) { flash('Error'); return; }
  current = p; state = RUNNING; startAt = now() + 5000; paused = false; lastPhase = -1; cue = 6;
}

function enter() {
  Ollee.clear();
  displayTimer = -1;
  draw();
}
// The platform cancels timers when the face leaves the screen.
function exit() { displayTimer = -1; ringTimer = -1; }

// Pausing freezes elapsed(); resuming moves startAt so the clock picks up where it stopped.
function pause() { paused = true; pausedAt = now(); flash('PAUSE'); }
function resume() { startAt += now() - pausedAt; paused = false; messageUntil = 0; }
function reset() { paused = false; state = IDLE; flash('rESEt'); }

function a_long() { longFired = 1; }
// Any press silences a ringing finish. Acts on release unless the long press fired; in DONE any button returns to IDLE.
function button(b, e) {
  if (ringTimer != -1) stopRing();
  if (e != E_UP) return;
  if (!longFired) {
    if (state == DONE) state = IDLE;
    else if (state == IDLE && b == B_A) start();
    else if (state == RUNNING && b == B_A) { if (paused) resume(); else pause(); }
    else if (state == RUNNING && paused && b == B_L) reset();
  }
  longFired = 0;
  draw();
}

// Rep split: earlier sets take the extra reps. Returns null if a set would have under 1 rep or work overruns length.
function plan(total, length, sets, pace) {
  var n = sets;
  var base = Math.floor((total + n * (n - 1) / 2) / n);
  var extra = total - (n * base - n * (n - 1) / 2);
  var reps = [];
  for (var k = 0; k < n; k++) {
    var r = base - k + (k < extra ? 1 : 0);
    if (r < 1) return null;
    reps.push(r);
  }
  if (total * pace > length) return null;
  // Rest is spread so the final end lands exactly on length.
  var restMs = n > 1 ? (length - total * pace) * 1000 / (n - 1) : 0;
  var ends = [];
  var prev = 0, cumWork = 0;
  for (var i = 0; i < n; i++) {
    cumWork += reps[i] * pace;
    prev += reps[i] * pace * 1000;
    ends.push(prev);
    if (i < n - 1) {
      prev = Math.round(cumWork * 1000 + (i + 1) * restMs);
      ends.push(prev);
    }
  }
  return { reps: reps, ends: ends };
}

// Index of the phase running at ms (first end after ms); ends.length once the session is over.
function phaseAt(p, ms) {
  for (var i = 0; i < p.ends.length; i++) if (p.ends[i] > ms) return i;
  return p.ends.length;
}
