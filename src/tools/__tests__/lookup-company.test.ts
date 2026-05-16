import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { EntyrixClient } from "../../lib/client.js";
import { registerLookupCompany } from "../lookup-company.js";
import {
  createCaptureServer,
  setupMockAgent,
  teardownMockAgent,
  getMockPool,
  TEST_BASE_URL,
} from "./_harness.js";

describe("lookup_company tool", () => {
  beforeAll(() => setupMockAgent());
  afterAll(async () => await teardownMockAgent());

  it("defaults country to SK and calls /companies/SK/<ico>", async () => {
    getMockPool()
      .intercept({ path: "/api/v1/companies/SK/31322832", method: "GET" })
      .reply(
        200,
        {
          data: { ico: "31322832", country_code: "SK", name: "SLOVNAFT, a.s." },
          meta: { request_id: "r1" },
        },
        { headers: { "content-type": "application/json" } }
      );
    const client = new EntyrixClient({ apiKey: "k", baseUrl: TEST_BASE_URL });
    const { server, tools } = createCaptureServer();
    registerLookupCompany(server as any, client);
    const out = await tools.get("lookup_company")!.handler({ ico: "31322832" });
    const body = JSON.parse(out.content[0].text);
    expect(body.data.country_code).toBe("SK");
  });

  it("routes AT Firmenbuch numbers to /companies/AT/<fnr> verbatim", async () => {
    getMockPool()
      .intercept({ path: "/api/v1/companies/AT/187a", method: "GET" })
      .reply(
        200,
        { data: { ico: "187a", country_code: "AT" }, meta: {} },
        { headers: { "content-type": "application/json" } }
      );
    const client = new EntyrixClient({ apiKey: "k", baseUrl: TEST_BASE_URL });
    const { server, tools } = createCaptureServer();
    registerLookupCompany(server as any, client);
    await tools.get("lookup_company")!.handler({ ico: "187a", country: "at" });
  });

  it("propagates API errors with status + code", async () => {
    getMockPool()
      .intercept({ path: "/api/v1/companies/SK/99999999", method: "GET" })
      .reply(
        404,
        {
          error: { code: "NOT_FOUND", message: "Firma SK/99999999 nenájdená" },
          meta: { request_id: "r2" },
        },
        { headers: { "content-type": "application/json" } }
      );
    const client = new EntyrixClient({ apiKey: "k", baseUrl: TEST_BASE_URL });
    const { server, tools } = createCaptureServer();
    registerLookupCompany(server as any, client);
    await expect(tools.get("lookup_company")!.handler({ ico: "99999999" })).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });
});
