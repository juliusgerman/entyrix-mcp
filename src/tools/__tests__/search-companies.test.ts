import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { EntyrixClient } from "../../lib/client.js";
import { registerSearchCompanies } from "../search-companies.js";
import {
  createCaptureServer,
  setupMockAgent,
  teardownMockAgent,
  getMockPool,
  TEST_BASE_URL,
} from "./_harness.js";

describe("search_companies tool", () => {
  beforeAll(() => {
    setupMockAgent();
  });
  afterAll(async () => {
    await teardownMockAgent();
  });
  afterEach(() => {
    // each test recreates intercepts; nothing to clean here
  });

  it("calls /companies/autocomplete with Bearer auth + country filter", async () => {
    const pool = getMockPool();
    pool
      .intercept({
        path: "/api/v1/companies/autocomplete?q=slovnaft&country=SK&limit=5",
        method: "GET",
        headers: (h) =>
          (h["authorization"] ?? h["Authorization"]) === "Bearer test-key" &&
          (h["accept"] ?? h["Accept"]) === "application/json",
      })
      .reply(
        200,
        {
          data: [{ ico: "31322832", name: "SLOVNAFT, a.s.", country_code: "SK", isActive: true }],
          meta: { request_id: "test-req-1", duration_ms: 12, query: "slovnaft" },
        },
        { headers: { "content-type": "application/json" } }
      );

    const client = new EntyrixClient({ apiKey: "test-key", baseUrl: TEST_BASE_URL });
    const { server, tools } = createCaptureServer();
    registerSearchCompanies(server as any, client);

    const tool = tools.get("search_companies")!;
    expect(tool).toBeDefined();
    expect(tool.description).toMatch(/autocomplete/i);
    expect(tool.description).toMatch(/typo-tolerance/i);

    const result = await tool.handler({ q: "slovnaft", country: "SK", limit: 5 });
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    const body = JSON.parse(result.content[0].text);
    expect(body.data[0].ico).toBe("31322832");
    expect(body.meta.duration_ms).toBe(12);
  });

  it("uppercases country code", async () => {
    const pool = getMockPool();
    pool
      .intercept({
        path: "/api/v1/companies/autocomplete?q=abc&country=CZ",
        method: "GET",
      })
      .reply(200, { data: [], meta: {} }, { headers: { "content-type": "application/json" } });

    const client = new EntyrixClient({ apiKey: "k", baseUrl: TEST_BASE_URL });
    const { server, tools } = createCaptureServer();
    registerSearchCompanies(server as any, client);
    await tools.get("search_companies")!.handler({ q: "abc", country: "cz" });
    // If country wasn't uppercased the intercept wouldn't match → fetch throws.
  });
});
