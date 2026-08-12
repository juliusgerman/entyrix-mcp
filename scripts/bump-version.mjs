#!/usr/bin/env node
/**
 * Bump the version in every manifest that carries it, from one argument.
 *
 * The version lives in four files (package.json, manifest.json, server.json
 * twice, src/lib/version.ts) and `__tests__/version.test.ts` asserts they all
 * agree. That guard works — it went red on 2026-08-12 when a release commit
 * moved package.json to 0.1.4 and left version.ts on 0.1.3. But a guard that
 * fires on every release because the bump is manual is a guard people learn to
 * push past, so the fix belongs in the bump, not in the check.
 *
 *   npm run bump 0.1.5
 *
 * Writes nothing unless every target parses and every current value agrees —
 * a repo already mid-drift should be reconciled by hand, not papered over by a
 * tool that overwrites both sides without saying so.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const next = process.argv[2];

if (!next || !/^\d+\.\d+\.\d+$/.test(next)) {
  console.error("usage: npm run bump <major.minor.patch>   e.g. npm run bump 0.1.5");
  process.exit(2);
}

/** Every place the version is written, and how to read/replace it there. */
const targets = [
  {
    file: "package.json",
    read: (s) => JSON.parse(s).version,
    write: (s, v) => s.replace(/("version":\s*")[^"]+(")/, `$1${v}$2`),
  },
  {
    file: "manifest.json",
    read: (s) => JSON.parse(s).version,
    write: (s, v) => s.replace(/("version":\s*")[^"]+(")/, `$1${v}$2`),
  },
  {
    // server.json carries it twice: the server entry and the package entry.
    // Replacing only the first would publish a registry record pointing at an
    // npm version that does not exist yet.
    file: "server.json",
    read: (s) => {
      const all = [...s.matchAll(/"version":\s*"([^"]+)"/g)].map((m) => m[1]);
      if (all.length < 2) throw new Error("expected at least two version fields");
      if (new Set(all).size !== 1) throw new Error(`version fields disagree: ${all.join(", ")}`);
      return all[0];
    },
    write: (s, v) => s.replace(/("version":\s*")[^"]+(")/g, `$1${v}$2`),
  },
  {
    file: "src/lib/version.ts",
    read: (s) => s.match(/export const VERSION = "([^"]+)"/)?.[1],
    write: (s, v) => s.replace(/(export const VERSION = ")[^"]+(")/, `$1${v}$2`),
  },
];

const current = [];
for (const t of targets) {
  const raw = readFileSync(join(root, t.file), "utf8");
  const v = t.read(raw);
  if (!v) {
    console.error(`✗ ${t.file}: no version found — the file shape changed, fix the bumper`);
    process.exit(1);
  }
  current.push({ ...t, raw, v });
}

const distinct = new Set(current.map((c) => c.v));
if (distinct.size !== 1) {
  console.error("✗ manifests already disagree — reconcile by hand before bumping:");
  for (const c of current) console.error(`    ${c.v}  ${c.file}`);
  process.exit(1);
}

const from = current[0].v;
if (from === next) {
  console.error(`✗ already at ${next}`);
  process.exit(1);
}

for (const c of current) writeFileSync(join(root, c.file), c.write(c.raw, next));

console.log(`${from} → ${next}`);
for (const c of current) console.log(`  ${c.file}`);
console.log(`\nnext:  npm run check  &&  git commit -am "chore(release): ${next}"`);
console.log(`       git tag v${next} && git push && git push --tags`);
