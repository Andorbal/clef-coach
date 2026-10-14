#!/usr/bin/env bash
# Regenerate the README's screenshots and animations in docs/media.
#
#   tools/readme-media.sh            # capture with Playwright, then convert
#   tools/readme-media.sh <raw-dir>  # convert an existing capture only
#
# Capturing drives the real app (e2e/media.spec.ts) on the iPad and phone
# viewports. Converting needs ffmpeg (and gifsicle, if installed, to shrink the
# GIFs further): screenshots become JPEGs (the app's film grain makes PNGs
# ten times larger), and recorded frames become GIFs (GitHub plays GIFs
# inline; a video file in the repo would only show as a link).
set -euo pipefail
cd "$(dirname "$0")/.."

RAW=${1:-}
if [[ -z "$RAW" ]]; then
  RAW=$(mktemp -d)
  MEDIA="$RAW" npx playwright test media --project=ipad
  MEDIA="$RAW" npx playwright test media --project=phone
fi

OUT=docs/media
mkdir -p "$OUT"

for f in "$RAW"/*.png; do
  name=$(basename "$f" .png)
  # tablet screenshots 1600 px wide, phone ones 600 px: sharp on retina screens, light in the repo
  if [[ $name == phone-* ]]; then width=600; else width=1600; fi
  ffmpeg -y -loglevel error -i "$f" -vf "scale=$width:-1:flags=lanczos" -q:v 4 "$OUT/$name.jpg"
done

for dir in "$RAW"/frames/*/; do
  name=$(basename "$dir")
  # frames.txt gives each screencast frame its real duration; resample to 15 fps,
  # then a palette built from the moving parts keeps the GIF small and clean
  # (ordered dithering: unchanged pixels stay identical from frame to frame)
  ffmpeg -y -loglevel error -f concat -safe 0 -i "$dir/frames.txt" \
    -vf "fps=15,scale=880:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" \
    "$OUT/$name.gif"
  if command -v gifsicle >/dev/null; then gifsicle -b -O3 --lossy=80 "$OUT/$name.gif"; fi
done

du -sh "$OUT"/* | sort -k2
