#!/bin/bash
# Paired A/B forced-choice sheets: per shot, reference | X | Y where X/Y are the old and new renders in random order.
# usage: tools/ab.sh OLD_NN NEW_NN   -> cook/compare/rNEW/ab_S0i.jpg and cook/compare/rNEW/ab_key.txt (which side is new)
set -e
cd "$(dirname "$0")/.."
OLD=$1; NEW=$2; OUT=cook/compare/r$NEW; mkdir -p $OUT; : > $OUT/ab_key.txt
for i in 1 2 3 4; do
  A=cook/stills/r$OLD/S0$i.png; B=cook/stills/r$NEW/S0$i.png
  [ -f $A ] && [ -f $B ] || continue
  if [ $((RANDOM % 2)) -eq 0 ]; then X=$A; Y=$B; echo "S0$i new=Y" >> $OUT/ab_key.txt; else X=$B; Y=$A; echo "S0$i new=X" >> $OUT/ab_key.txt; fi
  ffmpeg -loglevel error -y -i cook/refs/R0$i.png -i $X -i $Y -filter_complex "[0]scale=640:480[a];[1]scale=640:480[b];[2]scale=640:480[c];[a][b][c]hstack=3" -q:v 2 $OUT/ab_S0$i.jpg
done
cat $OUT/ab_key.txt
