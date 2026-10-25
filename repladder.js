// Rep Ladder: a set-by-set rep ladder timer with a work/rest session plan.
// Upload repladder.min.js, the built copy of this file.
const subscribe = E_BUTTONS + E_A_LONG;
var settings = { profile: 0 };
var profiles = [{ name: 'SLOt 1', hold: 0, sets: 5, top: 50, pace: 3, base: 600, level: 1 }, { name: 'SLOt 2', hold: 0, sets: 5, top: 50, pace: 3, base: 600, level: 1 }, { name: 'SLOt 3', hold: 0, sets: 5, top: 50, pace: 3, base: 600, level: 1 }, { name: 'SLOt 4', hold: 0, sets: 5, top: 50, pace: 3, base: 600, level: 1 }, { name: 'SLOt 5', hold: 0, sets: 5, top: 50, pace: 3, base: 600, level: 1 }];
// The session the face runs and draws; load() derives it from the active profile.
var session = null;

var IDLE = 0, RUNNING = 1, DONE = 2, EDIT = 3, OFFER = 4;
var state = IDLE, startAt = 0, paused = false, pausedAt = 0, current = null, lastPhase = -1, message = '', messageUntil = 0;
var displayTimer = -1, longFired = 0, hush = 0;
// Edit: L cycles fields; A steps the current one, and holding A repeats every 100 ms on its own slot.
// PROFILE and TYPE flash no word; TYPE shows reps or a hold. Top's range comes from topRange().
var FIELDS = ['profile', 'hold', 'top', 'level', 'sets', 'pace', 'base'];
var WORDS = { level: 'LEUEL', sets: 'SEtS', pace: 'PACE ', base: 'LEn' };
var LIMITS = { sets: [1, 9, 1], pace: [1, 20, 1], base: [15, 5985, 15] };
var field = 0, repeatTimer = -1;
// Finish ring: stock triple, 125 ms steps, beeping on steps 0-2 of each 8; own timer slot.
var RING_STEP_MS = 125, ringTimer = -1, ringStepNo = 0, ringSteps = 0, cue = 6;

function now() { return new Date().getTime(); }
function pad(n) { return ('0' + n).slice(-2); }
function pad3(n) { return ('  ' + n).slice(-3); }
// m:ss from seconds, with m padded to two chars; reps over 99 blank out.
function fmtTime(secs) { var m = Math.floor(secs / 60); return (m < 10 ? ' ' : '') + m + pad(secs % 60); }
function fmtReps(r) { return r > 99 ? '  ' : pad(r); }
// "91 rEP", "5 SEtS": number first, so main cells 0 and 2 (whose top and bottom bars share a driver)
// hold digits, which light both bars anyway; a letter there would gain or lose a bar.
function tag(n, word) { var s = n + ' ' + word; return ('      ' + (s.length > 6 ? n + word : s)).slice(-6); }
function elapsed() { return (paused ? pausedAt : now()) - startAt; }
function flashing() { return now() < messageUntil; }
function flash(word, ms) { message = word; messageUntil = now() + (ms || 1000); draw(); }
// ms until ceil(msLeft / 1000) changes; always in (0, 1000].
function secondStep(msLeft) { return msLeft - 1000 * (Math.ceil(msLeft / 1000) - 1); }
function earliest(d, x) { return d && d < x ? d : x; }

// The active profile, picked by settings.profile.
function cur() { return profiles[settings.profile]; }

// One beep per work/rest change; the last phase end rings the finish and sets OFFER below the max level, else DONE.
function onPhase(i) {
  lastPhase = i;
  if (i == current.ends.length) {
    state = cur().level > 0 && cur().level < maxLevel(cur()) ? OFFER : DONE;
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
  var p = plan(s.total, s.length, s.sets, s.pace, s.hold);
  return fmtTime(s.length) + (p ? fmtReps(p.reps[0]) : '  ');
}

function draw() {
  if (!Ollee.active()) return;
  sync();
  var day = '  ', main = ' donE ', colon = false, lap = false;
  if (state == IDLE) {
    var p = plan(session.total, session.length, session.sets, session.pace, session.hold);
    day = p ? 'S1' : 'Er';
    main = preview(session);
    colon = true;
  } else if (state == EDIT) {
    var q = plan(session.total, session.length, session.sets, session.pace, session.hold), key = FIELDS[field], v = cur()[key];
    if (key == 'profile') {
      // The day shows the profile's slot, 1-based.
      day = ' ' + (settings.profile + 1);
      main = ('      ' + cur().name).slice(-6);
    } else if (key == 'hold') {
      day = '  ';
      main = cur().hold ? '  HOLd' : '  rEPS';
    } else if (key == 'level') {
      // A level previews its sets and total reps; level 0 is off.
      var r = v ? rungAt(cur(), v) : null;
      day = r ? ' ' + r.sets : '  ';
      main = r ? pad3(v) + pad3(r.total) : '   oFF';
    } else {
      // Seconds show as m:ss on holds' top and on LEn; reps as numbers.
      var timed = key == 'base' || (key == 'top' && cur().hold);
      day = q ? fmtReps(q.reps[0]) : 'Er';
      // On a level, top's day is ' 1'.
      if (key == 'top' && cur().level) day = ' 1';
      main = timed ? fmtTime(v) + '  ' : ('      ' + v).slice(-6);
      colon = timed;
    }
  } else if (state == OFFER && ringTimer == -1) {
    day = '  ';
    main = tag(cur().level + 1, 'UP');
    colon = false;
  } else if (state == RUNNING && elapsed() < 0) {
    // Countdown on the day digits; the main digits spell out the session, one item per second, then GO with set 1's reps.
    var s = Math.ceil(-elapsed() / 1000), lv = cur().level;
    var items = [session.hold ? '  HOLd' : tag(session.total, 'rEP'), fmtTime(session.length) + '  ', tag(session.sets, 'SEtS'),
      lv ? tag(lv, 'LEU') : session.hold ? '   oFF' : tag(session.pace, 'SEC'), 'GO' + ('    ' + current.reps[0]).slice(-4)];
    var k = Math.max(0, Math.min(4, 5 - s));
    day = ' ' + Math.min(s, 5);
    main = items[k];
    colon = k == 1;
  } else if (state == RUNNING) {
    var i = phaseAt(current, elapsed()), left = Math.ceil((current.ends[i] - elapsed()) / 1000);
    colon = true;
    if (i % 2 == 0) {
      // Work counts reps up, one per pace; holds show only the countdown. Changes land on a countdown second.
      var rep = Math.floor((elapsed() - (i ? current.ends[i - 1] : 0)) / (session.pace * 1000)) + 1;
      day = 'S' + (i / 2 + 1);
      main = fmtTime(left) + (session.hold ? '  ' : fmtReps(Math.min(rep, current.reps[i / 2])));
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
  var p = plan(session.total, session.length, session.sets, session.pace, session.hold);
  if (!p) { flash('Error'); return; }
  current = p; state = RUNNING; startAt = now() + 5000; paused = false; lastPhase = -1; cue = 6;
}

// Entering idle shows the face name for 1 s; a running session goes straight to its countdown.
function enter() {
  Ollee.clear();
  displayTimer = -1;
  catchUp();
  if (state == IDLE) flash(('      ' + cur().name).slice(-6)); else draw();
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

// Sets the active profile's level and derives the session from it.
function setLevel(n) { cur().level = n; load(); }
// Top's [min, max, step]: holds step 5 s, reps 1. A level starts at its first rung; level 0 at 1 (5 s for holds).
function topRange(p) {
  var hold = p.hold;
  var min = p.level ? (hold ? 10 * p.sets : p.sets * (p.sets + 1) / 2) : (hold ? 5 : 1);
  return [min, hold ? 5985 : Math.min(999, Math.floor(5985 / p.pace)), hold ? 5 : 1];
}
// Steps the current field on the active profile, wrapping to its minimum; then clamps top and reloads.
// TYPE toggles reps and holds; a hold rounds top up to 5 s.
function bump() {
  var p = cur(), key = FIELDS[field], lim = null;
  if (key == 'profile') settings.profile = (settings.profile + 1) % profiles.length;
  else {
    if (key == 'hold') {
      p.hold = 1 - p.hold;
      if (p.hold) p.top = Math.ceil(p.top / 5) * 5;
    } else if (key == 'level') p.level = p.level < maxLevel(p) ? p.level + 1 : 0;
    else {
      lim = key == 'top' ? topRange(p) : LIMITS[key];
      var v = p[key] + lim[2];
      p[key] = v > lim[1] ? lim[0] : v;
    }
    var t = topRange(p);
    p.top = Math.min(t[1], Math.max(t[0], p.top));
    // On a level, a bump that makes the ladder too long to fit in 999 levels wraps back to its minimum.
    if (lim && p.level > 0 && maxLevel(p) > 999) p[key] = lim[0];
  }
  load();
}
// The word flashed on entering a field: LASt on a level, Count at level 0; none for PROFILE and TYPE.
// "LASt " keeps the L off main cell 2, whose top and bottom bars share a driver (an L there reads as C).
function wordFor(key) { return key == 'top' ? (cur().level ? 'LASt ' : 'Count') : WORDS[key] || ''; }
// L in EDIT steps PROFILE -> TYPE -> LASt -> LEUEL -> SEtS -> PACE -> LEn -> idle; hold profiles skip PACE.
function nextField() {
  var f = field + 1;
  if (FIELDS[f] == 'pace' && cur().hold) f++;
  if (f == FIELDS.length) { field = 0; state = IDLE; return; }
  field = f;
  var word = wordFor(FIELDS[f]);
  if (word) flash(word); else draw();
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
    else if (state == IDLE && b == B_L) { state = EDIT; field = 0; }
    else if (state == EDIT && b == B_A) bump();
    else if (state == EDIT && b == B_L) nextField();
    else if (state == RUNNING && b == B_A) { if (paused) resume(); else pause(); }
    else if (state == RUNNING && paused && b == B_L) reset();
    else if (state == OFFER && b == B_A) {
      setLevel(cur().level + 1);
      state = IDLE;
      if (cur().level == maxLevel(cur())) flash('GOAL', 3000);
    }
    else if (state == OFFER && b == B_L) state = IDLE;
  }
  if (b == B_A) longFired = 0;
  updateSubscriptions();
  draw();
}

// Rep split: earlier sets take the extra reps. Holds split seconds the same way (pace 1).
// Returns null if a set would have under 1 rep or work overruns length.
function plan(total, length, sets, pace, hold) {
  var n = sets;
  var base = Math.floor((total + n * (n - 1) / 2) / n);
  var extra = total - (n * base - n * (n - 1) / 2);
  var reps = [];
  for (var k = 0; k < n; k++) {
    var r = hold ? Math.floor(total / n) + (k < total % n ? 1 : 0) : base - k + (k < extra ? 1 : 0);
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
// Level n of profile p's ladder, or null outside 1..maxLevel(p).
function rungAt(p, n) {
  var c = 0, out = null;
  if (n < 1) return null;
  eachRung(p, function (total, length, sets) {
    if (++c < n) return false;
    out = { total: total, length: length, sets: sets, pace: p.hold ? 1 : p.pace, hold: p.hold };
    return true;
  });
  return out;
}
// Number of levels in profile p's ladder.
function maxLevel(p) {
  var c = 0;
  eachRung(p, function () { c++; return false; });
  return c;
}
// Calls emit(total, length, sets) per level in order until it returns true: add stretch, sets S..2 at top, last set.
function eachRung(p, emit) {
  var S = p.sets, T = p.top, P = p.hold ? 1 : p.pace, B = p.base;
  var step = p.hold ? S : Math.ceil(T / 50), t = p.hold ? 10 * S : S * (S + 1) / 2;
  for (;;) {
    t = Math.min(T, t);
    if (emit(t, Math.max(B, t * P + 15 * (S - 1)), S)) return;
    if (t == T) break;
    t += step;
  }
  for (var s = S; s > 1; s--) {
    var floor = T * P + 15 * (s - 1), L0 = Math.max(B, floor);
    if (s < S && emit(T, L0, s)) return;
    for (var len = L0 - 15; len >= floor; len -= 15) if (emit(T, len, s)) return;
  }
  emit(T, T * P, 1);
}
// Index of the phase running at ms (first end after ms); ends.length once the session is over.
function phaseAt(p, ms) {
  for (var i = 0; i < p.ends.length; i++) if (p.ends[i] > ms) return i;
  return p.ends.length;
}

// Level 0 takes the profile's manual fields; a level takes its rung. Clamps the level first.
function load() {
  var p = cur();
  if (p.level > maxLevel(p)) p.level = maxLevel(p);
  if (p.level > 0) session = rungAt(p, p.level);
  else session = { total: p.top, length: p.base, sets: p.sets, pace: p.hold ? 1 : p.pace, hold: p.hold };
}
load();
