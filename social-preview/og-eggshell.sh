#!/usr/bin/env bash
# og-eggshell.sh — 1200×630 social preview for Eggshell CLI Easter Egg Hunt.
#
# Adapted from maxstridde/social_preview (og-advanced.sh). Instead of a photo
# in the card, we draw a fake terminal window that evokes the game's aesthetic.
#
# NOTE: Uses ImageMagick 6 (convert) rather than 7 (magick).
#
# Usage:  ./og-eggshell.sh [output.png]   (default: eggshell-og.png)
# Requires: ImageMagick 6+ (apt install imagemagick)

set -euo pipefail

# ------------------------------------------------------------------ config
SUBTITLE="Browser-based CLI Easter Egg Hunt"
TITLE="Eggshell"
BTN_TEXT="Play now"

BG_TOP='#0F172A'      # slate-900  — canvas gradient top
BG_BOT='#020617'      # slate-950  — canvas gradient bottom
TERM_BG='#1E293B'     # slate-800  — terminal body
CHROME_BG='#2D3748'   # slate-700  — window chrome bar

GREEN='#4ADE80'        # bright green  — active prompt lines
GREEN_DIM='#16A34A'    # darker green  — accent shapes
SLATE='#94A3B8'        # slate-400     — dim text / subtitle
WHITE='#F8FAFC'        # near-white    — title

S1='#22C55E'           # green         — accent rect, top-left
S2='#0D3321'           # deep green    — accent rect, bottom-right
S3='#86EFAC'           # pale green    — circle, top-right

BTN_COL='#4ADE80'
BTN_TXT='#0F172A'

FONT_MONO="/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
FONT_BOLD="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REG="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
# -----------------------------------------------------------------------

OUTPUT="${1:-eggshell-og.png}"

for f in "$FONT_MONO" "$FONT_BOLD" "$FONT_REG"; do
  [[ -f "$f" ]] || { echo "Font not found: $f" >&2; exit 1; }
done

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

# Card / frame dimensions — matches og-advanced.sh landscape layout
BOX_W=470; BOX_H=360
FRAME_W=$((BOX_W+20)); FRAME_H=$((BOX_H+20))
BX=65; BY=$(( (630-FRAME_H)/2 ))
TX=$((BX+FRAME_W+58))
CHROME_H=32
BODY_H=$((BOX_H-CHROME_H))

# 1) Window chrome bar — three dots + path label
convert -size ${BOX_W}x${CHROME_H} xc:"$CHROME_BG" \
  -fill '#FC8181' -draw "circle 16,16 23,16" \
  -fill '#F6E05E' -draw "circle 38,16 45,16" \
  -fill '#68D391' -draw "circle 60,16 67,16" \
  -font "$FONT_REG" -fill '#64748B' -pointsize 12 -gravity center \
  -annotate +28+0 "player@eggshell:~" \
  "$TMP/chrome.png"

# 2) Terminal body — representative game session
convert -size ${BOX_W}x${BODY_H} xc:"$TERM_BG" \
  -font "$FONT_MONO" -pointsize 16 -gravity northwest \
  -fill "$SLATE"  -annotate +16+14  "# 5 eggs hidden in the filesystem" \
  -fill "$GREEN"  -annotate +16+46  "$ ls" \
  -fill "$WHITE"  -annotate +16+70  "documents/  secrets/  vault/ [locked]" \
  -fill "$GREEN"  -annotate +16+108 "$ cat egg1.txt" \
  -fill '#FCD34D' -annotate +16+132 "[egg] Egg No. 1 collected!" \
  -fill "$GREEN"  -annotate +16+180 "$ sudo cd /root" \
  -fill "$SLATE"  -annotate +16+204 "Password: ........" \
  -fill "$GREEN"  -annotate +16+252 "$ unzip final_egg.zip" \
  -fill '#FCD34D' -annotate +16+276 "[win] All 5 eggs found!" \
  "$TMP/body.png"

# 3) Combine chrome + body into one card canvas
convert -size ${BOX_W}x${BOX_H} xc:"$TERM_BG" \
  "$TMP/chrome.png" -geometry +0+0         -composite \
  "$TMP/body.png"   -geometry +0+${CHROME_H} -composite \
  "$TMP/card.png"

# 4) Thin frame around card (dark green, not white)
convert -size ${FRAME_W}x${FRAME_H} xc:'#1A3828' \
  "$TMP/card.png" -gravity center -composite "$TMP/framed.png"

# 5) Soft shadow under frame
convert -size $((FRAME_W+80))x$((FRAME_H+80)) xc:none \
  -fill 'rgba(0,0,0,0.55)' \
  -draw "roundrectangle 40,40,$((FRAME_W+39)),$((FRAME_H+39)),36,36" \
  -blur 0x28 "$TMP/shadow.png"

# 6) Decorative accent shapes (same positions as og-advanced.sh)
convert -size 300x380 xc:none -fill "$S1" \
  -draw 'roundrectangle 0,0,299,379,46,46' \
  -background none -rotate -10 "$TMP/s1.png"
convert -size 300x300 xc:none -fill "$S2" \
  -draw 'roundrectangle 0,0,299,299,46,46' \
  -background none -rotate 9 "$TMP/s2.png"
convert -size 150x150 xc:none -fill "$S3" \
  -draw 'circle 75,75 75,5' "$TMP/s3.png"

# 7) Pill button
convert -size 220x64 xc:none \
  -fill "$BTN_COL" -draw 'roundrectangle 0,0,219,63,32,32' \
  -font "$FONT_BOLD" -fill "$BTN_TXT" \
  -gravity center -pointsize 24 -annotate +0+0 "$BTN_TEXT" \
  "$TMP/button.png"

# 8) Top accent line (green gradient)
convert \
  \( -size 8x600 gradient:"${GREEN_DIM}-${S1}" -rotate 90 \) \
  \( -size 8x600 gradient:"${S3}-${GREEN_DIM}" -rotate 90 \) \
  +append -resize 1200x8\! "$TMP/topline.png"

# 9) Background gradient
convert -size 1200x630 "gradient:${BG_TOP}-${BG_BOT}" "$TMP/bg.png"

# Shape offsets — derived from BX/BY so layout stays consistent
S1X=$((BX-20));          S1Y=$((BY-34))
S3X=$((BX+FRAME_W-95));  S3Y=$((BY-38))
S2X=$((BX+FRAME_W-170)); S2Y=$((BY+FRAME_H-180))
SHX=$((BX-40));          SHY=$((BY-22))

# 10) Final composite — background → shapes → shadow → card → text → button → topline
convert "$TMP/bg.png" \
  "$TMP/s1.png"      -geometry +${S1X}+${S1Y}     -compose over -composite \
  "$TMP/s3.png"      -geometry +${S3X}+${S3Y}     -compose over -composite \
  "$TMP/s2.png"      -geometry +${S2X}+${S2Y}     -compose over -composite \
  "$TMP/shadow.png"  -geometry +${SHX}+${SHY}     -compose over -composite \
  "$TMP/framed.png"  -geometry +${BX}+${BY}       -compose over -composite \
  -font "$FONT_REG"  -fill "$SLATE" \
    -gravity northwest -pointsize 27 -annotate +${TX}+172 "$SUBTITLE" \
  -font "$FONT_BOLD" -fill "$WHITE" \
    -gravity northwest -pointsize 84 -annotate +${TX}+207 "$TITLE" \
  "$TMP/button.png"  -gravity northwest -geometry +${TX}+315 -compose over -composite \
  "$TMP/topline.png" -gravity north     -geometry +0+0       -compose over -composite \
  "$OUTPUT"

echo "Wrote $OUTPUT"
