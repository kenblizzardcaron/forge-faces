const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadFace, loadSource } = require('../tools/harness');

const E_CLOCK_MINUTE = 1 << 8;

test('draws right-aligned', () => {
  const w = loadSource('function enter() { Ollee.drawMain(42); Ollee.drawDay(\'S1x\'); Ollee.drawColon(1); }');
  assert.equal(w.main(), '    42');
  assert.equal(w.day(), 'S1');
  assert.equal(w.colon, true);
});

test('fires timers in order', () => {
  const w = loadSource(`
    function enter() {
      Ollee.setTimeout(function () { events.push(['t', new Date().getTime()]); }, 300);
      Ollee.setInterval(function () { events.push(['i', new Date().getTime()]); }, 100);
    }
    var events = [];
  `);
  const start = w.ctx.Date.now();
  w.advance(350);
  const times = Array.from(w.ctx.events, (e) => e[1] - start);
  assert.deepEqual(times, [100, 200, 300, 300]);
  assert.equal(w.ctx.events.filter((e) => e[0] === 'i').length, 3);
  assert.equal(w.ctx.events.filter((e) => e[0] === 't').length, 1);
});

test('four timer slots', () => {
  const w = loadSource(`
    function enter() {
      var ids = [];
      for (var i = 0; i < 5; i++) ids.push(Ollee.setTimeout(function () {}, 1000));
      window_ids = ids;
    }
    var window_ids = [];
  `);
  const ids = w.ctx.window_ids;
  assert.equal(ids.length, 5);
  assert.equal(ids[4], -1);
  assert.ok(ids.slice(0, 4).every((id) => id >= 0));
  w.ctx.Ollee.clearTimeout(ids[0]);
  assert.notEqual(w.ctx.Ollee.setTimeout(function () {}, 1000), -1);
});

test('exit cancels timers, draws ignored when inactive', () => {
  const w = loadSource(`
    var fired = [];
    function enter() {
      Ollee.drawMain(7);
      Ollee.setTimeout(function () { fired.push('pending'); }, 500);
    }
  `);
  assert.equal(w.main(), '     7');
  w.setActive(false);
  w.ctx.Ollee.drawMain(9);
  assert.equal(w.main(), '     7');
  w.advance(1000);
  assert.deepEqual(Array.from(w.ctx.fired), []);
  let late = 0;
  const id = w.ctx.Ollee.setTimeout(function () { late++; }, 200);
  assert.notEqual(id, -1);
  w.advance(200);
  assert.equal(late, 1);
});

test('button order', () => {
  const w = loadSource(`
    const subscribe = E_A_SHORT + E_BUTTONS + E_A_LONG;
    var log = [];
    function a_short() { log.push('a_short'); }
    function a_long() { log.push('a_long'); }
    function button(b, e) { log.push('button(' + b + ',' + e + ')'); }
  `);
  w.tap('A');
  assert.deepEqual(Array.from(w.ctx.log), ['a_short', 'button(0,0)', 'button(0,1)']);
  w.ctx.log.length = 0;
  w.hold('A', 1200);
  assert.deepEqual(Array.from(w.ctx.log), ['a_short', 'button(0,0)', 'a_long', 'button(0,1)']);
});

test('button hold L does not fire unsubscribed or early long hook', () => {
  const w = loadSource(`
    const subscribe = E_L_LONG;
    var log = [];
    function l_long() { log.push('l_long'); }
  `);
  w.hold('L', 1200);
  assert.deepEqual(Array.from(w.ctx.log), []);
  w.hold('L', 1600);
  assert.deepEqual(Array.from(w.ctx.log), ['l_long']);
});

test('minute only when subscribed', () => {
  const w = loadSource(`
    var minutes = 0;
    function init() { Ollee.subscribe(E_CLOCK_MINUTE); }
    function clock_minute() { minutes++; }
  `);
  w.minute();
  assert.equal(w.ctx.minutes, 1);
  assert.equal(w.subscribed(E_CLOCK_MINUTE), true);
  w.ctx.Ollee.unsubscribe(E_CLOCK_MINUTE);
  w.minute();
  assert.equal(w.ctx.minutes, 1);
});

test('minute ignored without subscription', () => {
  const w = loadSource('var minutes = 0; function clock_minute() { minutes++; }');
  w.minute();
  assert.equal(w.ctx.minutes, 0);
});

test('beeps recorded', () => {
  const w = loadSource('');
  w.advance(50);
  w.ctx.Ollee.beep();
  w.advance(10);
  w.ctx.Ollee.beepShort();
  assert.deepEqual(w.beeps, [
    { t: 1_000_000_000_050, kind: 'beep' },
    { t: 1_000_000_000_060, kind: 'short' },
  ]);
});

test('loads multitimer', () => {
  const w = loadFace('multitimer.js');
  assert.equal(w.main().length, 6);
});
