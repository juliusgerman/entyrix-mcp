import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { z } from "zod";
import { EntyrixClient } from "../../lib/client.js";
import {
  registerListRankings,
  listRankingsInputSchema,
  SUPPORTED_RANKING_SLUGS,
} from "../list-rankings.js";
import {
  createCaptureServer,
  setupMockAgent,
  teardownMockAgent,
  getMockPool,
  TEST_BASE_URL,
} from "./_harness.js";

describe("list_rankings tool", () => {
  beforeAll(() => setupMockAgent());
  afterAll(async () => await teardownMockAgent());

  it("calls /public/rankings/<slug>.json for a supported slug", async () => {
    getMockPool()
      .intercept({ path: "/api/v1/public/rankings/largest.json", method: "GET" })
      .reply(
        200,
        {
          data: [{ rank: 1, ico: "31322832", name: "SLOVNAFT, a.s.", turnover: 2_500_000_000 }],
          meta: { snapshot_at: "2026-05-15T03:00:00Z" },
        },
        { headers: { "content-type": "application/json" } }
      );

    const client = new EntyrixClient({ apiKey: "k", baseUrl: TEST_BASE_URL });
    const { server, tools } = createCaptureServer();
    registerListRankings(server as any, client);
    const out = await tools.get("list_rankings")!.handler({ key: "largest" });
    const body = JSON.parse(out.content[0].text);
    expect(body.data[0].rank).toBe(1);
  });

  // Schema ↔ route contract: the API serves exactly these slugs (whitelist in
  // the Entyrix repo, src/api/routes/public.ts `/public/rankings/:key.json`).
  // Advertising anything else (e.g. the retired 'top-turnover-sk',
  // 'top-employers-cz', 'fastest-growing-sk') makes live MCP calls 404.
  it("schema enum equals the route-supported slug set", () => {
    const enumValues = listRankingsInputSchema.key.options;
    expect([...enumValues].sort()).toEqual(
      ["largest", "most-viewed", "public-contracts", "shell-addresses"].sort()
    );
    expect([...enumValues].sort()).toEqual([...SUPPORTED_RANKING_SLUGS].sort());
  });

  it("schema rejects unsupported legacy slugs", () => {
    const schema = z.object(listRankingsInputSchema);
    for (const bad of ["top-turnover-sk", "top-employers-cz", "fastest-growing-sk"]) {
      expect(schema.safeParse({ key: bad }).success).toBe(false);
    }
    for (const good of SUPPORTED_RANKING_SLUGS) {
      expect(schema.safeParse({ key: good }).success).toBe(true);
    }
  });

  it("description and key description only advertise supported slugs", () => {
    const client = new EntyrixClient({ apiKey: "k", baseUrl: TEST_BASE_URL });
    const { server, tools } = createCaptureServer();
    registerListRankings(server as any, client);
    const tool = tools.get("list_rankings")!;
    const advertised = `${tool.description} ${listRankingsInputSchema.key.description ?? ""}`;
    for (const bad of ["top-turnover-sk", "top-employers-cz", "fastest-growing-sk"]) {
      expect(advertised).not.toContain(bad);
    }
    for (const good of SUPPORTED_RANKING_SLUGS) {
      expect(advertised).toContain(good);
    }
  });
});
