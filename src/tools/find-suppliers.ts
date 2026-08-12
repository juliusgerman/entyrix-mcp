import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { EntyrixClient } from "../lib/client.js";

export const findSuppliersInputSchema = {
  ico: z
    .string()
    .min(6)
    .max(8)
    .regex(/^\d{6,8}$/, "IČO must be 6-8 digits")
    .describe(
      "6-8 digit IČO (Slovak/Czech/Estonian registry number). Leading zeros optional. " +
        "This endpoint is keyed on the legacy IČO column, so markets whose identifier is " +
        "not a 6-8 digit IČO are not reachable through this endpoint yet."
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(500)
    .optional()
    .describe("Max contracts (default 50, cap 500)"),
  years: z.string().optional().describe("Restrict to recent years, e.g. '3' for the last 3"),
  // `offset` was removed on 2026-08-10 and is back because the route now reads
  // it. Until then it was declared here and silently dropped: `limit=2&offset=0`
  // and `limit=2&offset=3` returned the SAME first contract, so an agent walking
  // pages re-read page one forever and concluded the supplier had few contracts.
  // `data.pagination.total` is the row count to page against — measured on
  // Slovnaft (31322832) it is 764, i.e. 264 rows past the `limit` cap of 500.
  offset: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Skip this many contracts; page with data.pagination.total"),
};

const description =
  "List public-sector contracts where the given company is the supplier. " +
  "Backed by SK CRZ (Centrálny register zmlúv). Returns contract value, " +
  "buyer (public-sector entity), signing date, contract subject, and CPV " +
  "code where available. SK-only today (CRZ is a Slovak register). For " +
  "broader EU procurement signal use the planned TED-search tool (not yet " +
  "exposed). Useful for B2G exposure analysis and supplier due diligence.";

export function registerFindSuppliers(server: McpServer, client: EntyrixClient): void {
  server.registerTool(
    "find_suppliers",
    {
      title: "Find public-sector contracts (SK supplier)",
      description,
      inputSchema: findSuppliersInputSchema,
    },
    async (args) => {
      const ico = args.ico.padStart(8, "0");
      const result = await client.get<unknown>(`/companies/${encodeURIComponent(ico)}/contracts`, {
        limit: args.limit,
        years: args.years,
        offset: args.offset,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
