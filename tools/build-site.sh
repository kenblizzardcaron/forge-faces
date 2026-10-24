#!/bin/sh
# Builds the hosted emulator into <outDir>: upstream/ plus patches/*.patch in order, and faces/.
# Fails if any patch does not apply. Build outside this checkout: inside a repo, git apply
# resolves paths against the repo root.
set -eu
out=${1:?usage: tools/build-site.sh <outDir>}
root=$(cd "$(dirname "$0")/.." && pwd)
rm -rf "$out" && mkdir -p "$out"
git -C "$root/upstream" archive HEAD | tar -x -C "$out"
for p in "$root"/patches/*.patch; do
  [ -e "$p" ] || continue
  echo "applying $(basename "$p")"
  (cd "$out" && git apply "$p")
done
mkdir -p "$out/faces"
cp "$root"/*.js "$out/faces/"
rm -f "$out"/faces/*-local.js "$out"/faces/*-local.min.js
rm -f "$out/faces/build.js"
