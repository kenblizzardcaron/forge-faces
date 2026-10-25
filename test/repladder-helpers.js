// Puts the face on a manual session: the active profile's fields at level 0, then loads and draws.
function manual(w, { top, base, sets, pace, hold = 0 }) {
  Object.assign(w.ctx.cur(), { top, base, sets, pace, hold, level: 0 });
  w.ctx.load();
  w.ctx.draw();
}

module.exports = { manual };
