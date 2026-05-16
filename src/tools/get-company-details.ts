import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { EntyrixClient } from "../lib/client.js";

export const getCompanyDetailsInputSchema = {
  ico: z
    .string()
    .min(6)
    .max(8)
    .regex(/^\d{6,8}$/, "IČO must be 6-8 digits")
    .describe("6-8 digit IČO (Slovak/Czech/Estonian registry number). Leading zeros optional."),
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
      const ico = args.ico.padStart(8, "0");
      const result = await client.get<unknown>(`/companies/${encodeURIComponent(ico)}`);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
