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

// A new fast starts at rung 0; rung counts the zone changes already announced.
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

function enter() { Ollee.clear(); }
function exit() {}
function button() {}
function a_long() {}
function l_long() {}
