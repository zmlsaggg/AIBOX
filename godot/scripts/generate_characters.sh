#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
GENERATOR="$ROOT/.aibox-ara3d"
DESTINATION="$ROOT/godot/assets/characters"
ARA_REPOSITORY="https://github.com/TuriaArt/3d-gen-TU.git"
ARA_COMMIT="3d78dcad462feeeb64db7fe667a7c34105a10a45"

if [[ ! -d "$GENERATOR/.git" ]]; then
  rm -rf "$GENERATOR"
  git clone --filter=blob:none "$ARA_REPOSITORY" "$GENERATOR"
fi
git -C "$GENERATOR" fetch --depth 1 origin "$ARA_COMMIT"
git -C "$GENERATOR" checkout --detach "$ARA_COMMIT"

if [[ ! -x "$GENERATOR/node_modules/.bin/tsx" ]]; then
  (cd "$GENERATOR" && npm ci --no-audit --no-fund)
fi

if [[ ! -f "$GENERATOR/public/assets/catalog.json" ||
      ! -f "$GENERATOR/public/assets/base.pack" ||
      ! -f "$GENERATOR/vendor/sys/skins" ]]; then
  echo "Preparing the CC0 MakeHuman data library (first run can download ~420 MB)..."
  (cd "$GENERATOR" && npm run setup-assets)
fi

mkdir -p "$DESTINATION"
"$GENERATOR/node_modules/.bin/tsx" "$ROOT/tools/aibox-characters/export-character.ts" \
  --generator "$GENERATOR" \
  --params "$ROOT/tools/aibox-characters/guard.params.json" \
  --out "$DESTINATION/guard.glb"
"$GENERATOR/node_modules/.bin/tsx" "$ROOT/tools/aibox-characters/export-character.ts" \
  --generator "$GENERATOR" \
  --params "$ROOT/tools/aibox-characters/prisoner.params.json" \
  --out "$DESTINATION/prisoner.glb"

node "$ROOT/tools/aibox-characters/verify-character-glb.mjs" "$DESTINATION/guard.glb"
node "$ROOT/tools/aibox-characters/verify-character-glb.mjs" "$DESTINATION/prisoner.glb"
