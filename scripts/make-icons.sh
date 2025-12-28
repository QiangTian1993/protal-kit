#!/usr/bin/env bash
set -euo pipefail

# Generate platform icons from a provided PNG.
# Usage: npm run icons
# Input: build/icons/icon.png (512px+ recommended, preferably 1024x1024)
# Output: build/icons/icon.icns, build/icons/icon.ico, build/icons/icon.png

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ICON_DIR="$ROOT_DIR/build/icons"
SRC_PNG="$ICON_DIR/icon.png"

mkdir -p "$ICON_DIR"

if [[ ! -f "$SRC_PNG" ]]; then
  echo "[icons] Missing source: $SRC_PNG"
  echo "Please place your PNG icon as $SRC_PNG (>=1024x1024 recommended)."
  exit 0
fi

echo "[icons] Using source: $SRC_PNG"

# --- macOS .icns ---
if command -v sips >/dev/null 2>&1 && command -v iconutil >/dev/null 2>&1; then
  TMP_SET="$ICON_DIR/icon.iconset"
  rm -rf "$TMP_SET"
  mkdir -p "$TMP_SET"

  sips -z 16 16     "$SRC_PNG" --out "$TMP_SET/icon_16x16.png" >/dev/null
  sips -z 32 32     "$SRC_PNG" --out "$TMP_SET/icon_16x16@2x.png" >/dev/null
  sips -z 32 32     "$SRC_PNG" --out "$TMP_SET/icon_32x32.png" >/dev/null
  sips -z 64 64     "$SRC_PNG" --out "$TMP_SET/icon_32x32@2x.png" >/dev/null
  sips -z 128 128   "$SRC_PNG" --out "$TMP_SET/icon_128x128.png" >/dev/null
  sips -z 256 256   "$SRC_PNG" --out "$TMP_SET/icon_128x128@2x.png" >/dev/null
  sips -z 256 256   "$SRC_PNG" --out "$TMP_SET/icon_256x256.png" >/dev/null
  sips -z 512 512   "$SRC_PNG" --out "$TMP_SET/icon_256x256@2x.png" >/dev/null
  sips -z 512 512   "$SRC_PNG" --out "$TMP_SET/icon_512x512.png" >/dev/null
  # 1024 keeps source size if >= 1024
  sips -z 1024 1024 "$SRC_PNG" --out "$TMP_SET/icon_512x512@2x.png" >/dev/null || true

  iconutil -c icns "$TMP_SET" -o "$ICON_DIR/icon.icns"
  echo "[icons] Wrote: $ICON_DIR/icon.icns"
else
  echo "[icons] Skip .icns (sips/iconutil not available)"
fi

# --- Windows .ico ---
ICO_OUT="$ICON_DIR/icon.ico"
if command -v magick >/dev/null 2>&1; then
  magick "$SRC_PNG" -define icon:auto-resize=16,24,32,48,64,128,256 "$ICO_OUT"
  echo "[icons] Wrote: $ICO_OUT (ImageMagick 'magick')"
elif command -v convert >/dev/null 2>&1; then
  convert "$SRC_PNG" -define icon:auto-resize=16,24,32,48,64,128,256 "$ICO_OUT"
  echo "[icons] Wrote: $ICO_OUT (ImageMagick 'convert')"
else
  # Fallback: copy PNG as ICO placeholder
  cp "$SRC_PNG" "$ICO_OUT"
  echo "[icons] ImageMagick missing, copied PNG as ICO placeholder: $ICO_OUT"
fi

echo "[icons] Done."

