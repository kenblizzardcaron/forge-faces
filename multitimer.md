# multitimer.js

[Source](multitimer.js) · upload [multitimer.min.js](multitimer.min.js) to the watch · [Open in emulator](https://kenblizzardcaron.github.io/forge-faces/?face=multitimer) · [All faces](README.md)

A feature-parity replacement for the official Ollee TIMER face that adds **simultaneous timers**: up to three countdowns run at once, each with the full TIMER feature set.

- **Same as the official face:** edit to 23:59:59, start / pause / clear, 10 presets, interval mode, fast mode, and the same buttons for each.
- **Added:** three independent timers (number shown on the day digits), switched with **A + L**; the face opens on whichever timer finishes next; presets can be saved from the watch, and the presets and beep style can be baked in with `local.json`.
- **Different:** **LAP** stands in for the blinking bell, which Forge faces can't control; the weekday digits show the Forge slot name (`FA`–`FC`) instead of `TI`.

## Beep styles

Three ways to beep, chosen over Bluetooth (see [below](#bluetooth-messages)); the face starts on **stock**:

| Style | Interval change | Timer end / end of interval set |
| --- | --- | --- |
| **stock** (`S0`) | Like the official face: *beepbeepbeep* every second for 10 s while the next interval runs; any button silences it | The same triple pattern for up to 20 s, until a button |
| **ping** (`S1`) | One short high beep (`beepShort`) | A short high beep every half second for up to 20 s, until a button |
| **countdown** (`S2`) | A short high beep at 5, 4, 3, 2 and 1 s left in every interval, then *beepbeepbeep* | The same countdown, then the half-second ring |

On another face, beeping you can't stop is capped at 5 s in every style, and the second-by-second cues (the stock triple pattern, ping's interval beep, the countdown) only play while the face is on screen (see [Off screen](#off-screen)).

## Buttons

| Button | Does |
| --- | --- |
| **A + L** together | Switch timer 1 → 2 → 3 |
| **L** | Edit (seconds → minutes → hours → done); clear when paused |
| **A** | Increment while editing (hold to repeat); start / pause / resume |
| Hold **L** (idle) | Browse the 10 presets; **L** next, **A** load, hold **L** save the current time to that preset |
| Hold **A** (idle) | Interval mode: run presets 1–10 in sequence, stopping at a zero preset |
| **A** at 00:00 00 | Fast mode (`F`): waits; each **L** adds a minute |

- **LAP** blinks while the timer on screen runs; **PM** means another timer is running.
- A timer finishing on screen beeps for up to 20 s; any button stops it. On another face it beeps for at most 5 s, then the face opens on that timer next time.
- Presets, the beep style and running timers reset when the watch reboots (Forge has no storage yet).
- A phone can set the beep style, replace the presets or start a timer over the Forge Bluetooth service (formats below).

## Off screen

multitimer runs best in the foreground. Forge cancels a face's timers when it leaves the screen, and the only clock event that reaches a face in the background is the once-a-minute tick.

- Running timers keep counting from timestamps, so they show the right time when you come back.
- A timer that ends while you're on another face is caught at the next minute tick, so it can ring up to 59 s late.
- Timers that end exactly on a minute ring on time, so for background use set whole-minute timers and start them as the minute turns over.
- The emulator still fires timers off screen, so it rings on time there; expect the watch to behave as above.

## Bluetooth messages

Write to the Forge RX characteristic (`C6FB0002-A37D-40AC-89BE-887D25E1F5B3`). Today that means the emulator's Bluetooth panel: as of October 2026 the watch's firmware doesn't expose the Forge service.

**Beep style:** the text `S0`, `S1` or `S2` (stock, ping, countdown), typed into the emulator's Bluetooth panel or nRF Connect's text mode.

**Presets and timers:** one 45-byte binary message (the emulator panel sends typed text, so it can't send this one):

| Byte | Meaning |
| --- | --- |
| 0 | Target timer, `0`–`2` |
| 1–3 | `HH MM SS` to start with (mode 1) |
| 4 | Mode: `0` save presets only, `1` start the target with `HH:MM:SS`, `2` start the target in interval mode |
| 5–44 | 10 presets, each a little-endian uint32 of seconds (clamped to 23:59:59) |

Bytes 1–44 match the official Ollee app's `02 26` timer payload. Send it as three writes, each prefixed with a sequence byte: `[0] + bytes 0–18`, `[1] + bytes 19–37`, `[2] + bytes 38–44`. A write out of order discards the partial message.

## local.json

Bake your own presets and beep style into a personal build with a `local.json` (gitignored), e.g. `{"multitimer": {"beepStyle": 2, "presets": [60, 180, 300, 600, 900, 1500, 1800, 2700, 3600, 0]}}`. `node build.js` then also writes `multitimer-local.min.js` (gitignored) to upload instead.

- `beepStyle`: `0`–`2` (stock, ping, countdown); any other value loads as stock.
- `presets`: 10 whole seconds, each from `0` to `86399` (23:59:59).
- A zero preset ends interval mode: the sequence stops before it, and a zero in slot 1 means interval mode never starts.
- Bluetooth `S0`–`S2` still changes the beep style at runtime.
