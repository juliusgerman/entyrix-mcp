import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { EntyrixClient } from "../../lib/client.js";
import { registerGetCompanyNetwork } from "../get-company-network.js";
import {
  createCaptureServer,
  setupMockAgent,
  teardownMockAgent,
  getMockPool,
  TEST_BASE_URL,
} from "./_harness.js";

describe("get_company_network tool", () => {
  beforeAll(() => setupMockAgent());
  afterAll(async () => await teardownMockAgent());

  it("pads 6-digit IČO and hits the /network sub-route", async () => {
    getMockPool()
      .intercept({ path: "/api/v1/companies/00123456/network", method: "GET" })
      .reply(
        200,
        {
          data: {
            ico: "00123456",
            people: [{ name: "F. Novák", role: "statutory", connectedCompanies: 2 }],
            connections: [
              {
                personName: "F. Novák",
                roleInSource: "statutory",
                companies: [
                  { ico: "31322832", name: "Iná s.r.o.", roles: ["statutory"], isActive: true },
                ],
              },
            ],
          },
          meta: {},
        },
        { headers: { "content-type": "application/json" } }
      );
    const client = new EntyrixClient({ apiKey: "k", baseUrl: TEST_BASE_URL });
    const { server, tools } = createCaptureServer();
    registerGetCompanyNetwork(server as any, client);
    const out = await tools.get("get_company_network")!.handler({ ico: "123456" });
    const body = JSON.parse(out.content[0].text);
    expect(body.data.ico).toBe("00123456");
    expect(body.data.connections[0].companies[0].ico).toBe("31322832");
  });

  it("passes an attested purpose through as ?purpose=", async () => {
    getMockPool()
      .intercept({
        path: "/api/v1/companies/00123456/network",
        query: { purpose: "kyc" },
        method: "GET",
      })
      .reply(
        200,
        { data: { ico: "00123456", people: [], connections: [] }, meta: {} },
        { headers: { "content-type": "application/json" } }
      );
    const client = new EntyrixClient({ apiKey: "k", baseUrl: TEST_BASE_URL });
    const { server, tools } = createCaptureServer();
    registerGetCompanyNetwork(server as any, client);
    const out = await tools.get("get_company_network")!.handler({ ico: "123456", purpose: "kyc" });
    const body = JSON.parse(out.content[0].text);
    expect(body.data.ico).toBe("00123456");
  });
});
