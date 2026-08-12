import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { EntyrixClient } from "../lib/client.js";

export const getCompanyRelationsInputSchema = {
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
  purpose: z
    .enum(["kyc", "aml", "credit", "risk_monitoring", "supplier_due_diligence"])
    .optional()
    .describe(
      "Declared due-diligence purpose. Only needed for `full`-tier keys when the " +
        "subject is a natural person (sole trader) — the API's FO gate refuses such " +
        "subjects unless a recognised purpose is attested. Ignored for legal " +
        "entities. Marketing/prospection is not a valid value here."
    ),
};

const description =
  "Full relationship graph for one company: directors, shareholders, RPVS " +
  "beneficial owners (UBO, SK register 315/2016 — persons with validity windows " +
  "and a public-official flag), related companies via shared officers, corporate " +
  "shareholders (counterparty IČO resolved), and M&A / succession events. Richer " +
  "than get_company_network — that one is the shared-officer company graph only; " +
  "this adds the UBO and M&A layers. Use get_company_network to walk company→" +
  "company hops, use this to enumerate a single company's owners and officers. " +
  "Bearer-auth + FO-gated at the API: keys without an FO addendum are refused for " +
  "natural-person sole traders, and UBO persons are minimised (birth YEAR only).";

export function registerGetCompanyRelations(server: McpServer, client: EntyrixClient): void {
  server.registerTool(
    "get_company_relations",
    {
      title: "Get company relations (directors, UBO, M&A)",
      description,
      inputSchema: getCompanyRelationsInputSchema,
    },
    async (args) => {
      const ico = args.ico.padStart(8, "0");
      const result = await client.get<unknown>(`/companies/${encodeURIComponent(ico)}/relations`, {
        purpose: args.purpose,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
