#!/usr/bin/env bash
# Build the MCPB bundle — the single-file install format for Claude Desktop, and
# the artefact Smithery asks for on upload.
#
# Staged rather than packed in place: `mcpb pack` takes a directory whole, and
# this repo's node_modules carries typescript, eslint and vitest. Packing the
# working tree would ship a ~100 MB bundle of build tooling to end users and
# hand anyone who unpacks it the dev dependency tree.
#
# The stage installs from package-lock.json with `npm ci --omit=dev`, so the
# bundle contains exactly the production closure that npm would install, at the
# locked versions — not whatever happens to be resolvable today.
set -euo pipefail

cd "$(dirname "$0")/.."
root="$PWD"
version="$(node -p "require('./package.json').version")"
stage="$root/build/stage"
out="$root/build/entyrix-mcp-${version}.mcpb"

# The manifest repeats the version; a bundle whose manifest disagrees with the
# package it contains is the kind of drift nothing at runtime notices.
manifest_version="$(node -p "require('./manifest.json').version")"
if [ "$manifest_version" != "$version" ]; then
  echo "manifest.json says $manifest_version, package.json says $version — bump both." >&2
  exit 1
fi

npm run build

rm -rf "$root/build"
mkdir -p "$stage"
cp package.json package-lock.json manifest.json README.md LICENSE "$stage/"
cp -R dist bin "$stage/"

( cd "$stage" && npm ci --omit=dev --no-audit --no-fund --ignore-scripts >/dev/null )

npx -y @anthropic-ai/mcpb@2.1.2 pack "$stage" "$out"

# Pack succeeding is not proof the bundle runs: entry_point is a path inside the
# archive and a wrong one only shows up on install. Start the staged server and
# require a handshake response before calling the build good.
if ! printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"bundle-smoke","version":"0"}}}' \
  | ENTYRIX_API_KEY=smoke-test node "$stage/dist/index.js" 2>/dev/null \
  | grep -q '"serverInfo"'; then
  echo "staged server did not answer initialize — bundle is broken" >&2
  exit 1
fi

rm -rf "$stage"
echo "built $out ($(du -h "$out" | cut -f1))"
