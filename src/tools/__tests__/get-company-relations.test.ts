import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { EntyrixClient } from "../../lib/client.js";
import { registerGetCompanyRelations } from "../get-company-relations.js";
import {
  createCaptureServer,
  setupMockAgent,
  teardownMockAgent,
  getMockPool,
  TEST_BASE_URL,
} from "./_harness.js";

describe("get_company_relations tool", () => {
  beforeAll(() => setupMockAgent());
  afterAll(async () => await teardownMockAgent());

  it("pads 6-digit IČO and hits the /relations sub-route", async () => {
    getMockPool()
      .intercept({ path: "/api/v1/companies/00123456/relations", method: "GET" })
      .reply(
        200,
        {
          data: {
            ico: "00123456",
            directors: [],
            shareholders: [],
            beneficialOwners: [
              {
                firstName: "Richard",
                lastName: "Marko",
                dateOfBirth: "1973",
                isCurrent: true,
                source: "rpvs",
              },
            ],
          },
          meta: {},
        },
        { headers: { "content-type": "application/json" } }
      );
    const client = new EntyrixClient({ apiKey: "k", baseUrl: TEST_BASE_URL });
    const { server, tools } = createCaptureServer();
    registerGetCompanyRelations(server as any, client);
    const out = await tools.get("get_company_relations")!.handler({ ico: "123456" });
    const body = JSON.parse(out.content[0].text);
    expect(body.data.ico).toBe("00123456");
    expect(body.data.beneficialOwners[0].source).toBe("rpvs");
  });
});
