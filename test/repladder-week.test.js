const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { localize } = require('../build');
const { loadSource } = require('../tools/harness');
const { loadClassic } = require('./repladder-helpers');

const LIST = [{ name: 'PUSH ' }, { name: 'PULL ' }, { name: 'SQUATS' }];
const WEEK = ['PUSH', 'PULL', 'SQUATS', 'rESt', 'PUSH', 'PULL', 'SQUATS'];
const DAY = 864e5;

// Fresh face with the weekly plan, booted on the harness's Sunday (week[6] = SQUATS) and past the intro.
function loadWeek() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'repladder.js'), 'utf8');
  const w = loadSource(localize(src, 'repladder', { profiles: LIST, week: WEEK }));
  w.advance(1000);
  w.at = (ms) => w.advance(w.ctx.startAt + ms - w.ctx.now());
  return w;
}

// Moves the clock to weekday n with the face off screen, then back on, which runs enter().
function toDay(w, n) {
  w.setActive(false);
  while (w.ctx.weekday() != n) w.advance(DAY);
  w.setActive(true);
}

// Advances to the next midnight, less `before` ms.
function toMidnight(w, before) {
  w.advance(DAY - (w.ctx.now() % DAY) - before);
}

test('weekday counts Monday as 0 from the harness clock', () => {
  const w = loadWeek();
  assert.equal(w.ctx.weekday(), 6);
  w.advance(DAY);
  assert.equal(w.ctx.weekday(), 0);
});

test('opening on Tuesday and Wednesday flashes that slot, then shows its session', () => {
  const w = loadWeek();
  toDay(w, 1);
  assert.equal(w.main(), ' PULL ');
  w.advance(1000);
  assert.equal(w.ctx.state, 0);
  assert.equal(w.main(), w.ctx.preview(w.ctx.session));
  toDay(w, 2);
  assert.equal(w.main(), 'SQUATS');
  w.advance(1000);
  assert.equal(w.ctx.settings.profile, 2);
});

test('a rest day shows rESt and tapping A does not start', () => {
  const w = loadWeek();
  toDay(w, 3);
  assert.equal(w.day(), '  ');
  assert.equal(w.main(), '  rESt');
  assert.equal(w.colon, false);
  w.tap('A');
  assert.equal(w.ctx.state, 0);
});

test('holding A on a rest day leaves rest, then tapping A starts', () => {
  const w = loadWeek();
  toDay(w, 3);
  w.hold('A', 1000);
  assert.equal(w.main(), 'SQUATS');
  assert.equal(w.ctx.state, 0);
  w.advance(1000);
  w.tap('A');
  assert.equal(w.ctx.state, 1);
});

test('a manual override on Monday sticks for the day and the next day follows the plan', () => {
  const w = loadWeek();
  toDay(w, 0);
  w.advance(1000);
  w.hold('A', 1000);
  assert.equal(w.ctx.settings.profile, 1);
  w.advance(1000);
  w.setActive(false);
  w.setActive(true);
  assert.equal(w.ctx.settings.profile, 1);
  assert.equal(w.main(), ' PULL ');
  toDay(w, 2);
  assert.equal(w.ctx.settings.profile, 2);
});

test('rest on Thursday persists across leaving and re-entering the same day', () => {
  const w = loadWeek();
  toDay(w, 3);
  w.setActive(false);
  w.setActive(true);
  assert.equal(w.main(), '  rESt');
  assert.equal(w.ctx.rest, 1);
});

test('an hour tick after midnight moves an idle, on-screen face to the new slot', () => {
  const w = loadWeek();
  toDay(w, 0);
  w.advance(1000);
  assert.equal(w.ctx.settings.profile, 0);
  toMidnight(w, 0);
  w.hour();
  assert.equal(w.ctx.settings.profile, 1);
  assert.equal(w.main(), w.ctx.preview(w.ctx.session));
});

test('an hour tick does not disturb a running session across midnight', () => {
  const w = loadWeek();
  toDay(w, 0);
  w.advance(1000);
  toMidnight(w, 60000);
  w.tap('A');
  assert.equal(w.ctx.state, 1);
  w.advance(60000);
  w.hour();
  assert.equal(w.ctx.state, 1);
  assert.equal(w.ctx.settings.profile, 0);
});

test('week editor: hold L opens Mo, release does not enter EDIT, A steps slots, L steps days', () => {
  const w = loadWeek();
  toDay(w, 0);
  w.advance(1000);
  w.hold('L', 1500);
  assert.equal(w.day(), 'Mo');
  assert.equal(w.main(), ' PUSH ');
  assert.equal(w.ctx.state, 5);
  w.tap('A');
  assert.equal(w.main(), ' PULL ');
  w.tap('A');
  assert.equal(w.main(), 'SQUATS');
  w.tap('A');
  assert.equal(w.main(), '  rESt');
  w.tap('A');
  assert.equal(w.main(), ' PUSH ');
  w.tap('L');
  assert.equal(w.day(), 'Tu');
  for (let i = 0; i < 6; i++) w.tap('L');
  assert.equal(w.ctx.state, 0);
});

test('editing today in the week editor takes effect on leaving it', () => {
  const w = loadWeek();
  toDay(w, 0);
  w.advance(1000);
  w.hold('L', 1500);
  w.tap('A');
  w.tap('A');
  w.tap('A');
  for (let i = 0; i < 7; i++) w.tap('L');
  assert.equal(w.ctx.state, 0);
  assert.equal(w.main(), '  rESt');
});

test('with no plan, A starts, A holds step the slot, and L holds build a week from it', () => {
  const w = loadClassic();
  w.advance(1000);
  assert.equal(w.ctx.week, null);
  w.tap('A');
  assert.equal(w.ctx.state, 1);

  const v = loadClassic();
  v.advance(1000);
  v.hold('A', 1000);
  assert.equal(v.ctx.settings.profile, 1);
  assert.equal(v.main(), '  PULL');
  v.advance(1000);
  v.hold('L', 1500);
  assert.equal(v.ctx.state, 5);
  assert.deepEqual([...v.ctx.week], [1, 1, 1, 1, 1, 1, 1]);
  for (let i = 0; i < 7; i++) v.tap('L');
  assert.equal(v.ctx.state, 0);
  assert.equal(v.ctx.settings.profile, 1);
  assert.equal(v.main(), v.ctx.preview(v.ctx.session));
});

test('a long L in EDIT does not open the week editor', () => {
  const w = loadClassic();
  w.advance(1000);
  w.tap('L');
  assert.equal(w.ctx.state, 3);
  assert.equal(w.ctx.field, 0);
  w.hold('L', 1500);
  assert.equal(w.ctx.state, 3);
  assert.equal(w.ctx.field, 1);
});

test('tap L on a rest day enters EDIT, and leaving EDIT shows the slot, not rest', () => {
  const w = loadWeek();
  toDay(w, 3);
  w.tap('L');
  assert.equal(w.ctx.state, 3);
  assert.equal(w.ctx.rest, 0);
  for (let i = 0; i < 10 && w.ctx.state != 0; i++) w.tap('L');
  assert.equal(w.ctx.state, 0);
  assert.equal(w.main(), w.ctx.preview(w.ctx.session));
});
