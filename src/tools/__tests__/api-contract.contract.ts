/**
 * Contract check: every query key this server EMITS must be a key the Entyrix
 * API actually declares.
 *
 * This is the guard for the failure that cost the most here. The API drops a
 * query key it does not recognise — silently, with a 200 and a complete,
 * default-sorted body. On 2026-08-10 nine filter names in `advanced_search`
 * were in that hole and had been for months: "active SK companies founded
 * after 2020, sorted by name" answered with the whole country ordered by
 * turnover, and nothing anywhere said otherwise. An agent cannot detect that;
 * neither can a unit test with a mocked server, because the mock happily
 * accepts whatever the client sends.
 *
 * So the assertion is made against the live published spec
 * (`/api/v1/public/openapi.json`, unauthenticated — no secret, therefore no
 * secret-gated job that silently skips and shows a green tick covering
 * nothing).
 *
 * WHAT IS ASSERTED, and in which direction:
 *
 *   emitted ⊆ declared     A key we send that the spec does not declare is
 *                          either dropped by the API or undocumented. Both are
 *                          defects and both are ours to chase.
 *
 *   declared ⊄ emitted     Deliberately NOT asserted. Exposing a subset of the
 *                          API through MCP is a design choice, not drift.
 *
 * The emitted set is taken from the real handler by capturing the outgoing
 * request, not from the declared zod schema — a schema key that the handler
 * renames or forgets to pass on is precisely the bug class, so reading the
 * declaration would be reading the wrong side of it.
 *
 * Run: `npm run test:contract` (separate from `npm test`, which stays offline).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { EntyrixClient } from "../../lib/client.js";
import {
  createCaptureServer,
  setupMockAgent,
  teardownMockAgent,
  getMockPool,
  TEST_BASE_URL,
  type CapturedTool,
} from "./_harness.js";

import { registerSearchCompanies, searchCompaniesInputSchema } from "../search-companies.js";
import { registerLookupCompany, lookupCompanyInputSchema } from "../lookup-company.js";
import { registerGetCompanyDetails, getCompanyDetailsInputSchema } from "../get-company-details.js";
import { registerGetCompanyNetwork, getCompanyNetworkInputSchema } from "../get-company-network.js";
import {
  registerGetCompanyRelations,
  getCompanyRelationsInputSchema,
} from "../get-company-relations.js";
import { registerAdvancedSearch, advancedSearchInputSchema } from "../advanced-search.js";
import { registerCheckCompliance, checkComplianceInputSchema } from "../check-compliance.js";
import { registerGetFinancials, getFinancialsInputSchema } from "../get-financials.js";
import { registerFindSuppliers, findSuppliersInputSchema } from "../find-suppliers.js";
import { registerListRankings, listRankingsInputSchema } from "../list-rankings.js";

const SPEC_URL = "https://entyrix.com/api/v1/public/openapi.json";

/**
 * tool name → the templated spec path it hits.
 *
 * Explicit rather than derived: if a tool is repointed at another endpoint,
 * this table must be updated by hand, which is the moment to ask whether the
 * new endpoint declares the same keys.
 */
const SPEC_PATH: Record<string, string> = {
  search_companies: "/api/v1/companies/autocomplete",
  lookup_company: "/api/v1/companies/lookup",
  get_company_details: "/api/v1/companies/{ico}",
  get_company_network: "/api/v1/companies/{ico}/network",
  get_company_relations: "/api/v1/companies/{ico}/relations",
  advanced_search: "/api/v1/companies/advanced-search",
  check_compliance: "/api/v1/public/check/{ico}.json",
  get_financials: "/api/v1/companies/{ico}",
  find_suppliers: "/api/v1/companies/{ico}/contracts",
  list_rankings: "/api/v1/public/rankings/{key}.json",
};

/**
 * Keys that never reach the wire: the handler consumes them client-side.
 * Each one has to earn its place here, because "it is client-side" is also
 * what a dropped key looks like from the outside.
 */
const CLIENT_SIDE: Record<string, string[]> = {
  // `years` slices the statements array after the response arrives.
  get_financials: ["years"],
};

// ─── sample values, derived from the zod schema so new keys are covered ───

type ZodLike = { _def?: { typeName?: string; innerType?: ZodLike; values?: unknown[] } };

function sampleFor(schema: unknown, key: string): unknown {
  const def = (schema as ZodLike)?._def;
  const t = def?.typeName;
  if (t === "ZodOptional" || t === "ZodNullable" || t === "ZodDefault" || t === "ZodEffects") {
    return sampleFor(def?.innerType ?? (def as { schema?: ZodLike })?.schema, key);
  }
  if (t === "ZodEnum" || t === "ZodNativeEnum") {
    const vals = def?.values as unknown[] | Record<string, unknown> | undefined;
    const list = Array.isArray(vals) ? vals : Object.values(vals ?? {});
    return list[0];
  }
  if (t === "ZodNumber") return 1;
  if (t === "ZodBoolean") return true;
  // Strings: an 8-digit numeric is valid for every id-ish key we have and is
  // harmless for the rest, since nothing here reaches a real server.
  return /ico|national_id|id$/.test(key) ? "31322832" : "31322832";
}

function sampleArgs(schema: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema)) out[k] = sampleFor(v, k);
  return out;
}

interface Case {
  name: string;
  register: (s: unknown, c: EntyrixClient) => void;
  schema: Record<string, unknown>;
}

const CASES: Case[] = [
  {
    name: "search_companies",
    register: registerSearchCompanies as never,
    schema: searchCompaniesInputSchema,
  },
  {
    name: "lookup_company",
    register: registerLookupCompany as never,
    schema: lookupCompanyInputSchema,
  },
  {
    name: "get_company_details",
    register: registerGetCompanyDetails as never,
    schema: getCompanyDetailsInputSchema,
  },
  {
    name: "get_company_network",
    register: registerGetCompanyNetwork as never,
    schema: getCompanyNetworkInputSchema,
  },
  {
    name: "get_company_relations",
    register: registerGetCompanyRelations as never,
    schema: getCompanyRelationsInputSchema,
  },
  {
    name: "advanced_search",
    register: registerAdvancedSearch as never,
    schema: advancedSearchInputSchema,
  },
  {
    name: "check_compliance",
    register: registerCheckCompliance as never,
    schema: checkComplianceInputSchema,
  },
  {
    name: "get_financials",
    register: registerGetFinancials as never,
    schema: getFinancialsInputSchema,
  },
  {
    name: "find_suppliers",
    register: registerFindSuppliers as never,
    schema: findSuppliersInputSchema,
  },
  {
    name: "list_rankings",
    register: registerListRankings as never,
    schema: listRankingsInputSchema,
  },
];

let spec: { paths: Record<string, Record<string, { parameters?: Array<{ name: string }> }>> };
const emitted = new Map<string, Set<string>>();

async function fetchSpec(): Promise<typeof spec> {
  let last: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(SPEC_URL, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`spec fetch: HTTP ${res.status}`);
      return (await res.json()) as typeof spec;
    } catch (err) {
      last = err;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  // Loud, not skipped. A contract check that quietly passes when it could not
  // reach the thing it checks is the green tick this repo must not have.
  throw new Error(`could not fetch ${SPEC_URL}: ${String(last)}`);
}

describe("MCP tools against the published API spec", () => {
  beforeAll(async () => {
    spec = await fetchSpec();

    setupMockAgent();
    const pool = getMockPool();
    // Any path, any query — we only care what the client tried to request.
    pool
      .intercept({ path: () => true, method: "GET" })
      .reply(200, { data: {}, meta: {} })
      .persist();

    const client = new EntyrixClient({ apiKey: "test-key", baseUrl: TEST_BASE_URL });
    for (const c of CASES) {
      const { server, tools } = createCaptureServer();
      c.register(server, client);
      const tool = tools.get(c.name) as CapturedTool | undefined;
      if (!tool) throw new Error(`tool ${c.name} did not register`);
      const before = fetchedUrls.length;
      await tool.handler(sampleArgs(c.schema));
      const urls = fetchedUrls.slice(before);
      if (urls.length === 0) throw new Error(`tool ${c.name} issued no request`);
      const keys = new Set<string>();
      for (const u of urls) new URL(u).searchParams.forEach((_v, k) => keys.add(k));
      emitted.set(c.name, keys);
    }
  }, 60000);

  afterAll(async () => {
    await teardownMockAgent();
  });

  it("captured a request from every tool — an empty set proves nothing", () => {
    expect(emitted.size).toBe(CASES.length);
    expect(CASES.length).toBe(10);
  });

  it("the spec is the real one and still has the endpoints we map to", () => {
    expect(Object.keys(spec.paths).length).toBeGreaterThan(100);
    for (const [tool, path] of Object.entries(SPEC_PATH)) {
      expect(spec.paths[path], `${tool} → ${path} is gone from the spec`).toBeDefined();
    }
  });

  for (const c of CASES) {
    it(`${c.name}: every emitted query key is declared by the API`, () => {
      const path = SPEC_PATH[c.name];
      const declared = new Set((spec.paths[path]?.get?.parameters ?? []).map((p) => p.name));
      const skip = new Set(CLIENT_SIDE[c.name] ?? []);
      const undeclared = [...(emitted.get(c.name) ?? [])].filter(
        (k) => !declared.has(k) && !skip.has(k)
      );
      expect(undeclared, `${c.name} sends keys ${path} does not declare`).toEqual([]);
    });
  }

  it("every client-side exemption is really absent from the wire", () => {
    // Otherwise the exemption list becomes a place to silence real drift.
    for (const [tool, keys] of Object.entries(CLIENT_SIDE)) {
      for (const k of keys) {
        expect([...(emitted.get(tool) ?? [])], `${tool}.${k} is exempt but was sent`).not.toContain(
          k
        );
      }
    }
  });
});

// ─── request capture ─────────────────────────────────────────────────────
// undici's MockAgent does not expose the requested URL after the fact, so we
// wrap fetch for the duration of the run.
const fetchedUrls: string[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith(TEST_BASE_URL)) fetchedUrls.push(url);
  return realFetch(input as never, init as never);
}) as typeof fetch;
