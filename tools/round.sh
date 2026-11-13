#!/bin/bash
# usage: tools/round.sh NN [shots=1,2,3,4]
# Renders stills to cook/stills/rNN/S0x.png, side-by-side to cook/compare/rNN/all.jpg, colour checks to cook/compare/rNN/color.txt
set -e
cd "$(dirname "$0")/.."
NN=$1; SHOTS=${2:-1,2,3,4}
mkdir -p cook/stills/r$NN cook/compare/r$NN
pgrep -f "node server.js" >/dev/null || (node server.js >/dev/null 2>&1 &) ; sleep 1
NODE_PATH=$(npm root -g) node render.js $SHOTS 1448 1086 cook/stills/r$NN 2>&1 | grep -E "ERR|rendered"
for f in cook/stills/r$NN/shot*.png; do n=$(basename $f .png | tr -dc 0-9); mv $f cook/stills/r$NN/S0$n.png; done
ARGS=""; for i in 1 2 3 4; do [ -f cook/stills/r$NN/S0$i.png ] && ARGS="$ARGS cook/refs/R0$i.png cook/stills/r$NN/S0$i.png"; done
node .claude/skills/cook/scripts/side-by-side.mjs --aspect 4:3 --out cook/compare/r$NN/all.jpg $ARGS
: > cook/compare/r$NN/color.txt
for i in 1 2 3 4; do [ -f cook/stills/r$NN/S0$i.png ] && { echo "S0$i:"; python3 tools/color_check.py cook/refs/R0$i.png cook/stills/r$NN/S0$i.png; } >> cook/compare/r$NN/color.txt; done
for f in cook/stills/r$NN/S0*.png; do ffmpeg -loglevel error -y -i $f -q:v 2 ${f%.png}.jpg; done
cat cook/compare/r$NN/color.txt
