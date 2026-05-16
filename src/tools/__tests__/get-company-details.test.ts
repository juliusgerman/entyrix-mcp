import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { EntyrixClient } from "../../lib/client.js";
import { registerGetCompanyDetails } from "../get-company-details.js";
import {
  createCaptureServer,
  setupMockAgent,
  teardownMockAgent,
  getMockPool,
  TEST_BASE_URL,
} from "./_harness.js";

describe("get_company_details tool", () => {
  beforeAll(() => setupMockAgent());
  afterAll(async () => await teardownMockAgent());

  it("pads 6-digit IČO with leading zeros", async () => {
    getMockPool()
      .intercept({ path: "/api/v1/companies/00123456", method: "GET" })
      .reply(
        200,
        { data: { ico: "00123456", name: "Test s.r.o.", latestFinancials: [] }, meta: {} },
        { headers: { "content-type": "application/json" } }
      );
    const client = new EntyrixClient({ apiKey: "k", baseUrl: TEST_BASE_URL });
    const { server, tools } = createCaptureServer();
    registerGetCompanyDetails(server as any, client);
    const out = await tools.get("get_company_details")!.handler({ ico: "123456" });
    const body = JSON.parse(out.content[0].text);
    expect(body.data.ico).toBe("00123456");
  });
});
