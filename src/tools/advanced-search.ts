import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { EntyrixClient } from "../lib/client.js";

// Filter keys for GET /api/v1/companies/advanced-search.
//
// EVERY NAME HERE IS LOAD-BEARING. The API ignores a query key it does not
// recognise — silently. No 400, no warning, no empty result: the filter is
// dropped and a complete, default-sorted answer comes back. Measured against
// the live API on 2026-08-10, this file had NINE names in that hole, each of
// them *almost* right, which is why it went unnoticed for months:
//
//   sort            → order              is_active     → active
//   sanctioned      → is_sanctioned      nis2_scope    → nis2_in_scope
//   founded_after   → established_from   founded_before→ established_to
//   legal_form_code → legal_form         employees_min → employee_min
//                                        employees_max → employee_max
//
// So "all active SK companies founded after 2020, sorted by name" returned the
// whole country ordered by turnover, and nothing said otherwise.
//
// The API now reports its own blind spot: every response carries
// `data.unknownFilters` (the CSV twin sets `X-Entyrix-Unknown-Params`). If a
// filter added here ever stops being honoured, it shows up there — check it
// before trusting a result set that looks suspiciously large.
//
// `__tests__/advanced-search.test.ts` pins every key against the measured
// server-side set, so a plausible-looking rename cannot pass review again.
export const advancedSearchInputSchema = {
  // ── Identity / registry ──────────────────────────────────────────────
  country_code: z
    .string()
    .optional()
    .describe("ISO 3166-1 alpha-2, comma-separated for several markets, e.g. 'SK,CZ'"),
  /**
   * Alias for `country_code`. Not redundancy — a trap remover.
   *
   * Every other tool on this server takes `country`; only this one takes
   * `country_code`. Measured 2026-08-12 against a fresh build: calling
   * `advanced_search({ country: "sk" })` returned FRENCH companies. Zod strips
   * an undeclared key before the request is built, so the filter never reached
   * the API — which means the API's own `unknownFilters` guard could not report
   * it either, because the API never saw the key.
   *
   * That is the worst shape of wrong: a complete, plausible, default-sorted
   * answer to a question nobody asked. Declaring the alias removes the trap
   * instead of making it louder; the handler folds it into `country_code`.
   */
  country: z
    .string()
    .optional()
    .describe("Alias for country_code. ISO 3166-1 alpha-2, e.g. 'SK'."),
  legal_form: z.string().optional().describe("Legal form code, e.g. '112' = s.r.o. (SK)"),
  entity_type: z
    .enum(["legal_entity", "self_employed", "npo", "public_body", "other"])
    .optional()
    .describe("Comma-separated also accepted. Natural persons are gated out of results anyway."),
  status: z.enum(["active", "restructuring", "liquidation", "bankruptcy", "terminated"]).optional(),
  active: z.boolean().optional().describe("Registry active flag (NOT is_active)"),
  established_from: z.string().optional().describe("Founded on or after, ISO date YYYY-MM-DD"),
  established_to: z.string().optional().describe("Founded on or before, ISO date YYYY-MM-DD"),
  terminated_from: z.string().optional().describe("Terminated on or after, ISO date"),
  terminated_to: z.string().optional().describe("Terminated on or before, ISO date"),
  is_vat_payer: z.boolean().optional(),

  // ── Geography ────────────────────────────────────────────────────────
  municipality: z.string().optional().describe("Town/city name, e.g. 'Košice'"),
  district: z.string().optional(),
  region: z
    .string()
    .optional()
    .describe("Region NAME only, e.g. 'Košický kraj'. A NUTS code here returns zero — use nuts3."),
  nuts2: z.string().optional().describe("NUTS-2 code"),
  nuts3: z.string().optional().describe("NUTS-3 code, e.g. 'SK042'"),

  // ── Sector ───────────────────────────────────────────────────────────
  nace: z.string().optional().describe("Single NACE prefix match, e.g. '46'"),
  nace_prefix: z.string().optional().describe("Comma-separated NACE prefixes, e.g. '46,47'"),

  // ── Size / financials ────────────────────────────────────────────────
  turnover_min: z.number().optional().describe("Minimum annual turnover in EUR"),
  turnover_max: z.number().optional().describe("Maximum annual turnover in EUR"),
  profit_min: z.number().optional().describe("Minimum annual profit in EUR"),
  profit_max: z.number().optional().describe("Maximum annual profit in EUR"),
  employee_min: z.number().int().optional().describe("Minimum headcount (NOT employees_min)"),
  employee_max: z.number().int().optional().describe("Maximum headcount (NOT employees_max)"),
  employee_size: z.string().optional().describe("Employee size-band code"),
  has_financials: z.boolean().optional(),
  year: z.number().int().optional().describe("Financial year for period-specific figures"),

  // ── Credit / distress ────────────────────────────────────────────────
  credit_grade: z.string().optional().describe("Comma-separated grade letters, e.g. 'A,B'"),
  credit_score_min: z.number().int().optional(),
  credit_score_max: z.number().int().optional(),
  has_tax_debt: z.boolean().optional(),
  in_bankruptcy: z.boolean().optional(),
  in_liquidation: z.boolean().optional(),
  in_restructuring: z.boolean().optional(),
  healthy: z
    .boolean()
    .optional()
    .describe("Shorthand: no bankruptcy, liquidation, restructuring or tax debt"),

  // ── Compliance / integrity ───────────────────────────────────────────
  is_sanctioned: z.boolean().optional().describe("NOT 'sanctioned'"),
  is_debarred: z.boolean().optional().describe("Excluded from public procurement"),
  has_offshore_link: z.boolean().optional(),
  has_rpvs: z.boolean().optional().describe("SK register of public-sector partners"),

  // ── NIS2 / cyber ─────────────────────────────────────────────────────
  nis2_in_scope: z.boolean().optional().describe("NOT 'nis2_scope'"),
  nis2_sector: z.string().optional(),
  nis2_tier: z.string().optional().describe("essential | important"),
  has_cves: z.boolean().optional(),
  has_critical_cves: z.boolean().optional(),
  cyber_score_min: z.number().int().optional(),
  ssl_invalid: z.boolean().optional(),

  // ── Digital footprint ────────────────────────────────────────────────
  has_website: z.boolean().optional(),
  has_email: z.boolean().optional(),
  has_phone: z.boolean().optional(),
  has_tech: z.boolean().optional().describe("Any detected technology at all"),
  tech: z
    .string()
    .optional()
    .describe(
      "Named technology, exact match, e.g. 'PrestaShop', 'Shoptet', 'CookieYes'. " +
        "An unknown name returns 400 with the full list in meta.available — ask for " +
        "a wrong one once to discover what is detectable."
    ),

  // ── Public money ─────────────────────────────────────────────────────
  has_contracts: z.boolean().optional().describe("Has public procurement contracts"),
  contracts_min: z.number().int().optional().describe("Minimum contract count"),
  eu_funds_min: z.number().optional().describe("Minimum EU funds received, EUR"),

  // ── Paging / ordering ────────────────────────────────────────────────
  order: z
    .enum([
      "turnover_desc",
      "turnover_asc",
      "profit_desc",
      "name_asc",
      "contracts_desc",
      "nis2_priority_desc",
      "credit_score_desc",
    ])
    .optional()
    .describe("NOT 'sort'. An unrecognised value falls back to turnover_desc silently."),
  limit: z.number().int().min(1).max(200).optional().describe("Max results (default 50, cap 200)"),
  offset: z.number().int().min(0).optional().describe("Pagination offset"),
  updated_since: z.string().optional().describe("Only rows changed since this ISO date"),
};

const description =
  "Structured multi-filter company search across registry, geography, sector, " +
  "size, financials, credit/distress, sanctions, NIS2 and cyber exposure, " +
  "digital footprint (including `tech=` for a named technology such as " +
  "PrestaShop or CookieYes) and public money. Returns a paginated list with a " +
  "per-country breakdown. Totals are capped at 5000 — `pagination.isCapped` " +
  "says when the real number is higher. " +
  "Check `data.unknownFilters` in the response: any key listed there was " +
  "DROPPED, so the result is wider than you asked for. " +
  "Use for analyst-style queries like 'active SK e-shops on PrestaShop with " +
  "turnover over €1M and no consent platform detected'.";

export function registerAdvancedSearch(server: McpServer, client: EntyrixClient): void {
  server.registerTool(
    "advanced_search",
    {
      title: "Advanced company search",
      description,
      inputSchema: advancedSearchInputSchema,
    },
    async (args) => {
      const query: Record<string, string | number | boolean | undefined> = {};
      for (const [k, v] of Object.entries(args)) {
        if (v === undefined) continue;
        // `country` is the alias; the API only knows `country_code`. Sending
        // both would put an unrecognised key on the wire and light up
        // `unknownFilters` for something that is working as intended.
        if (k === "country") continue;
        query[k] = v as string | number | boolean;
      }
      if (args.country !== undefined && query.country_code === undefined) {
        query.country_code = args.country;
      }
      const result = await client.get<unknown>("/companies/advanced-search", query);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
