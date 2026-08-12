import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { EntyrixClient } from "../lib/client.js";
import { countryQuery, normalizeRegistryId } from "../lib/national-id.js";
import { financialRowsToEur } from "../lib/money.js";

export const getCompanyDetailsInputSchema = {
  ico: z
    .string()
    .min(1)
    .max(32)
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9./-]{0,31}$/,
      "national registry identifier (digits, or letters and hyphens in some registers)"
    )
    .describe(
      "National registry identifier. Slovakia, Czechia and Estonia use a 6-8 digit IČO; France a 9-digit SIREN. " +
        "Norway, Lithuania and Portugal 9 digits; Belgium 10; Switzerland CHE#########; Finland 0140168-2. " +
        "Austria uses a Firmenbuch number like 357942k; Britain 08183069 or SC307270. Pass `country` " +
        "for anything that is not a Slovak or Czech IČO."
    ),
  country: z
    .string()
    .length(2)
    .optional()
    .describe(
      "ISO 3166-1 alpha-2 code of the register, e.g. SK or FR. " +
        "REQUIRED for any market whose identifier is not a 6-8 digit IČO, and the only way to " +
        "disambiguate an 8-digit IČO that exists in both SK and CZ."
    ),
};

const description =
  "Fetch the full company profile by IČO: identity, registered address, NACE, " +
  "legal form, status, latest financials, tech stack / website / SSL signals, " +
  "security findings (CVE/CT logs), NIS2 scope, sanctions hits, and credit " +
  "score / grade. Richer than lookup_company (which is identity-only). " +
  "For SK↔CZ 8-digit collisions the API picks the active SK match first; " +
  "use lookup_company with explicit country for deterministic disambiguation.";

export function registerGetCompanyDetails(server: McpServer, client: EntyrixClient): void {
  server.registerTool(
    "get_company_details",
    {
      title: "Get full company details",
      description,
      inputSchema: getCompanyDetailsInputSchema,
    },
    async (args) => {
      const ico = normalizeRegistryId(args.ico, args.country);
      const result = await client.get<unknown>(
        `/companies/${encodeURIComponent(ico)}`,
        countryQuery(args.country)
      );
      // `latestFinancials` arrives in cents — same rows `get_financials` serves.
      // Converted here too, or the two tools would disagree about the same
      // company depending on which one the model happened to call.
      const envelope = result as { data?: { latestFinancials?: unknown } } | null;
      if (envelope?.data && Array.isArray(envelope.data.latestFinancials)) {
        envelope.data.latestFinancials = financialRowsToEur(envelope.data.latestFinancials);
      }
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
