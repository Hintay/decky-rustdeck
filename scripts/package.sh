#!/usr/bin/env sh
# Assemble the installable plugin zip from an existing build and print its path.
set -eu

name=decky-rustdeck
version=$(node -p "require('./package.json').version")
out=out
stage="$out/$name"

test -f dist/index.js || { echo "dist/index.js is missing, run the build first" >&2; exit 1; }

rm -rf "$out"
mkdir -p "$stage/dist" "$stage/assets"
cp dist/index.js "$stage/dist/"
cp main.py plugin.json package.json LICENSE README.md "$stage/"
cp -R LICENSES py_modules "$stage/"
# The backend hands this artwork to Steam for RustDesk's shortcut; screenshots stay out.
cp -R assets/artwork "$stage/assets/"
find "$stage" -name __pycache__ -type d -prune -exec rm -rf {} +
(cd "$out" && zip -qr "$name-v$version.zip" "$name")
echo "$out/$name-v$version.zip"
