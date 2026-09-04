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

  it("tells the model that null means withheld, not cleared", () => {
    // The description is the whole contract with the caller here. This tool is
    // the PUBLIC tier: for a natural person the API withholds the address, the
    // tax IDs and the entire compliance assessment. Until 2026-09-04 the API
    // published `tier: "STANDARD"` and `isSanctioned: false` for those subjects
    // — the cleanest possible verdict about someone it never assessed — and a
    // model reading this tool had nothing to warn it. Both halves are fixed;
    // this pins the half that lives in the kit, because a future rewrite of the
    // blurb for brevity would silently take the warning out again.
    const client = new EntyrixClient({ apiKey: "k", baseUrl: TEST_BASE_URL });
    const { server, tools } = createCaptureServer();
    registerCheckCompliance(server as any, client);
    const { description } = tools.get("check_compliance")!;

    expect(description).toMatch(/withheld/i);
    expect(description).toMatch(/null/i);
    expect(description).toMatch(/redaction\.applied/);
    // And it must point at the surface that does have the answer, otherwise
    // "we won't tell you" is the end of the road for the caller.
    expect(description).toMatch(/get_company_details/);
  });
});
