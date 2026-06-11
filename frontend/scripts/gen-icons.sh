#!/usr/bin/env bash
# Regenerate the PWA / touch-device PNG icons from the source SVGs.
#
# Sources of truth (committed, hand-edited):
#   static/favicon.svg          — the app glyph on an opaque bg (favicon + any-purpose icons)
#   static/icon-maskable.svg    — same glyph in the maskable safe zone (~60% center)
#
# Generated (committed, so builds/deploys need no rasterizer):
#   apple-touch-icon.png (180)  icon-192.png  icon-512.png  favicon-32.png  (purpose: any)
#   icon-192-maskable.png  icon-512-maskable.png                            (purpose: maskable)
#
# Requires librsvg:  brew install librsvg   (provides rsvg-convert)
# Run from the frontend dir:  ./scripts/gen-icons.sh
set -euo pipefail
cd "$(dirname "$0")/../static"

command -v rsvg-convert >/dev/null || {
	echo "rsvg-convert not found — install with: brew install librsvg" >&2
	exit 1
}

# Any-purpose raster (full-bleed glyph) + favicon + apple-touch.
rsvg-convert -w 180 -h 180 favicon.svg -o apple-touch-icon.png
rsvg-convert -w 192 -h 192 favicon.svg -o icon-192.png
rsvg-convert -w 512 -h 512 favicon.svg -o icon-512.png
rsvg-convert -w 32 -h 32 favicon.svg -o favicon-32.png

# Maskable raster (safe-zone padded so Android's mask can't clip the glyph).
rsvg-convert -w 192 -h 192 icon-maskable.svg -o icon-192-maskable.png
rsvg-convert -w 512 -h 512 icon-maskable.svg -o icon-512-maskable.png

echo "icons regenerated from favicon.svg + icon-maskable.svg"
