import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { EntyrixClient } from "../../lib/client.js";
import { registerAdvancedSearch, advancedSearchInputSchema } from "../advanced-search.js";
import {
  createCaptureServer,
  setupMockAgent,
  teardownMockAgent,
  getMockPool,
  TEST_BASE_URL,
} from "./_harness.js";

/**
 * Every filter key the Entyrix API actually reads on
 * GET /api/v1/companies/advanced-search — the union of the route's Querystring
 * interface and the shared filter builder, as of 2026-08-10.
 *
 * Checked in rather than derived, because this package must build without the
 * API repo present. To regenerate, run in the opendata repo:
 *   node -e "import('./dist/lib/advanced-search-filters.js').then(m =>
 *     console.log([...m.ADVANCED_SEARCH_KNOWN_PARAMS].sort().join('\n')))"
 *
 * A name absent from this set is not a stricter filter — it is NO filter. The
 * API drops it without a word and answers as if it had never been sent.
 */
const API_FILTER_KEYS = new Set([
  "active",
  "added_value_min",
  "amo_case_min",
  "amo_sanctions_min",
  "assets_max",
  "assets_min",
  "cnb_seznam",
  "cnb_supervised",
  "contracts_min",
  "contracts_total_min",
  "convicted",
  "cordis_min_eur",
  "country",
  "country_code",
  "credit_grade",
  "credit_limit_max",
  "credit_limit_min",
  "credit_score_max",
  "credit_score_min",
  "current_ratio_min",
  "cyber_band",
  "cyber_score_max",
  "cyber_score_min",
  "debarment_min",
  "debt_to_equity_max",
  "district",
  "ebitda_min",
  "eia_project_min",
  "employee_max",
  "employee_min",
  "employee_size",
  "entity_type",
  "env_installations_min",
  "equity_max",
  "equity_min",
  "established_from",
  "established_to",
  "eu_funds_max",
  "eu_funds_min",
  "eu_projects_min",
  "gross_margin_min",
  "has_amo_cartel",
  "has_amo_case",
  "has_bank_account",
  "has_contracts",
  "has_cordis",
  "has_critical_cves",
  "has_cves",
  "has_datova_schranka",
  "has_eia_project",
  "has_email",
  "has_eu_projects",
  "has_euid",
  "has_financials",
  "has_health_debt",
  "has_ipkz",
  "has_lei",
  "has_offshore_link",
  "has_opening_hours",
  "has_osm_location",
  "has_phone",
  "has_rpvs",
  "has_share_capital",
  "has_social_debt",
  "has_tax_debt",
  "has_tech",
  "has_uk_connections",
  "has_website",
  "healthy",
  "in_bankruptcy",
  "in_liquidation",
  "in_restructuring",
  "include_trends",
  "is_debarred",
  "is_sanctioned",
  "is_shell_address",
  "is_vat_payer",
  "legal_form",
  "licensed_type",
  "limit",
  "municipality",
  "mx_provider",
  "nace",
  "nace_eu_division",
  "nace_eu_section",
  "nace_prefix",
  "nbs_supervised",
  "nis2_annex",
  "nis2_category",
  "nis2_in_scope",
  "nis2_priority_min",
  "nis2_sector",
  "nis2_tier",
  "nuts2",
  "nuts3",
  "offset",
  "order",
  "ownership_type",
  "profit_max",
  "profit_min",
  "region",
  "roa_max",
  "roa_min",
  "roe_min",
  "same_address_min",
  "sanctions_min",
  "security_score_max",
  "security_score_min",
  "share_capital_min",
  "ssl_invalid",
  "status",
  "tax_debt_min",
  "tax_reliability",
  "tech",
  "terminated_from",
  "terminated_to",
  "total_debt_max",
  "trend_years",
  "turnover_max",
  "turnover_min",
  "uk_psc_min",
  "updated_since",
  "urso_regulated",
  "vies_valid",
  "year",
]);

/**
 * The nine names this file shipped that the API never read. Kept as an
 * explicit blocklist as well as being absent from API_FILTER_KEYS: they are
 * the shapes a reviewer would most plausibly reintroduce, since each reads
 * like the obvious spelling.
 */
const KNOWN_DEAD_NAMES = [
  "sort",
  "is_active",
  "sanctioned",
  "nis2_scope",
  "founded_after",
  "founded_before",
  "legal_form_code",
  "employees_min",
  "employees_max",
];

describe("advanced_search tool", () => {
  beforeAll(() => setupMockAgent());
  afterAll(async () => await teardownMockAgent());

  it("declares only filter keys the API actually reads", () => {
    const declared = Object.keys(advancedSearchInputSchema);
    const dead = declared.filter((k) => !API_FILTER_KEYS.has(k));
    expect(
      dead,
      `these keys are silently DROPPED by the API — the tool would return an ` +
        `unfiltered answer and say nothing: ${dead.join(", ")}`
    ).toEqual([]);
  });

  it("does not reintroduce any of the nine measured dead names", () => {
    const declared = new Set(Object.keys(advancedSearchInputSchema));
    const revived = KNOWN_DEAD_NAMES.filter((k) => declared.has(k));
    expect(revived, `reverted to a name the API ignores: ${revived.join(", ")}`).toEqual([]);
  });

  it("compared against a real set, not an empty one", () => {
    // Zero mismatches out of zero keys reads exactly like a clean run.
    expect(Object.keys(advancedSearchInputSchema).length).toBeGreaterThan(40);
    expect(API_FILTER_KEYS.size).toBeGreaterThan(100);
  });

  it("exposes the filters the product actually differentiates on", () => {
    // Regression scope, not taste: these were unreachable through MCP before
    // 2026-08-10 even though the API has served them for months.
    const declared = new Set(Object.keys(advancedSearchInputSchema));
    for (const k of [
      "tech",
      "nis2_in_scope",
      "has_critical_cves",
      "has_tax_debt",
      "is_debarred",
      "employee_min",
      "order",
    ]) {
      expect(declared.has(k), `${k} missing from the tool schema`).toBe(true);
    }
  });

  it("forwards every non-undefined filter as query params", async () => {
    // Order of URLSearchParams insertion is preserved.
    const expected =
      "/api/v1/companies/advanced-search?country_code=SK&nace_prefix=46%2C47&active=true&tech=PrestaShop&turnover_min=1000000&order=name_asc&limit=20";
    getMockPool()
      .intercept({ path: expected, method: "GET" })
      .reply(
        200,
        { data: { results: [], unknownFilters: [] } },
        { headers: { "content-type": "application/json" } }
      );

    const client = new EntyrixClient({ apiKey: "k", baseUrl: TEST_BASE_URL });
    const { server, tools } = createCaptureServer();
    registerAdvancedSearch(server as any, client);

    const out = await tools.get("advanced_search")!.handler({
      country_code: "SK",
      nace_prefix: "46,47",
      active: true,
      tech: "PrestaShop",
      turnover_min: 1000000,
      order: "name_asc",
      limit: 20,
    });
    const body = JSON.parse(out.content[0].text);
    expect(body.data.results).toEqual([]);
    // The field the agent must read before trusting a wide result set.
    expect(body.data.unknownFilters).toEqual([]);
  });

  it("tells the caller to check unknownFilters", () => {
    const { server, tools } = createCaptureServer();
    registerAdvancedSearch(
      server as any,
      new EntyrixClient({ apiKey: "k", baseUrl: TEST_BASE_URL })
    );
    expect(tools.get("advanced_search")!.description).toContain("unknownFilters");
  });
});
