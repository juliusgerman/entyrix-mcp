import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { EntyrixClient } from "../../lib/client.js";
import { registerListRankings } from "../list-rankings.js";
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

  it("calls /public/rankings/<slug>.json and lowercases slug", async () => {
    getMockPool()
      .intercept({ path: "/api/v1/public/rankings/top-turnover-sk.json", method: "GET" })
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
    const out = await tools.get("list_rankings")!.handler({ key: "Top-Turnover-SK" });
    const body = JSON.parse(out.content[0].text);
    expect(body.data[0].rank).toBe(1);
  });
});
