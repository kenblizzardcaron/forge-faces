# forge-faces

Custom watch faces for the [Ollee Watch](https://www.olleewatch.com), written for
[Ollee Watch Forge](https://github.com/olleewatch/forge_emulator), the watch's built-in JavaScript platform.

| Face | Guide | Try it | What it does |
| --- | --- | --- | --- |
| [multitimer.js](multitimer.js) (upload [multitimer.min.js](multitimer.min.js)) | [multitimer.md](multitimer.md) | [Open in emulator](https://kenblizzardcaron.github.io/forge-faces/?face=multitimer) | Feature-parity replacement for the official TIMER face, with up to three timers running at once. |
| [repladder.js](repladder.js) (upload [repladder.min.js](repladder.min.js)) | [repladder.md](repladder.md) | [Open in emulator](https://kenblizzardcaron.github.io/forge-faces/?face=repladder) | Declining-rep workout timer: reps split across sets, one fewer each set, with rest only between sets. |

## Try a face

Forge is in Beta 1, so faces run in the emulator only; Ollee plans deploying to the watch for Beta 2. The hosted emulator links are the easiest way to share a face.

**Hosted:** open a face's **Open in emulator** link above, then click **Run**. The link loads the face into the editor but doesn't start it.

**Local copy of the [Forge emulator](https://github.com/olleewatch/forge_emulator):**

1. Open its `index.html`.
2. **Load file** → for example `multitimer.min.js` (or paste it into the editor).
3. Click **Run**.

Each face comes as readable source (`name.js`) and a minified build (`name.min.js`). Forge scripts must fit in 8158 bytes, so **upload a `.min.js`** to the watch; read the `.js`. The emulator runs either, and only warns when a script is over the limit.

To rebuild both faces after editing their source: `npm install terser@5 && node build.js`; run the tests with `node --test`. Top-level names are shortened; the hook names the watch calls and `subscribe` are kept.

## Hosted emulator

[kenblizzardcaron.github.io/forge-faces](https://kenblizzardcaron.github.io/forge-faces/) is Ollee's [Forge emulator](https://github.com/olleewatch/forge_emulator) with a few patches, and this repo's faces under [`faces/`](https://kenblizzardcaron.github.io/forge-faces/faces/).

- `upstream/` is a submodule pinned to an upstream commit; `patches/*.patch` are applied on top, in order, by `tools/build-site.sh`.
- [`0001-touch-support.patch`](patches/0001-touch-support.patch): press and hold the on-screen buttons on phones and tablets (upstream [PR #2](https://github.com/olleewatch/forge_emulator/pull/2)).
- [`0002-face-url-param.patch`](patches/0002-face-url-param.patch): `?face=<name>` preloads `faces/<name>.js`, with its prebuilt `.min.js` in the minified tab, e.g. [`?face=multitimer`](https://kenblizzardcaron.github.io/forge-faces/?face=multitimer) or [`?face=repladder`](https://kenblizzardcaron.github.io/forge-faces/?face=repladder).
- A weekly build runs against upstream `main`. If a patch stops applying, the build fails and the last good site stays up: rebase the patch, or delete it once upstream has the change.
- To add a patch: edit in `upstream/`, then `git -C upstream diff > patches/000N-name.patch` and `git -C upstream checkout .`.

## License

The faces and tools here are [GPL-3.0](LICENSE). The emulator in `upstream/` and the patches to it are derived from Ollee's code, which carries no license; they are shared here in good faith.
