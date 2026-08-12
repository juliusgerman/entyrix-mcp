import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { EntyrixClient } from "../lib/client.js";
import { countryQuery, normalizeRegistryId } from "../lib/national-id.js";
import { financialRowsToEur } from "../lib/money.js";

export const getFinancialsInputSchema = {
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
  years: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .describe("How many most-recent years to return (default 5)"),
};

const description =
  "Return up to N most-recent annual financial statements (turnover, total " +
  "assets, equity, profit, EBITDA, ROA, ROE) for a company. Source: SK FS / " +
  "CZ Justice / AT FBW depending on jurisdiction. All money amounts are in " +
  "EUR (each row carries `unit`); roa/roe are ratios. " +
  "Implemented as a thin extractor over get_company_details — saves the LLM " +
  "from parsing the full company envelope when only financials are needed.";

interface CompanyDetailsResponse {
  data?: {
    latestFinancials?: unknown[];
    [k: string]: unknown;
  };
  meta?: unknown;
}

export function registerGetFinancials(server: McpServer, client: EntyrixClient): void {
  server.registerTool(
    "get_financials",
    {
      title: "Get company financials",
      description,
      inputSchema: getFinancialsInputSchema,
    },
    async (args) => {
      const ico = normalizeRegistryId(args.ico, args.country);
      const years = args.years ?? 5;
      const full = await client.get<CompanyDetailsResponse>(
        `/companies/${encodeURIComponent(ico)}`,
        countryQuery(args.country)
      );
      const allYears = Array.isArray(full.data?.latestFinancials)
        ? full.data!.latestFinancials!
        : [];
      const truncated = financialRowsToEur(allYears.slice(0, years));
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                ico,
                years_requested: years,
                years_returned: truncated.length,
                financials: truncated,
                meta: full.meta,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
