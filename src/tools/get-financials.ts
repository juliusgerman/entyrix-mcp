import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { EntyrixClient } from "../lib/client.js";
import { financialRowsToEur } from "../lib/money.js";

export const getFinancialsInputSchema = {
  ico: z
    .string()
    .min(6)
    .max(8)
    .regex(/^\d{6,8}$/)
    .describe("6-8 digit IČO"),
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
      const ico = args.ico.padStart(8, "0");
      const years = args.years ?? 5;
      const full = await client.get<CompanyDetailsResponse>(
        `/companies/${encodeURIComponent(ico)}`
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
