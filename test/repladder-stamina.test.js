const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadClassic, manual } = require('./repladder-helpers');

const PACE2 = { name: 'X', hold: 0, sets: 5, top: 100, pace: 2, base: 600, level: 1 };

test('decay', () => {
  const ctx = loadClassic().ctx;
  assert.equal(ctx.decay(0), 1);
  assert.ok(Math.abs(ctx.decay(1 / 3) - 0.7178) < 0.0001);
  assert.ok(ctx.decay(100) >= 0);
});

test('score', () => {
  const ctx = loadClassic().ctx;
  assert.equal(ctx.score(100, 300, 1, 3), 100);
  assert.ok(Math.abs(ctx.score(100, 600, 5, 3) - 33.70) < 0.01);
  assert.ok(Math.abs(ctx.score(100, 600, 4, 3) - 35.76) < 0.01);
  assert.equal(ctx.score(1, 600, 5, 3), Infinity);
});

test('no rung is easier than the last, across slots', () => {
  const ctx = loadClassic().ctx;
  for (const hold of [0, 1]) for (let sets = 1; sets <= 9; sets++) for (const top of hold ? [60, 300, 1200] : [30, 50, 100, 300]) {
    for (const pace of hold ? [1] : [1, 2, 3, 10]) for (const base of [120, 600, 1800]) {
      const p = { hold, sets, top, pace, base };
      if (top < (hold ? 10 * sets : sets * (sets + 1) / 2)) continue;
      const id = JSON.stringify(p);
      let prev = 0, n = 0;
      // One eachRung walk: rungAt per level is quadratic and takes minutes on a Pi.
      ctx.eachRung(p, (total, length, s) => {
        const v = ctx.score(total, length, s, hold ? 1 : pace, hold);
        n++;
        assert.ok(v < Infinity, `${id} level ${n} plans`);
        assert.ok(v >= prev - 1e-9, `${id} level ${n}: ${v} < ${prev}`);
        prev = v;
        return false;
      });
      assert.ok(n >= 1, id);
    }
  }
});

test('over-target rungs score under the top and sit at the rest floor', () => {
  const ctx = loadClassic().ctx;
  for (let n = 164; n <= 171; n++) {
    const r = ctx.rungAt(PACE2, n);
    assert.equal(r.sets, 2);
    assert.ok(r.total > 100);
    assert.equal(r.length, r.total * 2 + 30);
    assert.ok(ctx.score(r.total, r.length, 2, 2, 0) < 100);
  }
});

test('over target stays on the LCD at the biggest top', () => {
  const ctx = loadClassic().ctx;
  for (const p of [{ hold: 0, sets: 2, top: 900, pace: 6, base: 600 }, { hold: 1, sets: 2, top: 5000, pace: 3, base: 600 }]) {
    const max = ctx.maxLevel(p);
    for (let n = max - 30; n <= max; n++) {
      const r = ctx.rungAt(p, n);
      assert.ok(r.length <= 5985, `length ${r.length}`);
      assert.ok(p.hold || r.total <= 999, `total ${r.total}`);
    }
    assert.deepEqual([ctx.rungAt(p, max).sets, ctx.rungAt(p, max).total], [1, p.top]);
  }
});

test('a manual session no ladder can plan still loads', () => {
  const w = loadClassic();
  manual(w, { top: 1, base: 600, sets: 5, pace: 3 });
  assert.ok(w.ctx.maxLevel(w.ctx.cur()) >= 1);
});

test('an over-target session runs to the offer', () => {
  const w = loadClassic();
  w.advance(1000);
  w.ctx.setLevel(144);
  w.ctx.draw();
  assert.equal(w.ctx.session.total, 102);
  w.tap('A');
  w.advance(5000 + w.ctx.session.length * 1000 + 1000);
  assert.equal(w.ctx.state, w.ctx.OFFER);
});
