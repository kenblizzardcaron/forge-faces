# Rep Ladder lead-in summary — plan

Spec: approved in chat on 2026-10-24 (no spec file). During the 5 s lead-in the countdown moves to
the day digits and the main digits spell out the session, one item per second; beeps unchanged.
Delegation: Task 1 is a haiku implementer; gate is `node --test` (fail 0). Docs (`repladder.md`) are controller text-out.

## Global Constraints

- Main digits are 6 characters, day digits 2; day position 2 (first char) shows only 1–3, so day is `' ' + s`.
- On a level: `LEU 45`, `rEP 90`, `1000  ` (colon on), `SEtS 5`, `    GO`; day ` 5` … ` 1`.
- Level 0: `rEP100`, `1000  ` (colon on), `SEtS 5`, `PACE 3`, `    GO`.
- Beeps, lead-in length, pause/resume behaviour unchanged. Block comments ≤ 3 lines.

### Task 1: Lead-in summary frames in repladder.js and tests

**Files:** `repladder.js` (draw() lead-in branch, new `pad3` helper next to `pad`),
`test/repladder-run.test.js`, `test/repladder-pause.test.js`.

Replace in draw():

```
  } else if (state == RUNNING && elapsed() < 0) {
    var s = Math.ceil(-elapsed() / 1000);
    day = 'GO';
    main = s >= 5 ? 'rEAdy' : String(s);
```
with:
```
  } else if (state == RUNNING && elapsed() < 0) {
    // Countdown on the day digits; the main digits spell out the session, one item per second, then GO.
    var s = Math.ceil(-elapsed() / 1000), lv = settings.level;
    var items = [lv ? 'LEU' + pad3(lv) : 'rEP' + pad3(settings.total), lv ? 'rEP' + pad3(settings.total) : fmtTime(settings.length) + '  ',
      lv ? fmtTime(settings.length) + '  ' : 'SEtS ' + settings.sets, lv ? 'SEtS ' + settings.sets : 'PACE' + ('  ' + settings.pace).slice(-2), 'GO'];
    var k = Math.max(0, Math.min(4, 5 - s));
    day = ' ' + Math.min(s, 5);
    main = items[k];
    colon = (k == 2 && lv) || (k == 1 && !lv);
```
and add `function pad3(n) { return ('  ' + n).slice(-3); }` beside `pad`.

Tests:
- run 'intro': default face (level 25) after tap A shows `LEU 25`.
- run 'lead-in' (fresh(): level 0, total 100, length 600, sets 5, pace 3): all five frames with day and colon.
- new run 'lead-in on a level': setLevel(45), tap A → `LEU 45`, `rEP 90`, `1000  ` colon on, `SEtS 5`, `    GO`.
- pause 'pause in lead-in': frame after PAUSE flash is `SEtS 5`, day ` 3`.

Gate: `node --test` reports fail 0.
