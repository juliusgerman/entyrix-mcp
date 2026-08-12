/**
 * `advanced_search` must honour `country` as well as `country_code`.
 *
 * Measured 2026-08-12 against a freshly spawned server with the real API key:
 * `advanced_search({ country: "sk", limit: 2 })` came back with companies in
 * Île-de-France. Zod strips an undeclared key before the query object is built,
 * so `country` never reached the wire — and because the API never saw it, the
 * `data.unknownFilters` guard added two days earlier could not report it. The
 * caller got a complete, plausible, default-sorted answer to a question they
 * did not ask.
 *
 * The cause is an inconsistency, not a typo: every other tool on this server
 * takes `country`, and only this one takes `country_code`. An agent writing
 * `country` here is doing the reasonable thing.
 *
 * These tests pin the FOLD, not just the declaration — a declared-but-ignored
 * alias would be the same bug wearing a schema entry.
 */
import { describe, it, expect, vi } from "vitest";
import { registerAdvancedSearch, advancedSearchInputSchema } from "../advanced-search.js";
import type { EntyrixClient } from "../../lib/client.js";

/** Captures the query object the tool hands to the client. */
function harness() {
  const seen: Array<Record<string, unknown>> = [];
  const client = {
    get: vi.fn(async (_path: string, query?: Record<string, unknown>) => {
      seen.push(query ?? {});
      return { data: { results: [], unknownFilters: [] } };
    }),
  } as unknown as EntyrixClient;

  let handler: ((args: Record<string, unknown>) => Promise<unknown>) | null = null;
  const server = {
    registerTool: (_n: string, _c: unknown, h: (a: Record<string, unknown>) => Promise<unknown>) => {
      handler = h;
    },
  } as never;

  registerAdvancedSearch(server, client);
  if (!handler) throw new Error("tool did not register");
  return { seen, call: handler as (a: Record<string, unknown>) => Promise<unknown> };
}

describe("advanced_search country alias", () => {
  it("declares `country` — otherwise zod strips it before the handler runs", () => {
    expect(Object.keys(advancedSearchInputSchema)).toContain("country");
    expect(Object.keys(advancedSearchInputSchema)).toContain("country_code");
  });

  it("folds `country` into `country_code` on the wire", async () => {
    const { seen, call } = harness();
    await call({ country: "sk", limit: 2 });
    expect(seen[0]!.country_code).toBe("sk");
  });

  it("does NOT put the alias itself on the wire", async () => {
    // Sending an unrecognised key would light up the API's unknownFilters for
    // something that is working as intended — turning a real guard into noise.
    const { seen, call } = harness();
    await call({ country: "sk" });
    expect(seen[0]!).not.toHaveProperty("country");
  });

  it("explicit country_code wins over the alias", async () => {
    const { seen, call } = harness();
    await call({ country: "sk", country_code: "cz" });
    expect(seen[0]!.country_code).toBe("cz");
  });

  it("leaves the query alone when neither is given", async () => {
    const { seen, call } = harness();
    await call({ limit: 5 });
    expect(seen[0]!).not.toHaveProperty("country_code");
    expect(seen[0]!).not.toHaveProperty("country");
  });
});
