import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { EntyrixClient } from "../../lib/client.js";
import { registerAdvancedSearch } from "../advanced-search.js";
import {
  createCaptureServer,
  setupMockAgent,
  teardownMockAgent,
  getMockPool,
  TEST_BASE_URL,
} from "./_harness.js";

describe("advanced_search tool", () => {
  beforeAll(() => setupMockAgent());
  afterAll(async () => await teardownMockAgent());

  it("forwards every non-undefined filter as query params", async () => {
    // Order of URLSearchParams insertion is preserved.
    const expected =
      "/api/v1/companies/advanced-search?country_code=SK&nace_prefix=46%2C47&is_active=true&turnover_min=1000000&limit=20";
    getMockPool()
      .intercept({ path: expected, method: "GET" })
      .reply(
        200,
        { data: [], meta: { total: 0 } },
        { headers: { "content-type": "application/json" } }
      );

    const client = new EntyrixClient({ apiKey: "k", baseUrl: TEST_BASE_URL });
    const { server, tools } = createCaptureServer();
    registerAdvancedSearch(server as any, client);

    const out = await tools.get("advanced_search")!.handler({
      country_code: "SK",
      nace_prefix: "46,47",
      is_active: true,
      turnover_min: 1000000,
      limit: 20,
    });
    const body = JSON.parse(out.content[0].text);
    expect(body.data).toEqual([]);
  });
});
