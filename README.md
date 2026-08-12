# @entyrix/mcp

[![npm](https://img.shields.io/npm/v/@entyrix/mcp)](https://www.npmjs.com/package/@entyrix/mcp)


Model Context Protocol (MCP) server for the [Entyrix](https://entyrix.com) European business-registry (KYB) API. Exposes 10 stdio tools so LLM clients (Claude Desktop, Claude Code, Cursor, ChatGPT) can search, look up, and analyze companies across 23 live markets (FR, GB, RO, SK, UA, GR, CZ, BE, NO, IE, FI, CH, PL, AT, CY, LT, LV, EE, SI, ES, IT, NL, HR).

## 30-second quickstart

```bash
npm install -g @entyrix/mcp
export ENTYRIX_API_KEY=your-api-key-here
entyrix-mcp
```

Or run without installing:

```bash
export ENTYRIX_API_KEY=your-api-key-here
npx @entyrix/mcp
```

Get an API key at <https://entyrix.com>.

## Tools

| Tool | Description |
|---|---|
| `search_companies` | Fuzzy/typo-tolerant name search (server-side 26-62 ms cold, ~1 ms cached; measured 2026-08-11) |
| `lookup_company` | Resolve a company by national registry ID, country-aware (SK/CZ/AT/EE/SI/LV/…) |
| `get_company_details` | Full profile: financials, tech stack, security, NIS2, sanctions, credit grade |
| `get_company_network` | Shared-officer graph — related entities via common directors/officers |
| `get_company_relations` | Directors, UBO / beneficial owners, M&A and succession links |
| `advanced_search` | 57-key filter search (country, NACE, turnover, credit grade, NIS2, sanctions, tech, …) |
| `check_compliance` | AML / sanctions / debtor lists / RPVS check (SK) |
| `get_financials` | Last N years of turnover, profit, EBITDA, ROA, ROE |
| `find_suppliers` | Public-sector contracts where company is supplier (SK CRZ) |
| `list_rankings` | Pre-computed leaderboards (top turnover, top employers, …) |

## Configuration

| Env var | Default | Description |
|---|---|---|
| `ENTYRIX_API_KEY` | *(required)* | Bearer token from your Entyrix dashboard |
| `ENTYRIX_BASE_URL` | `https://entyrix.com` | Override for staging / self-hosted |
| `ENTYRIX_TIMEOUT_MS` | `30000` | HTTP timeout per request |

## Client setup

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "entyrix": {
      "command": "npx",
      "args": ["-y", "@entyrix/mcp"],
      "env": {
        "ENTYRIX_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

Restart Claude Desktop. The 10 tools appear in the tools panel.

### Claude Code

Register the server from any project (writes to `~/.claude.json`):

```bash
claude mcp add entyrix --env ENTYRIX_API_KEY=your-api-key-here -- npx -y @entyrix/mcp
```

Or add it manually to `.mcp.json` in your project root (checked in) / `~/.claude.json` (global):

```json
{
  "mcpServers": {
    "entyrix": {
      "command": "npx",
      "args": ["-y", "@entyrix/mcp"],
      "env": {
        "ENTYRIX_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Cursor

Edit `.cursor/mcp.json` in your workspace (or `~/.cursor/mcp.json` for global):

```json
{
  "mcpServers": {
    "entyrix": {
      "command": "npx",
      "args": ["-y", "@entyrix/mcp"],
      "env": {
        "ENTYRIX_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### ChatGPT

ChatGPT does not consume MCP stdio servers directly today. Two integration paths:

**1. Custom GPT Actions** — expose Entyrix endpoints as OpenAPI actions. Sketch:

```yaml
openapi: 3.1.0
info:
  title: Entyrix
  version: 0.1.0
servers:
  - url: https://entyrix.com/api/v1
paths:
  /companies/autocomplete:
    get:
      operationId: searchCompanies
      parameters:
        - name: q
          in: query
          required: true
          schema: { type: string }
        - name: country
          in: query
          schema: { type: string, minLength: 2, maxLength: 2 }
      responses:
        "200": { description: OK }
  /companies/{country}/{national_id}:
    get:
      operationId: lookupCompany
      parameters:
        - { name: country, in: path, required: true, schema: { type: string } }
        - { name: national_id, in: path, required: true, schema: { type: string } }
      responses:
        "200": { description: OK }
components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
security:
  - BearerAuth: []
```

Paste this into the Custom GPT builder, set the auth header, and the Entyrix endpoints become first-class GPT actions.

**2. Connectors API (enterprise)** — `<https://platform.openai.com/docs/connectors>` accepts MCP servers behind an HTTP wrapper; a small HTTP-to-stdio adapter is on the roadmap.

## Development

```bash
git clone <repo>
cd entyrix-mcp
npm install
npm run build
npm test
```

Local stdio sanity-check (requires a real API key):

```bash
ENTYRIX_API_KEY=your-key node dist/index.js
# (stdin/stdout speaks MCP — wire it to a client to actually issue calls)
```

### Quality gates

Every PR must pass:

```bash
npm run format
npm run lint
npx tsc --noEmit
npm test
```

## License

MIT — see [LICENSE](./LICENSE).
