#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TARGET="$ROOT/assets/characters"
mkdir -p "$TARGET"

BASE="https://raw.githubusercontent.com/trebeljahr/quaternius-showcase/0128ca510d653bb04d6d1e4885bd8890b5050b4f/public/glb/modular_men"
download() {
  local name="$1"
  local url="$2"
  local destination="$TARGET/$name"
  if [[ -s "$destination" && "$(wc -c < "$destination")" -gt 100000 ]]; then
    echo "Already present: $name"
    return
  fi
  echo "Downloading $name ..."
  curl --fail --location --retry 3 "$url" --output "$destination"
  test -s "$destination"
  test "$(wc -c < "$destination")" -gt 100000
}

download "guard_swat.glb" "$BASE/Swat.glb"
download "prisoner_punk.glb" "$BASE/Punk.glb"
echo "AIBOX character assets are ready."
