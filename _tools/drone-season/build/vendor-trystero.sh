#!/bin/sh
# Rebuilds drone-season/trystero-0.26.0.js: Trystero's Nostr strategy as one browser script (global `Trystero`).
# Two-player games use it to introduce the two browsers through public Nostr relays; after that they talk directly.
# Run from anywhere; needs npm. Bump the version in the file name and in NET_LIB in src/game.js together.
set -e
V=0.26.0
OUT="$(cd "$(dirname "$0")/../../.." && pwd)/drone-season/trystero-$V.js"
TMP="$(mktemp -d)"
cd "$TMP"
npm init -y >/dev/null
npm install --silent "trystero@$V" esbuild@0.24.2
echo "export { joinRoom, selfId, getRelaySockets } from '@trystero-p2p/nostr';" > entry.mjs
npx esbuild entry.mjs --bundle --minify --format=iife --global-name=Trystero --target=es2020 --legal-comments=eof --outfile=bundle.js
{ printf '/*! Trystero %s with its Nostr strategy (MIT, (c) 2021 Dan Motzenbecker, github.com/dmotz/trystero), bundled for Drone Season by _tools/drone-season/build/vendor-trystero.sh */\n' "$V"; cat bundle.js; } > "$OUT"
rm -rf "$TMP"
echo "wrote $OUT"
