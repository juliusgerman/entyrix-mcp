import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { EntyrixClient } from "../../lib/client.js";
import { registerFindSuppliers, findSuppliersInputSchema } from "../find-suppliers.js";
import {
  createCaptureServer,
  setupMockAgent,
  teardownMockAgent,
  getMockPool,
  TEST_BASE_URL,
} from "./_harness.js";

describe("find_suppliers tool", () => {
  beforeAll(() => setupMockAgent());
  afterAll(async () => await teardownMockAgent());

  it("does not declare offset — the contracts route ignores it", () => {
    // Measured against the live API on 2026-08-10: `limit=2&offset=0` and
    // `limit=2&offset=3` returned the SAME first contract. The route reads
    // `limit` and `years`, nothing else. Declaring a pagination parameter the
    // server drops is worse than having none: an agent walking pages re-reads
    // page one indefinitely and concludes the supplier has few contracts.
    // The previous version of this test asserted `offset=20` was forwarded,
    // pinning the defect as if it were the contract.
    expect(Object.keys(findSuppliersInputSchema)).not.toContain("offset");
  });

  it("calls /companies/<ico>/contracts with the params the route reads", async () => {
    getMockPool()
      .intercept({
        path: "/api/v1/companies/31322832/contracts?limit=10&years=3",
        method: "GET",
      })
      .reply(
        200,
        { data: [{ id: "c1", value_eur: 50000 }], meta: { total: 1 } },
        { headers: { "content-type": "application/json" } }
      );

    const client = new EntyrixClient({ apiKey: "k", baseUrl: TEST_BASE_URL });
    const { server, tools } = createCaptureServer();
    registerFindSuppliers(server as any, client);

    const out = await tools
      .get("find_suppliers")!
      .handler({ ico: "31322832", limit: 10, years: "3" });
    const body = JSON.parse(out.content[0].text);
    expect(body.data[0].value_eur).toBe(50000);
  });
});
