import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { EntyrixClient } from "../lib/client.js";

// Mirror of the 38 documented filter keys on /api/v1/companies/advanced-search.
// Kept as a flexible record to avoid lock-in; server validates per-key.
export const advancedSearchInputSchema = {
  country_code: z.string().length(2).optional().describe("ISO 3166-1 alpha-2 country code"),
  nace_prefix: z
    .string()
    .optional()
    .describe("Comma-separated NACE prefixes, e.g. '46,47' for trade"),
  legal_form_code: z.string().optional().describe("Legal form code (e.g. '112' = s.r.o.)"),
  is_active: z.boolean().optional(),
  is_vat_payer: z.boolean().optional(),
  in_bankruptcy: z.boolean().optional(),
  in_liquidation: z.boolean().optional(),
  in_restructuring: z.boolean().optional(),
  status: z
    .string()
    .optional()
    .describe("active | restructuring | liquidation | bankruptcy | terminated"),
  turnover_min: z.number().optional().describe("Minimum annual turnover in EUR"),
  turnover_max: z.number().optional().describe("Maximum annual turnover in EUR"),
  employees_min: z.number().int().optional(),
  employees_max: z.number().int().optional(),
  founded_after: z.string().optional().describe("ISO date (YYYY-MM-DD)"),
  founded_before: z.string().optional().describe("ISO date (YYYY-MM-DD)"),
  municipality: z.string().optional(),
  region: z.string().optional().describe("NUTS-3 region code or Slovak kraj name"),
  has_website: z.boolean().optional(),
  has_email: z.boolean().optional(),
  credit_grade: z.string().optional().describe("Credit grade letter (A..E)"),
  nis2_scope: z.boolean().optional().describe("NIS2 directive scope"),
  sanctioned: z.boolean().optional(),
  limit: z.number().int().min(1).max(500).optional().describe("Max results (default 50)"),
  offset: z.number().int().min(0).optional().describe("Pagination offset"),
  sort: z.string().optional().describe("Sort field (e.g. 'turnover_desc', 'founded_asc')"),
};

const description =
  "Structured multi-filter search across 38 documented keys: country, NACE " +
  "prefix, legal form, status flags (active/bankruptcy/liquidation/...), " +
  "turnover range, employee range, founded date range, region/municipality, " +
  "credit grade, NIS2 scope, sanctions, website/email presence, VAT, and " +
  "more. Returns paginated list. Use for analyst-style queries like " +
  "'all active SK companies in NACE 46 with turnover > €1M and credit grade A'.";

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
        query[k] = v as string | number | boolean;
      }
      const result = await client.get<unknown>("/companies/advanced-search", query);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
