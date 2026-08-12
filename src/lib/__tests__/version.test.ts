/**
 * The version constant against every manifest that repeats it.
 *
 * Offline and cheap on purpose: this is the guard that lets VERSION stay a
 * constant instead of a runtime package.json read. If a release bumps
 * package.json and forgets server.json (or the reverse), the MCP registry would
 * publish a manifest pointing at an npm version that does not exist — and
 * nothing at runtime would notice, because the handshake and the User-Agent are
 * write-only from the server's point of view.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { VERSION } from "../version.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const read = (f: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(root, f), "utf8")) as Record<string, unknown>;

describe("VERSION", () => {
  it("looks like a semver release", () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/);
  });

  it("matches package.json", () => {
    expect(read("package.json").version).toBe(VERSION);
  });

  it("matches both version fields in server.json", () => {
    const s = read("server.json") as {
      version: string;
      packages: Array<{ version: string; identifier: string }>;
    };
    expect(s.version).toBe(VERSION);
    // The npm package entry carries its own version; the MCP registry resolves
    // it against the real npm tarball, so a stale one is a broken listing.
    for (const p of s.packages) expect(p.version).toBe(VERSION);
  });

  it("matches the MCPB manifest", () => {
    // Third manifest repeating the same string. `scripts/bundle.sh` refuses to
    // build on a mismatch, but that check only fires when someone runs the
    // bundle — which is once per release at best. A bundle whose manifest
    // claims a different version than the code inside it installs cleanly and
    // reports the wrong build forever.
    expect(read("manifest.json").version).toBe(VERSION);
  });

  it("server.json points at the package this repo actually publishes", () => {
    const s = read("server.json") as { packages: Array<{ identifier: string }> };
    const pkg = read("package.json") as { name: string };
    for (const p of s.packages) expect(p.identifier).toBe(pkg.name);
  });
  it("carries the mcpName the official registry validates ownership with", () => {
    // The registry's npm validator fetches this package's version metadata and
    // refuses the server unless package.json's `mcpName` equals server.json's
    // `name` — see internal/validators/registries/npm.go in
    // modelcontextprotocol/registry. Missing it means the directory submission
    // fails, and since npm metadata comes from the tarball, fixing it costs a
    // republish. Cheaper to assert here.
    const pkg = read("package.json") as { mcpName?: string };
    const server = read("server.json") as { name: string };
    expect(pkg.mcpName).toBe(server.name);
    expect(pkg.mcpName).toMatch(/^io\.github\.[\w-]+\/[\w.-]+$/);
  });
  it("the npm coordinate is the org-scoped one, and mcpName is NOT", () => {
    // Two names that look alike and are not: the npm package moved under the
    // `entyrix` org on 2026-08-11, while the MCP registry namespace stays
    // GitHub-derived and must keep the repo's name. Renaming one and not the
    // other passes every other check here and fails at directory submission.
    const pkg = read("package.json") as {
      name: string;
      mcpName: string;
      bin: Record<string, string>;
    };
    expect(pkg.name).toBe("@entyrix/mcp");
    expect(pkg.mcpName).toBe("io.github.juliusgerman/entyrix-mcp");
    // The installed command is unaffected by the scope — users still type this.
    expect(Object.keys(pkg.bin)).toEqual(["entyrix-mcp"]);
  });
  it("keeps server.json's description inside the registry's 100-char limit", () => {
    // The registry rejects a publish with 422 / "expected length <= 100" on
    // body.description. Found the hard way on 2026-08-11: the first publish
    // attempt failed on a 150-character description that reads fine everywhere
    // else. package.json's description is NOT bound by this — only the one the
    // registry ingests — so the two are deliberately different lengths.
    const server = read("server.json") as { description: string };
    expect(server.description.length).toBeLessThanOrEqual(100);
    expect(server.description.length).toBeGreaterThan(20);
  });
});
