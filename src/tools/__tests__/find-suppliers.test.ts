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

  it("declares only params the contracts route reads", () => {
    // `offset` was measured dead on 2026-08-10 (`limit=2&offset=0` and
    // `limit=2&offset=3` returned the SAME first contract) and removed; the
    // route gained real paging the same day, so it is back — and verified
    // live, not assumed: offsets 0 and 3 now return disjoint rows and
    // `pagination.total` reports 764 for Slovnaft, 264 past the `limit` cap.
    //
    // Asserting the SET rather than one name on purpose. The version before
    // last pinned `offset=20` as forwarded, i.e. it asserted the defect was
    // the contract; a test that says a param is sent proves nothing about
    // whether anything reads it.
    expect(Object.keys(findSuppliersInputSchema).sort()).toEqual([
      "ico",
      "limit",
      "offset",
      "years",
    ]);
  });

  it("calls /companies/<ico>/contracts with the params the route reads", async () => {
    getMockPool()
      .intercept({
        path: "/api/v1/companies/31322832/contracts?limit=10&years=3&offset=20",
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
      .handler({ ico: "31322832", limit: 10, years: "3", offset: 20 });
    const body = JSON.parse(out.content[0].text);
    expect(body.data[0].value_eur).toBe(50000);
  });
});
