import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { EntyrixClient } from "../lib/client.js";

export const checkComplianceInputSchema = {
  ico: z
    .string()
    .min(6)
    .max(8)
    .regex(/^\d{6,8}$/)
    .describe("6-8 digit Slovak IČO"),
};

const description =
  "Public compliance check for a Slovak company: AML/sanctions, debtor lists " +
  "(SocPoist/VšZP/tax), insolvency/bankruptcy/liquidation status, RPVS " +
  "(transparency-of-ownership register, zákon 315/2016), and active " +
  "regulatory flags. No API key required server-side (public route), but " +
  "still routed through the authenticated MCP client for traceability. " +
  "SK-only today; CZ/AT compliance modules tracked in roadmap.";

export function registerCheckCompliance(server: McpServer, client: EntyrixClient): void {
  server.registerTool(
    "check_compliance",
    {
      title: "Compliance + sanctions check",
      description,
      inputSchema: checkComplianceInputSchema,
    },
    async (args) => {
      const ico = args.ico.padStart(8, "0");
      const result = await client.get<unknown>(`/public/check/${encodeURIComponent(ico)}.json`);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
