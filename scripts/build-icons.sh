#!/bin/sh
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
res="$root/resources"
setdir="$res/icon.iconset"

rsvg-convert -w 1024 -h 1024 "$res/icon.svg" -o "$res/icon.png"
# The dev build's icon: the same mark on cream, to tell it from the installed app.
sed -e 's/#1F1F24/#FBF8F1/' -e 's/#121214/#ECE5D6/' "$res/icon.svg" |
  rsvg-convert -w 1024 -h 1024 -o "$res/icon-dev.png"

rm -rf "$setdir"
mkdir "$setdir"
for spec in \
  "16 icon_16x16.png" \
  "32 icon_16x16@2x.png" \
  "32 icon_32x32.png" \
  "64 icon_32x32@2x.png" \
  "128 icon_128x128.png" \
  "256 icon_128x128@2x.png" \
  "256 icon_256x256.png" \
  "512 icon_256x256@2x.png" \
  "512 icon_512x512.png" \
  "1024 icon_512x512@2x.png"
do
  set -- $spec
  rsvg-convert -w "$1" -h "$1" "$res/icon.svg" -o "$setdir/$2"
done

iconutil -c icns "$setdir" -o "$res/icon.icns"
rm -rf "$setdir"
