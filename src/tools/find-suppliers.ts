import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { EntyrixClient } from "../lib/client.js";

export const findSuppliersInputSchema = {
  ico: z
    .string()
    .min(6)
    .max(8)
    .regex(/^\d{6,8}$/)
    .describe("6-8 digit Slovak IČO of the supplier company"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(500)
    .optional()
    .describe("Max contracts (default 50, cap 500)"),
  years: z.string().optional().describe("Restrict to recent years, e.g. '3' for the last 3"),
  // No `offset`. The route reads `limit` and `years` and nothing else, so the
  // pagination parameter this tool used to declare was silently dropped:
  // measured 2026-08-10, `limit=2&offset=0` and `limit=2&offset=3` returned the
  // SAME first contract. An agent walking pages would have re-read page one
  // forever and concluded the supplier had few contracts. Raise `limit` (cap
  // 500) instead; add real paging server-side before declaring it here.
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
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
