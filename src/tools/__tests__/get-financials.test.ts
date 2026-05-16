import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { EntyrixClient } from "../../lib/client.js";
import { registerGetFinancials } from "../get-financials.js";
import {
  createCaptureServer,
  setupMockAgent,
  teardownMockAgent,
  getMockPool,
  TEST_BASE_URL,
} from "./_harness.js";

describe("get_financials tool", () => {
  beforeAll(() => setupMockAgent());
  afterAll(async () => await teardownMockAgent());

  it("truncates latestFinancials to N most-recent years", async () => {
    const allYears = [
      { financialYear: 2024, turnover: 5000000 },
      { financialYear: 2023, turnover: 4500000 },
      { financialYear: 2022, turnover: 4000000 },
      { financialYear: 2021, turnover: 3500000 },
      { financialYear: 2020, turnover: 3000000 },
      { financialYear: 2019, turnover: 2500000 },
    ];
    getMockPool()
      .intercept({ path: "/api/v1/companies/31322832", method: "GET" })
      .reply(
        200,
        { data: { ico: "31322832", latestFinancials: allYears }, meta: { request_id: "r" } },
        { headers: { "content-type": "application/json" } }
      );

    const client = new EntyrixClient({ apiKey: "k", baseUrl: TEST_BASE_URL });
    const { server, tools } = createCaptureServer();
    registerGetFinancials(server as any, client);

    const out = await tools.get("get_financials")!.handler({ ico: "31322832", years: 3 });
    const body = JSON.parse(out.content[0].text);
    expect(body.years_requested).toBe(3);
    expect(body.years_returned).toBe(3);
    expect(body.financials).toHaveLength(3);
    expect(body.financials[0].financialYear).toBe(2024);
  });

  it("defaults to 5 years when years omitted", async () => {
    getMockPool()
      .intercept({ path: "/api/v1/companies/00123456", method: "GET" })
      .reply(
        200,
        {
          data: {
            latestFinancials: Array.from({ length: 10 }, (_, i) => ({ financialYear: 2024 - i })),
          },
          meta: {},
        },
        { headers: { "content-type": "application/json" } }
      );
    const client = new EntyrixClient({ apiKey: "k", baseUrl: TEST_BASE_URL });
    const { server, tools } = createCaptureServer();
    registerGetFinancials(server as any, client);
    const out = await tools.get("get_financials")!.handler({ ico: "123456" });
    const body = JSON.parse(out.content[0].text);
    expect(body.years_returned).toBe(5);
  });
});
