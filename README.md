# forge-faces

Custom watch faces for the [Ollee Watch](https://www.olleewatch.com), written for
[Ollee Watch Forge](https://github.com/olleewatch/forge_emulator), the watch's built-in JavaScript platform.

| Face | Try it | What it does |
| --- | --- | --- |
| [multitimer.js](multitimer.js) (upload [multitimer.min.js](multitimer.min.js)) | [Open in emulator](https://kenblizzardcaron.github.io/forge-faces/?face=multitimer) | Feature-parity replacement for the official TIMER face, with up to three timers running at once. |
| [repladder.js](repladder.js) (upload [repladder.min.js](repladder.min.js)) | [Open in emulator](https://kenblizzardcaron.github.io/forge-faces/?face=repladder) | Declining-rep workout timer: reps split across sets, one fewer each set, with rest only between sets. |

## Try a face

Forge is in Beta 1, so faces run in the emulator only; Ollee plans deploying to the watch for Beta 2. The hosted emulator links are the easiest way to share a face.

**Hosted:** open a face's **Open in emulator** link above, then click **Run**. The link loads the face into the editor but doesn't start it.

**Local copy of the [Forge emulator](https://github.com/olleewatch/forge_emulator):**

1. Open its `index.html`.
2. **Load file** → for example `multitimer.min.js` (or paste it into the editor).
3. Click **Run**.

Each face comes as readable source (`name.js`) and a minified build (`name.min.js`). Forge scripts must fit in 8158 bytes, so **upload a `.min.js`** to the watch; read the `.js`. The emulator runs either, and only warns when a script is over the limit.

To rebuild both faces after editing their source: `npm install terser@5 && node build.js`; run the tests with `node --test`. Top-level names are shortened; the hook names the watch calls and `subscribe` are kept.

## multitimer.js

A feature-parity replacement for the official Ollee TIMER face that adds **simultaneous timers**: up to three countdowns run at once, each with the full TIMER feature set.

- **Same as the official face:** edit to 23:59:59, start / pause / clear, 10 presets, interval mode, fast mode, and the same buttons for each.
- **Added:** three independent timers (number shown on the day digits), switched with **A + L**; the face opens on whichever timer finishes next; presets can be saved from the watch.
- **Different:** **LAP** stands in for the blinking bell, which Forge faces can't control; the weekday digits show the Forge slot name (`FA`–`FC`) instead of `TI`.

### Beep styles

Three ways to beep, chosen over Bluetooth (see [below](#bluetooth-messages)); the face starts on **stock**:

| Style | Interval change | Timer end / end of interval set |
| --- | --- | --- |
| **stock** (`S0`) | Like the official face: *beepbeepbeep* every second for 10 s while the next interval runs; any button silences it | The same triple pattern for up to 20 s, until a button |
| **ping** (`S1`) | One short high beep (`beepShort`) | A short high beep every half second for up to 20 s, until a button |
| **countdown** (`S2`) | A short high beep at 5, 4, 3, 2 and 1 s left in every interval, then *beepbeepbeep* | The same countdown, then the half-second ring |

On another face, beeping you can't stop is capped at 5 s in every style, and the second-by-second cues (the stock triple pattern, ping's interval beep, the countdown) only play while the face is on screen (see [Off screen](#off-screen)).

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
- Presets, the beep style and running timers reset when the watch reboots (Forge has no storage yet).
- A phone can set the beep style, replace the presets or start a timer over the Forge Bluetooth service (formats below).

### Off screen

multitimer runs best in the foreground. Forge cancels a face's timers when it leaves the screen, and the only clock event that reaches a face in the background is the once-a-minute tick.

- Running timers keep counting from timestamps, so they show the right time when you come back.
- A timer that ends while you're on another face is caught at the next minute tick, so it can ring up to 59 s late.
- Timers that end exactly on a minute ring on time, so for background use set whole-minute timers and start them as the minute turns over.
- The emulator still fires timers off screen, so it rings on time there; expect the watch to behave as above.

### Bluetooth messages

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

## repladder.js

A declining-rep workout timer: a total number of reps is split across sets, one fewer rep each set, with rest between sets.

### Settings

Edit with **L** in idle, in this order. **A** raises the value (hold to repeat; it wraps to the minimum after the maximum).

| Field | Default | Range |
| --- | --- | --- |
| **Count** (total reps) | 100 | 1–999 |
| **LEn** (total time) | 10:00 | 0:15–99:45, 15 s steps |
| **SEtS** (sets) | 5 | 1–9 |
| **PACE** (seconds per rep) | 3 | 1–20 |

Reps drop by one per set; when the total doesn't divide evenly, the extra reps go to the first sets (100 in 4 sets → 27, 26, 24, 23). Rest is split evenly between sets, with none after the last.

### Buttons

| Button | Does |
| --- | --- |
| **A** (idle) | Start, with a 5 s lead-in |
| **A** (running) | Pause / resume |
| **L** (paused) | Reset |
| **L** (idle) | Edit: Count → LEn → SEtS → PACE → done |
| **A** (editing) | Raise the value (hold to repeat) |
| Any button (finish beeping) | Silence and return to idle |

### Screen

| Screen | Shows |
| --- | --- |
| Idle | `S1` on the day digits, total time and set 1's reps on the main digits (`10:00 22`); `Er` when the settings can't work |
| Lead-in | `GO`, then `rEAdy`, 4, 3, 2, 1 |
| Work | `S3`, time left and this set's reps |
| Rest | `r2`, rest left and next set's reps, with LAP blinking |
| Done | `donE` |

Each edit field and control shows its word for 1 s (`Count`, `LEn`, `SEtS`, `PACE`, `rEAdy`, `PAUSE`, `rESEt`, `Error`).

### Sounds

- Short high beeps at 5-4-3-2-1 for the lead-in.
- One beep at each work ↔ rest change, including set 1 starting.
- *beepbeepbeep* at the end, for 10 s (5 s on another face).

### Off screen

Forge only wakes a background face once a minute, so a change while you're on another face beeps at the next minute tick (one beep, however many changes were missed). The face shows the right time when you come back.

Settings reset to defaults when the watch reboots (Forge has no storage yet).

## Hosted emulator

[kenblizzardcaron.github.io/forge-faces](https://kenblizzardcaron.github.io/forge-faces/) is Ollee's [Forge emulator](https://github.com/olleewatch/forge_emulator) with a few patches, and this repo's faces under [`faces/`](https://kenblizzardcaron.github.io/forge-faces/faces/).

- `upstream/` is a submodule pinned to an upstream commit; `patches/*.patch` are applied on top, in order, by `tools/build-site.sh`.
- [`0001-touch-support.patch`](patches/0001-touch-support.patch): press and hold the on-screen buttons on phones and tablets (upstream [PR #2](https://github.com/olleewatch/forge_emulator/pull/2)).
- [`0002-face-url-param.patch`](patches/0002-face-url-param.patch): `?face=<name>` preloads `faces/<name>.js`, with its prebuilt `.min.js` in the minified tab, e.g. [`?face=multitimer`](https://kenblizzardcaron.github.io/forge-faces/?face=multitimer) or [`?face=repladder`](https://kenblizzardcaron.github.io/forge-faces/?face=repladder).
- A weekly build runs against upstream `main`. If a patch stops applying, the build fails and the last good site stays up: rebase the patch, or delete it once upstream has the change.
- To add a patch: edit in `upstream/`, then `git -C upstream diff > patches/000N-name.patch` and `git -C upstream checkout .`.

## License

The faces and tools here are [GPL-3.0](LICENSE). The emulator in `upstream/` and the patches to it are derived from Ollee's code, which carries no license; they are shared here in good faith.
