# fastzone.js

[Source](fastzone.js) · upload [fastzone.min.js](fastzone.min.js) to the watch · [Open in emulator](https://kenblizzardcaron.github.io/forge-faces/?face=fastzone) · [All faces](README.md)

An intermittent fasting timer for your wrist. Start the fast when you finish dinner, or set it back to when you actually stopped eating. The face counts down to your goal, shows which fasting zone you're in, beeps once when you get there, and keeps the stats: this week's goals, your streak, your average, your longest fast and the last 30 fasts.

- **Goal:** whole hours from 12 to 48, shown the way people say it: 16 → `16:8`, 18 → `18:6`, 20 → `20:4`, 23 → `23:1`. Above 23 it's just the hours. The face starts at 16.
- **One beep, no nagging:** the goal beep is the only sound. Zones change silently, and the eating window just counts down.
- **The fast is yours to end:** reaching the goal doesn't stop the fast. It keeps counting until you mark it over, and you can set that back too.

## Zones

| Zone | Hours fasted | Word | Stage |
| --- | --- | --- | --- |
| 1 | 0–4 | `FEd` | fed |
| 2 | 4–12 | `CAtAb` | sugar dropping (catabolic) |
| 3 | 12–16 | `FAt` | fat burning |
| 4 | 16–24 | `HEtO` | ketosis |
| 5 | 24+ | `AUtO` | autophagy |

The zone number sits on the day digits while you fast. Every time you open the face mid-fast, it shows the zone's word for a moment first. The hours are the rough estimates fasting apps use, not measurements.

## Buttons

| Button | Eating | Fasting |
| --- | --- | --- |
| **A** | Start the fast now | Show the zone word again |
| Hold **A** | Start the fast, set back | End the fast, set back (or not) |
| **L** | Stats, one page per press, then back to the timer | same |
| Hold **L** | Settings: goal, then beep | same |

**Setting back (hold A):** the screen shows `-0:00` with **S** (start) or **E** (end) on the day digits. Each **A** goes back 15 more minutes; **L** confirms. It goes back at most 6 hours, never before your last fast ended, and an end never before its start. Ending a fast always goes through this screen, so a stray press can't end it and break your streak.

Any button stops the goal beep and does nothing else. Stats, settings and the set-back screen return to the timer after 10 seconds without a press (the set-back screen cancels).

## Screen

| Screen | Main digits | Day | LAP |
| --- | --- | --- | --- |
| Fresh start, or the eating window is over | `rEAdY` | | off |
| Fasting | time to the goal, `HH:MM SS` | zone | on |
| Past the goal | time over the goal, counting up | zone | blinking |
| Eating | time left in the eating window (24 h minus the goal) | | off |
| Eating, goal 24 h or more | time since the fast ended | | off |

## Stats

| Page | Shows |
| --- | --- |
| Week | days in the last 7 with a fast that hit its goal, e.g. `5 oF 7` |
| Streak | fasts in a row that hit their goal, e.g. `Str 12` |
| Average | `AUG`, then the average fast over the last 7 days (day digits `A`) |
| Longest | `tOP`, then your longest fast (day digits `t`) |
| History | one fast per page, newest first; the day digits count back (1–30), **A** steps older, LAP means it hit its goal |

A fast hits its goal when it lasts at least the goal in effect when it ends. A miss resets the streak to 0.

## Settings

Hold **L**, then **A** steps the value and **L** moves on.

- **Goal** (day digits `G`): 12 to 48 hours, wrapping back to 12. Raising it past the time you've fasted sets the beep up again; lowering it below doesn't ring.
- **Beep** (`bEEP`, day digits `1` or `0`): the goal beep on or off.

## Off screen

The fast keeps time from timestamps, so the face is right whenever you come back to it. On another face, the goal is caught on the watch's minute tick, so the beep can come up to 59 s late, and it rings for 5 s instead of 20.

## local.json

Forge has no storage yet, so a reboot or a new upload clears the fast in progress, the history, the streak and any settings changed on the watch. To start with your own goal and beep, bake them into a personal build with a `local.json` (see [All faces](README.md)):

```json
{"fastzone": {"goal": 18, "beep": 1}}
```

`goal` is whole hours from 12 to 48 and `beep` is 1 or 0. A value out of range loads as the default (16, beep on), and a misspelled key fails the build.
