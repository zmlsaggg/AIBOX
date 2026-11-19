#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPOSITORY_ROOT="$(cd "$ROOT/.." && pwd)"
TARGET="$ROOT/assets/characters"
SOURCE_DIR="$REPOSITORY_ROOT/.aibox-source-assets"
mkdir -p "$TARGET" "$SOURCE_DIR"

download() {
  local name="$1"
  local url="$2"
  local expected_bytes="$3"
  local expected_sha="$4"
  local destination="$SOURCE_DIR/${name%.glb}.source.glb"
  local temporary="$destination.download"

  if [[ -s "$destination" ]] &&
     [[ "$(wc -c < "$destination" | tr -d ' ')" == "$expected_bytes" ]] &&
     [[ "$(sha256sum "$destination" | cut -d ' ' -f1)" == "$expected_sha" ]]; then
    echo "Verified cached asset: $name"
    return
  fi

  echo "Downloading $name ..."
  rm -f "$temporary"
  curl --fail --location --retry 3 "$url" --output "$temporary"

  local actual_bytes
  actual_bytes="$(wc -c < "$temporary" | tr -d ' ')"
  [[ "$actual_bytes" == "$expected_bytes" ]] || {
    echo "Unexpected size for $name: $actual_bytes bytes" >&2
    exit 1
  }

  local actual_sha
  actual_sha="$(sha256sum "$temporary" | cut -d ' ' -f1)"
  [[ "$actual_sha" == "$expected_sha" ]] || {
    echo "SHA-256 mismatch for $name: $actual_sha" >&2
    exit 1
  }

  mv -f "$temporary" "$destination"
}

download "guard_dog_walker.glb" \
  "https://tevy.dev/models/dog-walker/v1/lod0.glb" \
  "1574900" "404a67373dcd4200035c04fa9a6fd53b7156ef35397acef7ef9bc2db1d0ed1d5"

download "prisoner_casual_walker.glb" \
  "https://tevy.dev/models/casual-walker/v1/lod0.glb" \
  "1789516" "60f7fec2c35fc46b848d99da4c67f43213eea6d8464aa05ac683ffacf2a576d7"

echo "AIBOX CC0 humanoid characters are ready."

echo "Converting compressed source GLBs into Godot-compatible GLB files..."
node "$REPOSITORY_ROOT/tools/prepare-godot-assets.mjs" "$SOURCE_DIR" "$TARGET"
