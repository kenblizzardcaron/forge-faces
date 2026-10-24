// Rep Ladder: a set-by-set rep ladder timer with a work/rest session plan.
// Upload repladder.min.js, the built copy of this file.
const subscribe = E_BUTTONS + E_A_LONG;
var settings = { level: 25, goal: 50, total: 50, length: 600, sets: 5, pace: 3 };

var IDLE = 0, RUNNING = 1, DONE = 2, EDIT = 3, OFFER = 4;
var state = IDLE, startAt = 0, paused = false, pausedAt = 0, current = null, lastPhase = -1, message = '', messageUntil = 0;
var displayTimer = -1, longFired = 0, hush = 0;
// Edit: L cycles fields; A steps the current one, and holding A repeats every 100 ms on its own slot.
var FIELDS = ['level', 'goal', 'total', 'length', 'sets', 'pace'];
var WORDS = ['LEUEL', 'GOAL', 'Count', 'LEn', 'SEtS', 'PACE'];
var LIMITS = [[0, 99, 1], [10, 99, 1], [1, 999, 1], [15, 5985, 15], [1, 9, 1], [1, 20, 1]];
var field = 0, repeatTimer = -1;
// Finish ring: stock triple, 125 ms steps, beeping on steps 0-2 of each 8; own timer slot.
var RING_STEP_MS = 125, ringTimer = -1, ringStepNo = 0, ringSteps = 0, cue = 6;

function now() { return new Date().getTime(); }
function pad(n) { return ('0' + n).slice(-2); }
// m:ss from seconds, with m padded to two chars; reps over 99 blank out.
function fmtTime(secs) { var m = Math.floor(secs / 60); return (m < 10 ? ' ' : '') + m + pad(secs % 60); }
function fmtReps(r) { return r > 99 ? '  ' : pad(r); }
function elapsed() { return (paused ? pausedAt : now()) - startAt; }
function flashing() { return now() < messageUntil; }
function flash(word, ms) { message = word; messageUntil = now() + (ms || 1000); draw(); }
// ms until ceil(msLeft / 1000) changes; always in (0, 1000].
function secondStep(msLeft) { return msLeft - 1000 * (Math.ceil(msLeft / 1000) - 1); }
function earliest(d, x) { return d && d < x ? d : x; }

// One beep per work/rest change; the last phase end rings the finish and sets OFFER below the goal, else DONE.
function onPhase(i) {
  lastPhase = i;
  if (i == current.ends.length) {
    state = settings.level > 0 && settings.level < settings.goal ? OFFER : DONE;
    startRing(Ollee.active()); updateSubscriptions(); return;
  }
  Ollee.beep();
}
// Off screen, the minute tick (or entering) catches up in one step: one beep however many phases passed.
function catchUp() {
  if (state != RUNNING) return;
  var e = elapsed(), i = e < 0 ? -1 : phaseAt(current, e);
  if (i > lastPhase) onPhase(i);
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
  else draw();
}
function stopRing() {
  if (ringTimer != -1) Ollee.clearTimeout(ringTimer);
  ringTimer = -1;
}

// Idle main text: total time, then set 1's reps; blank reps when the plan is invalid.
function preview(s) {
  var p = plan(s.total, s.length, s.sets, s.pace);
  return fmtTime(s.length) + (p ? fmtReps(p.reps[0]) : '  ');
}

function draw() {
  if (!Ollee.active()) return;
  sync();
  var day = '  ', main = ' donE', colon = false, lap = false;
  if (state == IDLE) {
    var p = plan(settings.total, settings.length, settings.sets, settings.pace);
    day = settings.level ? String(settings.level) : (p ? 'S1' : 'Er');
    main = preview(settings);
    colon = true;
  } else if (state == EDIT) {
    var q = plan(settings.total, settings.length, settings.sets, settings.pace), v = settings[FIELDS[field]];
    if (field < 2) {
      day = String(v);
      main = v ? preview(rung(v)) : 'oFF';
      colon = v != 0;
    } else {
      day = q ? fmtReps(q.reps[0]) : 'Er';
      main = field == 3 ? fmtTime(settings.length) + '  ' : ('      ' + v).slice(-6);
      colon = field == 3;
    }
  } else if (state == OFFER && ringTimer == -1) {
    day = String(settings.level + 1);
    main = 'UP  ' + pad(settings.goal - settings.level - 1);
    colon = false;
  } else if (state == RUNNING && elapsed() < 0) {
    var s = Math.ceil(-elapsed() / 1000);
    day = 'GO';
    main = s >= 5 ? 'rEAdy' : String(s);
  } else if (state == RUNNING) {
    var i = phaseAt(current, elapsed()), left = Math.ceil((current.ends[i] - elapsed()) / 1000);
    colon = true;
    if (i % 2 == 0) {
      // Work counts reps up, one per pace (settings only change in idle); each change lands on a countdown second.
      var rep = Math.floor((elapsed() - (i ? current.ends[i - 1] : 0)) / (settings.pace * 1000)) + 1;
      day = 'S' + (i / 2 + 1);
      main = fmtTime(left) + fmtReps(Math.min(rep, current.reps[i / 2]));
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

// Entering idle shows the face name for 1 s; a running session goes straight to its countdown.
function enter() {
  Ollee.clear();
  displayTimer = -1;
  catchUp();
  if (state == IDLE) flash('LAddEr'); else draw();
}
// The platform cancels timers when the face leaves the screen.
function exit() { displayTimer = -1; ringTimer = -1; repeatTimer = -1; }

// Pausing freezes elapsed(); resuming moves startAt so the clock picks up where it stopped.
function pause() { paused = true; pausedAt = now(); flash('PAUSE'); }
function resume() { startAt += now() - pausedAt; paused = false; messageUntil = 0; }
function reset() { paused = false; state = IDLE; flash('rESEt'); }
// Only a running, unpaused session needs the minute tick, which reaches the face off screen.
function updateSubscriptions() {
  if (state == RUNNING && !paused) Ollee.subscribe(E_CLOCK_MINUTE);
  else Ollee.unsubscribe(E_CLOCK_MINUTE);
}
function clock_minute() { catchUp(); draw(); }

// Sets the ladder level; a rung copies its plan into the manual fields. Level 0 keeps them.
function setLevel(n) {
  settings.level = n;
  var r = rung(n);
  if (r) { settings.total = r.total; settings.length = r.length; settings.sets = r.sets; settings.pace = r.pace; }
}
// Steps the current field by its increment, wrapping to the minimum past the maximum; levels 1-9 become 10.
function bump() {
  var lim = LIMITS[field], v = settings[FIELDS[field]] + lim[2];
  if (v > lim[1]) v = lim[0];
  if (field == 0 && v > 0 && v < 10) v = 10;
  if (field == 0) setLevel(v); else settings[FIELDS[field]] = v;
}
// L in EDIT: Level, Goal, then the manual fields; Goal skips at level 0, and Goal (with a level) or Pace leaves EDIT.
function nextField() {
  var f = field + 1;
  if (field == 0 && !settings.level) f = 2;
  if (field == 1 || f == FIELDS.length) { field = 0; state = IDLE; }
  else { field = f; flash(WORDS[f]); }
}
// Stops itself if EDIT was left while A was still held.
function repeatStep() { if (state != EDIT) { stopRepeat(); return; } bump(); draw(); }
function stopRepeat() {
  if (repeatTimer != -1) Ollee.clearInterval(repeatTimer);
  repeatTimer = -1;
}
// A long press in EDIT starts hold-to-repeat; the A release stops it and adds no tap step.
function a_long() {
  longFired = 1;
  if (state == EDIT && repeatTimer == -1) repeatTimer = Ollee.setInterval(repeatStep, 100);
}
// Any press silences a ringing finish. Acts on release unless the long press fired; in DONE any button returns to IDLE.
// A press that silences an OFFER ring is hushed per button: its release only clears that bit, so the offer is not answered.
function button(b, e) {
  if (e != E_UP) {
    hush &= ~(1 << b);
    if (state == OFFER && ringTimer != -1) hush |= 1 << b;
  }
  if (ringTimer != -1) stopRing();
  if (e != E_UP) return;
  if (hush & (1 << b)) { hush &= ~(1 << b); if (b == B_A) longFired = 0; draw(); return; }
  if (b == B_A) stopRepeat();
  // longFired is only set by A, so an L release while A is held is not swallowed.
  var longPress = b == B_A && longFired;
  // A press ends any word on screen, the intro included, so its own screen shows at once.
  if (!longPress) messageUntil = 0;
  if (!longPress) {
    if (state == DONE) state = IDLE;
    else if (state == IDLE && b == B_A) start();
    else if (state == IDLE && b == B_L) { state = EDIT; field = 0; flash(WORDS[0]); }
    else if (state == EDIT && b == B_A) bump();
    else if (state == EDIT && b == B_L) nextField();
    else if (state == RUNNING && b == B_A) { if (paused) resume(); else pause(); }
    else if (state == RUNNING && paused && b == B_L) reset();
    else if (state == OFFER && b == B_A) {
      setLevel(settings.level + 1);
      state = IDLE;
      if (settings.level == settings.goal) flash('GOAL', 3000);
    }
    else if (state == OFFER && b == B_L) state = IDLE;
  }
  if (b == B_A) longFired = 0;
  updateSubscriptions();
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
  var prev = 0, workSecs = 0;
  for (var i = 0; i < n; i++) {
    workSecs += reps[i] * pace;
    prev += reps[i] * pace * 1000;
    ends.push(prev);
    if (i < n - 1) {
      prev = Math.round(workSecs * 1000 + (i + 1) * restMs);
      ends.push(prev);
    }
  }
  return { reps: reps, ends: ends };
}
// Set-drop levels; each phase trims LEn 15 s per level from 10:00 (5 sets continue on from level 50).
var PHASES = [50, 60, 70, 80];
// 10-50: Count = level x 2. Above 50: Count 100, one set fewer per phase. 99: one set of 100.
function rung(level) {
  if (level < 10 || level > 99) return null;
  if (level <= 50) return { total: 2 * level, length: 600, sets: 5, pace: 3 };
  if (level === 99) return { total: 100, length: 300, sets: 1, pace: 3 };
  var k = 0;
  for (var i = 0; i < PHASES.length; i++) if (PHASES[i] <= level) k = i;
  return { total: 100, length: 600 - 15 * (level - PHASES[k]), sets: 5 - k, pace: 3 };
}

// Index of the phase running at ms (first end after ms); ends.length once the session is over.
function phaseAt(p, ms) {
  for (var i = 0; i < p.ends.length; i++) if (p.ends[i] > ms) return i;
  return p.ends.length;
}
