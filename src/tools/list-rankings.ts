import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { EntyrixClient } from "../lib/client.js";

export const listRankingsInputSchema = {
  key: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9_-]+$/i, "Ranking key is slug-like: lowercase, digits, hyphens, underscores")
    .describe(
      "Ranking slug (e.g. 'top-turnover-sk', 'top-employers-cz', 'fastest-growing-sk'). See /public/rankings for the full index."
    ),
};

const description =
  "Fetch a pre-computed company leaderboard by slug — turnover, employees, " +
  "profit, growth, or sector-specific cuts. Backed by daily snapshot " +
  "materialization (endpoint_snapshots L2 cache), so responses are " +
  "millisecond-fast. Useful for 'top 100 …' style queries the LLM would " +
  "otherwise try to assemble from many advanced_search calls. Discoverable " +
  "list of slugs is on the Entyrix rankings hub.";

export function registerListRankings(server: McpServer, client: EntyrixClient): void {
  server.registerTool(
    "list_rankings",
    {
      title: "List companies by ranking",
      description,
      inputSchema: listRankingsInputSchema,
    },
    async (args) => {
      const key = args.key.toLowerCase();
      const result = await client.get<unknown>(`/public/rankings/${encodeURIComponent(key)}.json`);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
