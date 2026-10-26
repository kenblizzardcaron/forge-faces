// fastzone: an intermittent-fasting timer that counts down to a whole-hour goal and through five fasting zones.
// Upload fastzone.min.js, the built copy of this file.
const subscribe = E_BUTTONS + E_A_LONG + E_L_LONG;
var settings = { goal: 16, beep: 1 };
var HOUR = 3600000, MIN = 60000, DAY = 86400000;
var ZONE_HOURS = [4, 12, 16, 24];
var ZONE_WORDS = ['   FEd', ' CAtAb', '   FAt', '  HEtO', '  AUtO'];

function now() { return new Date().getTime(); }
function pad(n) { return ('0' + n).slice(-2); }

// Baked settings outside their range fall back to stock, so a typo in local.json cannot blank the face.
function init() {
  var g = settings.goal;
  if (!(typeof g == 'number' && g % 1 === 0 && g >= 12 && g <= 48)) settings.goal = 16;
  if (settings.beep !== 0 && settings.beep !== 1) settings.beep = 1;
}

// Zone 1 to 5 for ms fasted; a boundary hour belongs to the higher zone.
function zoneOf(ms) {
  var z = 1;
  for (var i = 0; i < ZONE_HOURS.length; i++) if (ms >= ZONE_HOURS[i] * HOUR) z = i + 2;
  return z;
}
// HHMMSS from ms, flooring to whole seconds; past 99:59:59 it holds at 995959.
function hms(ms) {
  var s = Math.floor(ms / 1000);
  if (s > 359999) return '995959';
  return pad(Math.floor(s / 3600)) + pad(Math.floor(s % 3600 / 60)) + pad(s % 60);
}
// HHMM plus two spaces, for the main digits beside a day; capped at 9959 like hms.
function hm(ms) {
  var m = Math.floor(ms / MIN);
  if (m > 5999) return '9959  ';
  return pad(Math.floor(m / 60)) + pad(m % 60) + '  ';
}
// "168   " for a 16 h goal: the fast and its eating window, 6 cells; past 23 h just the hours.
function goalMain(g) {
  return g < 24 ? (pad(g) + (24 - g) + '      ').slice(0, 6) : pad(g) + '    ';
}

var fastStart = 0, lastEnd = 0, history = [], streak = 0, longest = 0, rung = 0;

// A new fast starts at rung 0; rung becomes 1 once its goal beep has fired or been skipped.
function startFast(at) { fastStart = at; rung = 0; }
// Judged by the goal in effect at the end, so a goal change applies to the fast in progress.
function endFast(at) {
  var hit = at - fastStart >= settings.goal * HOUR;
  history.unshift({ s: fastStart, e: at, hit: hit });
  if (history.length > 30) history.length = 30;
  streak = hit ? streak + 1 : 0;
  longest = Math.max(longest, at - fastStart);
  lastEnd = at;
  fastStart = 0;
}
// Counts days, so two hits on one day show once in the week row.
function weekHits(t) {
  var today = Math.floor(t / DAY), seen = {}, n = 0;
  for (var i = 0; i < history.length; i++) {
    var d = Math.floor(history[i].e / DAY);
    if (history[i].hit && d >= today - 6 && d <= today && !seen[d]) { seen[d] = true; n++; }
  }
  return n;
}
// Mean length of the fasts that ended in the last 7 days; 0 when there are none.
function avgMs(t) {
  var sum = 0, n = 0;
  for (var i = 0; i < history.length; i++) {
    if (history[i].e > t - 7 * DAY) { sum += history[i].e - history[i].s; n++; }
  }
  return n ? sum / n : 0;
}

// Screens: TIMER is the live countdown; the others arrive with their tasks.
var TIMER = 0, PICK = 1, STATS = 2, SET = 3, mode = TIMER;
var message = '', messageUntil = 0, tickTimer = -1;
// longFired is a bitmask by button id; lastPress restarts the picker's 10 s idle timer.
var longFired = 0, lastPress = 0;
// ringTimer runs the goal beep; hush is the buttons whose press silenced it, cleared on their release.
var ringTimer = -1, ringLeft = 0, hush = 0;
// pickStart 1 starts a fast, 0 ends one; pickBack is the backdate in minutes.
var pickStart = 1, pickBack = 0;

function flashing() { return now() < messageUntil; }
function flash(word, ms) { message = word; messageUntil = now() + (ms || 1000); draw(); }

// The picker's max: up to 6 h, in 15 min steps, and no further back than the last fast ended.
function pickMax() {
  var t = now(), limit = 360;
  if (pickStart && lastEnd) limit = (t - lastEnd) / MIN;
  else if (!pickStart) limit = (t - fastStart) / MIN;
  return Math.min(360, Math.floor(limit / 15) * 15);
}

// 500 ms beeps: 40 on screen, 10 off, so an unattended face goes quiet soon after the goal.
function startRing(onScreen) {
  ringLeft = onScreen ? 40 : 10;
  ringTimer = Ollee.setInterval(ringStep, 500);
  ringStep();
}
function ringStep() {
  Ollee.beep();
  if (--ringLeft <= 0) stopRing();
}
function stopRing() {
  if (ringTimer != -1) Ollee.clearInterval(ringTimer);
  ringTimer = -1;
}
// Rings once per fast when the goal passes; rung stops the minute tick from ringing it again.
function checkGoal() {
  if (fastStart && !rung && now() - fastStart >= settings.goal * HOUR) {
    rung = 1;
    if (settings.beep) startRing(Ollee.active());
    updateSubscriptions();
  }
}
// The minute tick is only needed while a goal is still to ring; on screen the 1 s tick covers it.
function updateSubscriptions() {
  if (fastStart && !rung && settings.beep) Ollee.subscribe(E_CLOCK_MINUTE);
  else Ollee.unsubscribe(E_CLOCK_MINUTE);
}
function clock_minute() { checkGoal(); }

// Redraws every second on screen; a flash ends on the first tick after its time.
// A picker left idle for 10 s cancels back to the timer.
function tick() {
  checkGoal();
  if (mode != TIMER && now() - lastPress >= 10000) mode = TIMER;
  draw();
}

// The screen for the current mode, recomputed from the clock on every draw.
function draw() {
  if (!Ollee.active()) return;
  var t = now(), main = ' rEAdY', day = '  ', colon = false, lap = false;
  if (mode == TIMER) {
    if (fastStart) {
      var e = t - fastStart, goalMs = settings.goal * HOUR;
      day = ' ' + zoneOf(e);
      colon = true;
      if (e < goalMs) { main = hms(goalMs - e); lap = true; }
      else { main = hms(e - goalMs); lap = Math.floor(e / 1000) % 2 == 0; }
    } else if (lastEnd) {
      if (settings.goal < 24) {
        var left = lastEnd + (24 - settings.goal) * HOUR - t;
        if (left > 0) { main = hms(left); colon = true; }
      } else {
        main = hms(t - lastEnd);
        colon = true;
      }
    }
  }
  if (mode == PICK) {
    main = '-' + Math.floor(pickBack / 60) + pad(pickBack % 60) + '  ';
    day = pickStart ? ' S' : ' E';
    colon = true;
  }
  if (flashing()) { main = message; colon = false; }
  Ollee.drawMain(main);
  Ollee.drawDay(day);
  Ollee.drawColon(colon);
  Ollee.drawLap(lap);
}

// Starts the 1 s tick; a fast in progress greets with its zone word, else the screen draws at once.
function enter() {
  Ollee.clear();
  checkGoal();
  tickTimer = Ollee.setInterval(tick, 1000);
  if (fastStart) flash(ZONE_WORDS[zoneOf(now() - fastStart) - 1], 1500);
  else draw();
}
// The platform cancels timers when the face leaves the screen, and a picker does not survive that.
function exit() { tickTimer = -1; ringTimer = -1; mode = TIMER; }
// Acts on release, as repladder does; a long press sets its bit so its release does nothing.
// A press during a ring only silences it, and its release and long hook then do nothing.
function button(b, e) {
  lastPress = now();
  if (e != E_UP) {
    if (ringTimer != -1) { stopRing(); hush |= 1 << b; }
    return;
  }
  if (hush & (1 << b)) { hush &= ~(1 << b); return; }
  if (longFired & (1 << b)) { longFired &= ~(1 << b); return; }
  if (b == B_A && mode == TIMER) {
    if (fastStart) flash(ZONE_WORDS[zoneOf(now() - fastStart) - 1], 1500);
    else startFast(now());
  } else if (b == B_A && mode == PICK) {
    pickBack += 15;
    if (pickBack > pickMax()) pickBack = 0;
  } else if (b == B_L && mode == PICK) {
    if (pickStart) startFast(now() - pickBack * MIN);
    else endFast(now() - pickBack * MIN);
    mode = TIMER;
  }
  updateSubscriptions();
  draw();
}
// Holding A opens the backdate picker: a start when not fasting, an end when fasting.
function a_long() {
  if (hush & (1 << B_A)) return;
  longFired |= 1 << B_A;
  lastPress = now();
  if (mode != TIMER) return;
  mode = PICK;
  pickStart = fastStart ? 0 : 1;
  pickBack = 0;
  draw();
}
function l_long() {
  if (hush & (1 << B_L)) return;
  longFired |= 1 << B_L;
  lastPress = now();
}
