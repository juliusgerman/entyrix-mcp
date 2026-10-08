/**
 * Live contract: the bridge against the REAL remote server.
 *
 * Kept out of `npm test` (offline) — see vitest.contract.config.ts. It needs no
 * secret on purpose: discovery and tools/list are public, so the job cannot
 * silently skip and show a green tick covering nothing. If entyrix.com is
 * unreachable this goes RED.
 */
import { describe, it, expect } from "vitest";
import { Bridge } from "./lib/bridge.js";

const br = new Bridge({
  apiKey: undefined,
  baseUrl: process.env.ENTYRIX_BASE_URL ?? "https://entyrix.com",
  timeoutMs: 30000,
  userAgent: "entyrix-mcp/contract",
});

describe("bridge ↔ live server", () => {
  it("initialize → tools/list round-trips and every tool is read-only with a closed schema", async () => {
    const init = JSON.parse(
      (
        await br.handleLine(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
              protocolVersion: "2025-06-18",
              capabilities: {},
              clientInfo: { name: "contract", version: "1" },
            },
          })
        )
      )[0]!
    );
    expect(init.result.protocolVersion).toBe("2025-06-18");
    const list = JSON.parse(
      (await br.handleLine(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" })))[0]!
    );
    const tools = list.result.tools as Array<{
      name: string;
      inputSchema: { additionalProperties?: boolean };
      annotations?: { readOnlyHint?: boolean };
    }>;
    expect(tools.length).toBeGreaterThanOrEqual(10);
    for (const t of tools) {
      expect(t.inputSchema.additionalProperties, t.name).toBe(false);
      expect(t.annotations?.readOnlyHint, t.name).toBe(true);
    }
  });

  it("a data tool without a key asks for ENTYRIX_API_KEY instead of failing opaquely", async () => {
    const out = JSON.parse(
      (
        await br.handleLine(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 3,
            method: "tools/call",
            params: { name: "lookup_company", arguments: { ico: "35757442", country: "SK" } },
          })
        )
      )[0]!
    );
    expect(out.error.message).toMatch(/ENTYRIX_API_KEY/);
  });
});
