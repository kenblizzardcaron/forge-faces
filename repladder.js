// Rep Ladder: a set-by-set rep ladder timer with a work/rest session plan.
// Upload repladder.min.js, the built copy of this file.
const subscribe = E_BUTTONS + E_A_LONG;
var settings = { total: 100, length: 600, sets: 5, pace: 3 };

function enter() {}
function button() {}

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
