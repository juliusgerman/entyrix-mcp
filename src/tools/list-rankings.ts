import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { EntyrixClient } from "../lib/client.js";

/**
 * The ONLY ranking slugs the API serves. Must stay in lockstep with the
 * `/public/rankings/:key.json` whitelist in the Entyrix API repo
 * (src/api/routes/public.ts) — any other slug gets a 404 INVALID_RANKING_KEY.
 * The schema test asserts the tool enum equals exactly this set.
 */
export const SUPPORTED_RANKING_SLUGS = [
  "largest",
  "public-contracts",
  "shell-addresses",
  "most-viewed",
] as const;

export type RankingSlug = (typeof SUPPORTED_RANKING_SLUGS)[number];

export const listRankingsInputSchema = {
  key: z
    .enum(SUPPORTED_RANKING_SLUGS)
    .describe(
      "Ranking slug. Supported: 'largest' (TOP 100 companies by turnover), " +
        "'public-contracts' (TOP 100 state suppliers by public-contract count), " +
        "'shell-addresses' (TOP 100 addresses with the most registered companies), " +
        "'most-viewed' (TOP 100 most-viewed companies). No other slugs exist."
    ),
};

const description =
  "Fetch a pre-computed company leaderboard by slug. Exactly four rankings " +
  "exist: 'largest' (companies by turnover), 'public-contracts' (top state " +
  "suppliers), 'shell-addresses' (addresses with most registered companies) " +
  "and 'most-viewed' (most-viewed company profiles). " +
  "Responses come from a 15-min cache, so they are millisecond-fast. Useful " +
  "for 'top 100 …' style queries the LLM would otherwise try to assemble " +
  "from many advanced_search calls.";

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
