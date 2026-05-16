import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { EntyrixClient } from "../lib/client.js";

export const lookupCompanyInputSchema = {
  ico: z
    .string()
    .min(1)
    .max(32)
    .describe(
      "National registry identifier. SK/CZ/EE: 6-8 digit IČO. AT: Firmenbuch number like '187a'. SI: 10-digit matična številka. LV: 11-digit reg number. Leading zeros are normalized server-side."
    ),
  country: z
    .string()
    .length(2)
    .optional()
    .describe(
      "ISO 3166-1 alpha-2 country code (default 'SK' for backwards compat). Required to disambiguate SK↔CZ 8-digit IČO collisions and for non-SK shapes (AT, SI, LV)."
    ),
};

const description =
  "Resolve a single company by its national registry identifier with country " +
  "disambiguation. Routes through the country-aware lookup so it handles " +
  "all our shapes: SK/CZ/EE 6-8 digit IČO, AT Firmenbuch numbers (e.g. '187a'), " +
  "SI/LV multi-digit registry numbers. Returns a single company object with " +
  "core identity, address, legal form, status flags. Use this when you already " +
  "know the registry number; use search_companies for name-based discovery.";

export function registerLookupCompany(server: McpServer, client: EntyrixClient): void {
  server.registerTool(
    "lookup_company",
    {
      title: "Look up company by national ID",
      description,
      inputSchema: lookupCompanyInputSchema,
    },
    async (args) => {
      const country = (args.country ?? "sk").toUpperCase();
      const nationalId = args.ico.trim();
      const result = await client.get<unknown>(
        `/companies/${encodeURIComponent(country)}/${encodeURIComponent(nationalId)}`
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
