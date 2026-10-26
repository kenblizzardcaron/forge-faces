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

function enter() { Ollee.clear(); }
function exit() {}
function button() {}
function a_long() {}
function l_long() {}
