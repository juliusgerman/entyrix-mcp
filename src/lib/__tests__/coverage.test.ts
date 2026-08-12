/**
 * Every in-repo restatement of the market coverage, against the constant.
 *
 * Written after a sweep on 2026-08-12 found the count stated four different
 * ways at once: `search_companies` told models the coverage was seven named
 * countries, the GitHub About field said "16+ EU jurisdictions", the published
 * MCP registry manifest said "16+ European business registries", and the npm
 * README said "16+ jurisdictions, growing" — while README.md in the working
 * tree already said 23. Nothing failed; the repo just disagreed with itself in
 * five places, and the three that were published disagreed with the two that
 * were not.
 *
 * The tool description is the expensive one. It is prompt text, so a stale
 * market list does not merely misinform a reader — it narrows what the model
 * will attempt.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { MARKET_COUNT, MARKET_LIST, MARKETS } from "../coverage.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/**
 * Prose and manifests that a user or a model can read. `src/lib/coverage.ts` is
 * where the numbers legitimately live; tests carry deliberate counterexamples.
 */
function surfaces(): string[] {
  const out = ["README.md", "SUBMISSION.md", "package.json", "server.json"].map((f) =>
    join(root, f)
  );
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        if (name === "__tests__") continue;
        walk(p);
        continue;
      }
      if (!p.endsWith(".ts")) continue;
      if (p.endsWith(join("lib", "coverage.ts"))) continue;
      out.push(p);
    }
  };
  walk(join(root, "src"));
  return out;
}

const files = surfaces().map((p) => ({ p: relative(root, p), s: readFileSync(p, "utf8") }));

describe("coverage claims stay in sync with the constant", () => {
  it("has files to check (an empty sweep must not read as a clean one)", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  // "23 live markets", "23 European business registries", "16+ EU jurisdictions".
  // The filler between the number and the noun is an explicit allow-list rather
  // than `\w+{0,3}`: a loose gap swallows unrelated sentences and a guard that
  // cries wolf stops being read.
  const CLAIM =
    /\b(\d{1,3})\+?\s+(?:(?:live|European|EU|business|national|company|official)\s+){0,3}(markets?|jurisdictions?|registries|registers|countries)\b/gi;

  it("no surface states a market count other than MARKET_COUNT", () => {
    const bad: string[] = [];
    for (const { p, s } of files) {
      for (const m of s.matchAll(CLAIM)) {
        if (Number(m[1]) !== MARKET_COUNT) bad.push(`${p}: "${m[0]}"`);
      }
    }
    expect(bad, `stale counts (expected ${MARKET_COUNT}):\n${bad.join("\n")}`).toEqual([]);
  });

  it("every enumeration of country codes matches MARKET_LIST exactly", () => {
    // A partial list is how "SK, CZ, AT, EE, SI, LV, UK" survived three
    // releases: it reads as an example, and it is consumed as the boundary.
    const bad: string[] = [];
    for (const { p, s } of files) {
      for (const m of s.matchAll(/\b(?:[A-Z]{2},\s*){4,}[A-Z]{2}\b/g)) {
        if (m[0].replace(/\s+/g, " ") !== MARKET_LIST) bad.push(`${p}: "${m[0].slice(0, 70)}…"`);
      }
    }
    expect(bad, `country lists that drifted from MARKET_LIST:\n${bad.join("\n")}`).toEqual([]);
  });

  it("MARKETS has MARKET_COUNT distinct ISO-3166 alpha-2 entries", () => {
    expect(MARKETS).toHaveLength(MARKET_COUNT);
    expect(new Set(MARKETS).size).toBe(MARKET_COUNT);
    for (const c of MARKETS) expect(c).toMatch(/^[A-Z]{2}$/);
  });
});
