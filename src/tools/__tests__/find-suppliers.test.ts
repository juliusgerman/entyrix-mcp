import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { EntyrixClient } from "../../lib/client.js";
import { registerFindSuppliers } from "../find-suppliers.js";
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

  it("calls /companies/<ico>/contracts with pagination", async () => {
    getMockPool()
      .intercept({
        path: "/api/v1/companies/31322832/contracts?limit=10&offset=20",
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
      .handler({ ico: "31322832", limit: 10, offset: 20 });
    const body = JSON.parse(out.content[0].text);
    expect(body.data[0].value_eur).toBe(50000);
  });
});
