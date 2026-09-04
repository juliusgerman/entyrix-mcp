import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { EntyrixClient } from "../lib/client.js";

export const checkComplianceInputSchema = {
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
};

const description =
  "Public compliance check for a Slovak company: AML/sanctions, debtor lists " +
  "(SocPoist/VšZP/tax), insolvency/bankruptcy/liquidation status, RPVS " +
  "(transparency-of-ownership register, zákon 315/2016), and active " +
  "regulatory flags. No API key required server-side (public route), but " +
  "still routed through the authenticated MCP client for traceability. " +
  "SK-only today; CZ/AT compliance modules tracked in roadmap. " +
  "IMPORTANT — this is the PUBLIC tier and it answers about natural persons " +
  "(sole traders) with `null`, meaning WITHHELD, never 'no finding'. When " +
  "`redaction.applied` is true the address, tax IDs and the whole compliance " +
  "assessment (`tier`, `activeFlagCount`, the flags named in `withheldFlags`) " +
  "were not published, and the subject must NOT be reported as clear, " +
  "unsanctioned or debt-free. Use get_company_details for the assessed values; " +
  "it reads the authenticated surface, where an FO-enabled key returns them. " +
  "That is also why the two tools can disagree about the same subject: they " +
  "are different trust tiers, not different data.";

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
