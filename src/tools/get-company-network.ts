import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { EntyrixClient } from "../lib/client.js";

export const getCompanyNetworkInputSchema = {
  ico: z
    .string()
    .min(6)
    .max(8)
    .regex(/^\d{6,8}$/, "IČO must be 6-8 digits")
    .describe("6-8 digit IČO (Slovak/Czech/Estonian registry number). Leading zeros optional."),
};

const description =
  "Company-to-company network via shared people (statutory officers / " +
  "shareholders). Returns the company's current officers and, for each, the " +
  "OTHER companies where that same person also holds a role — every connected " +
  "company carries its IČO so the graph is walkable. This is the primary " +
  "network-walk primitive: feed a returned IČO back into get_company_network " +
  "to traverse another hop. Empty result means the company has no current " +
  "shared-officer edges (e.g. officer data not yet ingested for that entity) — " +
  "it does NOT mean the company is isolated; try get_company_relations for UBO / " +
  "M&A edges. Bearer-auth + FO-gated at the API: keys without an FO addendum are " +
  "refused for natural-person sole traders.";

export function registerGetCompanyNetwork(server: McpServer, client: EntyrixClient): void {
  server.registerTool(
    "get_company_network",
    {
      title: "Get company network (shared-officer graph)",
      description,
      inputSchema: getCompanyNetworkInputSchema,
    },
    async (args) => {
      const ico = args.ico.padStart(8, "0");
      const result = await client.get<unknown>(`/companies/${encodeURIComponent(ico)}/network`);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
