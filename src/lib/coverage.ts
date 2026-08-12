/**
 * Which markets this server can answer for, in ONE place.
 *
 * Tool descriptions are not documentation — they are the prompt. Whatever this
 * file says is what every connected model believes the API covers, and a model
 * that reads "Coverage: SK, CZ, AT, EE, SI, LV, UK" will not reach for a French
 * or Greek company at all. That exact string shipped in `search_companies` and
 * named seven markets while the API served twenty-three.
 *
 * The same figure is repeated outside this repo — the npm description, the MCP
 * registry manifest, the GitHub About field, the /mcp page on entyrix.com — and
 * on 2026-08-12 three of those published surfaces still claimed "16+" after the
 * count had moved twice. Drift here is invisible: nothing fails, the answers
 * just get narrower than the data.
 *
 * `__tests__/coverage.test.ts` holds every in-repo restatement to this count.
 * The published surfaces live in other systems and are listed in SUBMISSION.md
 * as release steps, because no test in this repo can reach them.
 *
 * Source of truth for the underlying rule is the API side
 * (`opendata/src/lib/marketing-stats.ts`): a market is live once it holds
 * >= 100k subjects in production. Two repos means two copies; this one is the
 * copy, and it is kept honest by the count, not by memory.
 */
export const MARKET_COUNT = 23;

export const MARKETS = [
  "FR",
  "GB",
  "RO",
  "SK",
  "UA",
  "GR",
  "CZ",
  "BE",
  "NO",
  "IE",
  "FI",
  "CH",
  "PL",
  "AT",
  "CY",
  "LT",
  "LV",
  "EE",
  "SI",
  "ES",
  "IT",
  "NL",
  "HR",
] as const;

/** "FR, GB, RO, …" — the form used inside prose and tool descriptions. */
export const MARKET_LIST = MARKETS.join(", ");
