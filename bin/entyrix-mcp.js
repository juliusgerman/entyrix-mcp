#!/usr/bin/env node
// Thin shim — the real entry is compiled to ../dist/index.js.
// Using dynamic import keeps this file ESM-agnostic so it works whether the
// consumer's node resolves it via "bin" symlink or direct invocation.
import("../dist/index.js").catch((err) => {
  process.stderr.write(
    `[entyrix-mcp] failed to load dist/index.js — did you forget 'npm run build'?\n${err?.message ?? err}\n`
  );
  process.exit(1);
});
