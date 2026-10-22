# forge-faces

Custom watch faces for the [Ollee Watch](https://www.olleewatch.com), written for
[Ollee Watch Forge](https://github.com/olleewatch/forge_emulator), the watch's built-in JavaScript platform.

| Face | What it does |
| --- | --- |
| [multitimer.js](multitimer.js) (upload one of the [builds](#beep-styles)) | Feature-parity replacement for the official TIMER face, with up to three timers running at once. |

## Try a face

Forge is in Beta 1, so faces run in the emulator only; deploying to the watch arrives in Beta 2.

Each face comes as readable source (`name.js`) and minified builds (`name-<variant>.min.js`). Forge scripts must fit in 8158 bytes, so **load and upload a `.min.js`**; read the `.js`.

1. Open the [Forge emulator](https://github.com/olleewatch/forge_emulator) (`index.html`).
2. **Load file** → for example `multitimer-stock.min.js` (or paste it into the editor).
3. Click **Run**.

To rebuild after editing the source: `npm install terser@5 && node build.js`. Top-level names are shortened; the hook names the watch calls and `subscribe` are kept.

## multitimer.js

A feature-parity replacement for the official Ollee TIMER face that adds **simultaneous timers**: up to three countdowns run at once, each with the full TIMER feature set.

- **Same as the official face:** edit to 23:59:59, start / pause / clear, 10 presets, interval mode, fast mode, and the same buttons for each.
- **Added:** three independent timers (number shown on the day digits), switched with **A + L**; the face opens on whichever timer finishes next; presets can be saved from the watch.
- **Different:** **LAP** stands in for the blinking bell, which Forge faces can't control; the weekday digits show the Forge slot name (`FA`–`FC`) instead of `TI`.

### Beep styles

One source, three builds that differ only in how they beep:

| Build | Interval change | Timer end / end of interval set |
| --- | --- | --- |
| [multitimer-stock.min.js](multitimer-stock.min.js) | Like the official face: *beepbeepbeep* every second for 10 s while the next interval runs; any button silences it | The same triple pattern for up to 20 s, until a button |
| [multitimer-ping.min.js](multitimer-ping.min.js) | One short beep | A beep every half second for up to 20 s, until a button |
| [multitimer-countdown.min.js](multitimer-countdown.min.js) | A beep at 5, 4, 3, 2 and 1 s left in every interval, then *beepbeepbeep* | The same countdown, then the half-second ring |

On another face, beeping you can't stop is capped at 5 s in every style.

### Buttons

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
- Presets and running timers reset when the watch reboots (Forge has no storage yet).
- A phone can replace the presets or start a timer over the Forge Bluetooth service (format below).

### Bluetooth message

Write to the Forge RX characteristic (`C6FB0002-A37D-40AC-89BE-887D25E1F5B3`). One 45-byte message:

| Byte | Meaning |
| --- | --- |
| 0 | Target timer, `0`–`2` |
| 1–3 | `HH MM SS` to start with (mode 1) |
| 4 | Mode: `0` save presets only, `1` start the target with `HH:MM:SS`, `2` start the target in interval mode |
| 5–44 | 10 presets, each a little-endian uint32 of seconds (clamped to 23:59:59) |

Bytes 1–44 match the official Ollee app's `02 26` timer payload. Send it as three writes, each prefixed with a sequence byte: `[0] + bytes 0–18`, `[1] + bytes 19–37`, `[2] + bytes 38–44`. A write out of order discards the partial message.

## License

[GPL-3.0](LICENSE).
