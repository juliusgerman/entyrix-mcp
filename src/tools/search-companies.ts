import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { EntyrixClient } from "../lib/client.js";

export const searchCompaniesInputSchema = {
  q: z.string().min(1).max(200).describe("Search query (company name, partial name, address, IČO)"),
  country: z
    .string()
    .length(2)
    .optional()
    .describe("ISO 3166-1 alpha-2 country code filter (e.g. 'SK', 'CZ', 'AT'). Case-insensitive."),
  limit: z.number().int().min(1).max(50).optional().describe("Max results to return (default 10)"),
  active_only: z
    .boolean()
    .optional()
    .describe("If true (default), only active (non-terminated) companies"),
};

const description =
  "Search European companies by name, partial name, or address. " +
  "Powered by the autocomplete index for typo-tolerance + 12ms p95. " +
  "Returns ranked hits with IČO, name, address, NACE code, legal form, status, " +
  "and country. Use this for fuzzy 'find a company called …' queries before " +
  "drilling into details with lookup_company or get_company_details. " +
  "Coverage: SK, CZ, AT, EE, SI, LV, UK and growing.";

export function registerSearchCompanies(server: McpServer, client: EntyrixClient): void {
  server.registerTool(
    "search_companies",
    {
      title: "Search companies",
      description,
      inputSchema: searchCompaniesInputSchema,
    },
    async (args) => {
      const result = await client.get<unknown>("/companies/autocomplete", {
        q: args.q,
        country: args.country?.toUpperCase(),
        limit: args.limit,
        active_only: args.active_only === false ? "false" : undefined,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
