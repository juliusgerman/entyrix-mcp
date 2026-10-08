# @entyrix/mcp

[![npm](https://img.shields.io/npm/v/@entyrix/mcp)](https://www.npmjs.com/package/@entyrix/mcp)

Model Context Protocol access to [Entyrix](https://entyrix.com) — European business-registry (KYB) data across 23 live markets (FR, GB, RO, SK, UA, GR, CZ, BE, NO, IE, FI, CH, PL, AT, CY, LT, LV, EE, SI, ES, IT, NL, HR).

## Use the remote server (recommended)

Entyrix runs a remote MCP server (Streamable HTTP, protocol 2025-03-26 … 2026-07-28):

```
https://entyrix.com/mcp/v1
```

Add it as a remote / custom connector in Claude, ChatGPT, Cursor or VS Code. On the first tool call your client opens the Entyrix sign-in (OAuth 2.1 with PKCE) — no key in a config file. From the command line:

```bash
claude mcp add --transport http entyrix https://entyrix.com/mcp/v1
```

Full instructions: <https://entyrix.com/mcp>.

## This package: a stdio bridge

For clients that only speak stdio. Since **0.2.0** the package implements no tools itself — it forwards every JSON-RPC message to the remote server above with your API key from the environment, so it always exposes exactly the current catalogue. It has **zero runtime dependencies**.

```bash
ENTYRIX_API_KEY=sk_... npx -y @entyrix/mcp
```

```json
{
  "mcpServers": {
    "entyrix": {
      "command": "npx",
      "args": ["-y", "@entyrix/mcp"],
      "env": { "ENTYRIX_API_KEY": "sk_..." }
    }
  }
}
```

Get an API key at <https://entyrix.com>. Without a key, discovery and the public tools work; data tools answer with a request to set `ENTYRIX_API_KEY`.

**Pin the version** in production (e.g. `@entyrix/mcp@0.2.1`, not `latest`): a local MCP server runs with your privileges, and an unpinned `npx -y` installs whatever is published next.

## Tools

| Tool | What it does |
|---|---|
| `search_companies` | Find companies by name across all markets |
| `lookup_company` | Exact registry-ID lookup, country-scoped |
| `company_brief` | Compact Markdown brief of one company — the best single call |
| `get_company_details` | Full record including the enrichment layer |
| `get_financials` | Financial statements by year with trend (EUR cents) |
| `get_company_network` | Companies connected through shared officers and owners |
| `get_company_relations` | Officers, owners, parents, subsidiaries, M&A events |
| `advanced_search` | Paged filtering by country, NACE, size, turnover, status |
| `kyb_check` | One-call KYB/AML summary with a verdict |
| `screen_companies` | KYB screening of up to 25 companies at once |
| `check_compliance` | Public compliance snapshot (no account needed) |
| `find_suppliers` | Public-sector contracts (B2G, not a supply chain) |
| `list_rankings` | Pre-computed leaderboards |

Every tool is read-only, declares an output schema and rejects unknown arguments. Natural-person data is licence-gated server-side and applies identically over MCP. Returned values come from public registers — treat them as untrusted data in your agent, never as instructions.

## Configuration

| Env var | Default | Description |
|---|---|---|
| `ENTYRIX_API_KEY` | *(none)* | Bearer API key from your Entyrix account |
| `ENTYRIX_BASE_URL` | `https://entyrix.com` | Override for staging |
| `ENTYRIX_TIMEOUT_MS` | `60000` | HTTP timeout per request |

## Development

```bash
git clone <repo>
cd entyrix-mcp
npm install
npm run build
npm test
```

Local stdio sanity-check:

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js
```

`npm run test:contract` runs the bridge against the live server (no secret needed).

### Quality gates

```bash
npm run check   # format:check + lint + typecheck + test — the same four CI runs
```

Run `check`, not the four by hand. On 2026-08-12 a release was cut after
`lint + typecheck + test` passed and CI went red on `format:check` — the one
step that got skipped because it was being remembered rather than scripted.

### Releasing

```bash
npm run bump 0.2.2          # writes all four manifests, refuses on drift
npm run check
git commit -am "chore(release): 0.2.2"
git tag v0.2.2
git push && git push --tags   # one push, then the tag
```

The version lives in four files and `src/lib/__tests__/version.test.ts` asserts
they agree; `bump` is what keeps that guard from firing on every release. Push
once — each push is a full CI run, and a release cut as four separate pushes
bills four of them (plus two red ones for the intermediate states).

`npm publish` runs from the tag via OIDC trusted publishing, so no token is
involved. npm versions are immutable: a bad publish cannot be recalled, only
superseded — which is why the tag is checked against `package.json` before
anything is published. The release is idempotent: a re-run skips an npm
version that already exists and waits for npm to serve it before registering
with the MCP Registry.

## License

MIT — see [LICENSE](./LICENSE).
