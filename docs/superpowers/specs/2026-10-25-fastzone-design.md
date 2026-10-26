# fastzone face — design

## Intent

A Forge face for intermittent fasting. Ken fasts daily (usually 17–18 h) and tracks it in his
head, guessing when the fast started. The watch is always on his wrist, so it should remember the
start instead, and build the routine. multitimer was first meant to cover this; after repladder,
Ken prefers specialized niche faces, and wants this one to be the "everything bagel" of IF apps:
timer, fasting zones, stats, history and streaks, using as much of the 8 KB as it takes.

Popular IF apps (Zero, Simple, Fastic, Life, BodyFast) were surveyed. Users praise a reliable basic
timer above all, and complain about paywalls and notification nagging. fastzone keeps the
features and drops the nagging: one beep at the goal, and nothing else unasked.

It ships as two parts:

1. **The face**, `fastzone.js` in this repo (forge-faces).
2. **Its page**, `/ollee/fastzone/` in kenblizzardcaron-11ty, like `/ollee/repladder/` and
   `/ollee/multitimer/`.

## Goals

- Start a fast after dinner with one press, or backdated when you remember late.
- Count down to the goal fast length; the goal is whole hours, with IF labels (16:8, 18:4, 17:7…).
- Show the fasting zone (1–5) at all times while fasting, and the zone's word on returning to the face.
- Beep once when the goal is reached. The fast keeps running until you mark it over (also backdatable).
- During eating, count down the eating window, as a suggestion only.
- Stats: goals hit this week, streak, 7-day average, longest fast, and the last 30 fasts.

## Non-goals

- No zone-change beeps, no eating-window alarm, no reminders to start fasting.
- No editing of past fasts after the fact; backdating at start and end is the only correction.
- No Bluetooth: as of October 2026 the watch firmware doesn't expose the Forge service, so no phone
  sync or history export.
- No persistence across reboots (Forge has no storage). History and streak are lost on reboot or
  re-upload; `local.json` bakes in defaults only. A reboot mid-fast silently drops to fresh start, and
  the face trusts the watch's wall clock (set by the phone); no clock-jump detection (my call).

## Anti-goals (a failure even if it works)

- An accidental press ending a fast (and with it the streak).
- A fasting screen where you can't read the time to go at a glance.
- Nagging: any beep other than the goal beep.

## Constraints

- Forge rules (upstream `AGENTS.md`): ES5, top-level hooks, 4 timer slots, no global `setTimeout`,
  `Date` has no timezone, an uncaught error disables the face.
- `fastzone.min.js` must fit in **8158 bytes**. multitimer and repladder are about 6.1 KB each.
- LCD: 6 main digits with a colon (`HH:MM SS`), 2 day digits (the first can only show 1–3), LAP / PM /
  24H lights. Words only approximate on 7 segments; check them in the emulator's Character set panel.
- Off screen, the face only wakes on the once-a-minute clock tick, so the goal beep can be up to
  59 s late when another face is showing (as multitimer documents).
- Push window: no pushes 9 AM–5 PM MT, Mon–Fri. Both repos push straight to `main` once tests pass; no PRs.

## The face

### States

- **Fasting** (LAP on): main digits count down to the goal as `HH:MM SS`; day digits show the zone
  number. Past the goal, main shows time over it, e.g. `+1:20`, and the zone keeps climbing.
- **Eating** (LAP off): main digits count down the eating window, which is `24 − goal` hours from
  the moment the fast ended. It's a suggestion: no alarm when it runs out. For goals of 24 h and up
  there is no window, so main counts up the time since the fast ended (my call).
- **Fresh start** (no fast yet since boot): treated as eating with no window to count.

### Zones (Ken's choice)

| Zone | Hours fasted | Name | Word (candidate) |
| --- | --- | --- | --- |
| 1 | 0–4 | fed | `FEd` |
| 2 | 4–12 | sugar dropping (catabolic) | `CAtAb` |
| 3 | 12–16 | fat burning | `FAt` |
| 4 | 16–24 | ketosis | `HEtO` |
| 5 | 24+ | autophagy | `AUtO` |

- The zone number is always on the day digits while fasting.
- **Every time** the face comes on screen during a fast, main shows the zone word for ~1.5 s, then the
  countdown (Ken's choice). No beeps on zone changes (Ken's choice).
- Spellings are candidates; the builder picks the most readable within the character set.

### Goal

- Whole hours, stepped one hour at a time (Ken's choice). Shown with the IF label: 16 → `16:8`,
  17 → `17:7`, 18 → `18:4`, 23 → `23:1`, 12 → `12:12`. Range 12–48 h; above 23 the label is just
  the hours (my call).
- Default 16 (my call; most common). Bakeable with `local.json`.
- **Goal beep:** when the fast reaches its goal. On screen it rings until any button, for up to 20 s;
  on another face at most 5 s, caught on the next minute tick (matches multitimer). A setting turns it off.

### Buttons

M stays the watch's. Long-press thresholds are the system's (A 1 s, L 1.5 s).

| Button | Eating | Fasting |
| --- | --- | --- |
| **A** | Start the fast now | Show the zone word again (my call) |
| Hold **A** | Start backdated | End the fast (always via the backdate picker) |
| **L** | Next stats page; after the last, back to the timer | same |
| Hold **L** | Settings: goal → beep on/off → done | same |

- **Backdate picker:** main shows `-0:00`; **A** adds 15 min back, **L** confirms. 15-min steps,
  capped at 6 h (my calls; Ken said ~10 min off doesn't matter). A start can't go before the previous
  fast's end; an end can't go before its start.
- Ending a fast always goes through the picker, so a stray press can't end it (my call, from the anti-goal).
- A on a stats page acts on that page (history paging) and never starts a fast. Stats and settings
  return to the timer after ~10 s idle (my call).
- Any button silences a ringing goal beep and does nothing else.
- **Goal changed mid-fast** (my call): the beep fires when the fast crosses the goal in effect. Raising
  the goal past the elapsed time re-arms it; lowering it below the elapsed time doesn't ring.

### Streak (Ken's rule: "a streak is a streak")

- A fast **hits** its goal when `end − start ≥ goal`, using the backdated times and the goal in effect
  when it ends. A hit adds 1 to the streak; a miss resets it to 0.

### Stats pages (Ken agreed to this set)

**L** steps through them in this order:

| Page | Main | Example |
| --- | --- | --- |
| Week | days in the last 7 (today and the 6 before) with a hit fast ending on them | `5 oF 7` |
| Streak | current streak | `Str 12` |
| Average | mean length of fasts that ended in the last 7 days | `17:42` |
| Longest | longest fast since boot (kept even after it drops out of history) | `23:10` |
| History | one fast per screen, newest first; **A** steps older; day digits = fasts ago (1–30) | `18:05`, LAP on if it hit |

- History keeps the last 30 fasts (start, end, hit), oldest dropped first.
- Each page needs a label the 6 digits can carry, or a brief word flash on entering it; the
  builder picks the spelling. Empty pages show dashes.

### Settings and `local.json`

- `var settings = { goal: 16, beep: 1 };`, with `goal` 12–48 and `beep` 0/1, overridable from
  `local.json` as `{"fastzone": {"goal": 18}}` through `face-build.js`'s existing settings path
  (a misspelled key already fails the build).
- `build.js` adds `fastzone` to `FACES`; the README gets a face row; `fastzone.md` is the guide, in the
  style of `repladder.md` and `multitimer.md`.

### If it doesn't fit in 8158 bytes (my call)

Cut in this order, last cut first: Longest → Average → history depth (30 down to 10) → zone-word
flash. The timer, backdating, zones, goal beep, streak and week are never cut.

## The page: `/ollee/fastzone/` (kenblizzardcaron-11ty)

Same shell as `/ollee/multitimer/`: layout C (watch sticky on the left on wide screens, first on a
phone), built from `src/ollee/shared/`, guide rendered from `fastzone.md` at the pinned forge-faces sha.

- **Emulator watch** running fastzone, with the existing 1×/10×/60× speed and "Skip to next change".
- **Builder:** goal hours (12–48, shown with its IF label) and goal beep on/off; the build bar downloads
  `fastzone.min.js` and `local.json`, with the same bytes `node build.js` makes.
- **Zone timeline** (my idea, Ken agreed): a bar from 0 to 24+ h with zones 1–5 and the goal marked;
  follows the dataviz rules (text summary, keyboard readout).
- **Demo history** (my idea, Ken agreed): a toggle that seeds about two weeks of made-up fasts into the
  emulated watch only, so the stats pages have something to show. Never in a download.
- `/ollee/` lists fastzone with its README one-liner; the `/ollee/` service worker precaches the page.
- `forgeFaces.js` fetches `fastzone.js` and `fastzone.md` and smoke-checks the face; a failed fetch fails
  soft, like the other faces.

## Testing

- **forge-faces:** `node --test` with `tools/harness.js` (fake clock and timers). Cover: start now and
  backdated, the backdate limits, the countdown and `+` overtime, zone boundaries 4/12/16/24, the zone
  word on `enter()`, the goal beep on and off screen and silencing it, ending only through the picker,
  hit/miss and streak reset, week/average/longest across day boundaries, the history cap, `local.json`
  settings, and the min.js size under 8158.
- **Site:** unit tests for the builder state and `local.json` round-trip; e2e for builder edits reaching
  the watch, the downloads, the demo-history toggle, and the layout at 320 px and ≥ 900 px; axe 0
  violations; reflow at 320×256.
- **Controller visual check (Opus):** both themes, phone and desktop width, plus the zone words read
  correctly on the emulator LCD.

## Related, separate job

Guide tables on `/ollee/repladder/` and `/ollee/multitimer/` render with columns ~2 characters wide on a
wide iPad. Fixed on its own before the fastzone page is built, since its guide uses the same renderer.

## Left to the builder

- Exact LCD spellings for zone words, stats labels and the backdate picker.
- How the overtime and eating-window screens lay out within 6 digits.
- Internal state shape and timer use within the 4 slots.
- How the demo history gets into the emulated watch (it must not change the face's shipped bytes).
