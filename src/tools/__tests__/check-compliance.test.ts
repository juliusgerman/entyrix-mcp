import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { EntyrixClient } from "../../lib/client.js";
import { registerCheckCompliance } from "../check-compliance.js";
import {
  createCaptureServer,
  setupMockAgent,
  teardownMockAgent,
  getMockPool,
  TEST_BASE_URL,
} from "./_harness.js";

describe("check_compliance tool", () => {
  beforeAll(() => setupMockAgent());
  afterAll(async () => await teardownMockAgent());

  it("calls /public/check/<ico>.json", async () => {
    getMockPool()
      .intercept({ path: "/api/v1/public/check/31322832.json", method: "GET" })
      .reply(
        200,
        {
          data: {
            ico: "31322832",
            sanctioned: false,
            in_debtor_list: false,
            in_bankruptcy: false,
            rpvs_listed: true,
          },
          meta: {},
        },
        { headers: { "content-type": "application/json" } }
      );

    const client = new EntyrixClient({ apiKey: "k", baseUrl: TEST_BASE_URL });
    const { server, tools } = createCaptureServer();
    registerCheckCompliance(server as any, client);

    const out = await tools.get("check_compliance")!.handler({ ico: "31322832" });
    const body = JSON.parse(out.content[0].text);
    expect(body.data.rpvs_listed).toBe(true);
  });
});
