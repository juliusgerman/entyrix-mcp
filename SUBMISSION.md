# entyrix-mcp — directory submission kit

Drafted metadata + copy for each MCP directory / registry. Copy-paste per target.
Publish `entyrix-mcp` to npm first (that is the canonical distribution the directories reference).

---

## Shared facts (single source of truth)

- **Package name:** `entyrix-mcp` (npm)
- **Version at first submit:** `0.1.0`
- **Transport:** stdio (local, spawned via `npx -y entyrix-mcp`)
- **Runtime:** Node.js ≥ 18
- **Auth:** `ENTYRIX_API_KEY` env var (Bearer token from https://entyrix.com)
- **License:** MIT
- **Homepage:** https://entyrix.com
- **Repo:** https://github.com/juliusgerman/entyrix-mcp
- **Tool count:** 10
- **Tools:** `search_companies`, `lookup_company`, `get_company_details`,
  `get_company_network`, `get_company_relations`, `advanced_search`,
  `check_compliance`, `get_financials`, `find_suppliers`, `list_rankings`
- **Coverage:** SK, CZ, AT, EE, SI, LV, UK + more (16+ EU jurisdictions, growing)
- **Category:** Data / Business intelligence / KYB (Know Your Business)

### One-liner (≤ 120 chars)
> MCP server for the Entyrix European business-registry (KYB) API — search, KYB, financials, compliance & network graphs.

### Short description (≤ 300 chars)
> Query 16+ European business registries through one MCP server. Ten tools cover
> typo-tolerant company search, registry-ID lookup, full company profiles,
> financials, AML/sanctions compliance, public-sector supplier contracts,
> shared-officer network graphs and pre-computed rankings. Bring your own
> Entyrix API key.

### Long description
> Entyrix MCP exposes the Entyrix European business-data API to any MCP client
> (Claude Desktop, Claude Code, Cursor, ChatGPT via Actions). It backs KYB,
> due-diligence, sales-intelligence and compliance workflows: fuzzy company
> search (12 ms p95), country-aware registry-ID resolution, full company
> profiles (financials, tech stack, security posture, NIS2, sanctions, credit
> grade), 38-key advanced filtering, multi-year financial statements,
> public-sector supplier contracts, shared-officer / UBO relation graphs, and
> pre-computed leaderboards — across SK, CZ, AT, EE, SI, LV, UK and more.
> Configure with a single `ENTYRIX_API_KEY`. Runs locally over stdio.

---

## 1. Smithery — https://smithery.ai

Smithery indexes MCP servers from a public GitHub repo containing a
`smithery.yaml` (or auto-detects npm stdio servers). Submit at
https://smithery.ai/new (connect the GitHub repo).

**Fields:**
- **Display name:** Entyrix
- **Qualified name / slug:** `entyrix-mcp` (or `@juliusgerman/entyrix-mcp`)
- **GitHub repo:** https://github.com/juliusgerman/entyrix-mcp
- **Description:** *(short description above)*
- **Homepage:** https://entyrix.com
- **Tags:** company-data, kyb, business-intelligence, eu, registry, compliance, financials
- **License:** MIT

**`smithery.yaml`** (commit to repo root before submitting — stdio, key via env):

```yaml
startCommand:
  type: stdio
  configSchema:
    type: object
    required: ["entyrixApiKey"]
    properties:
      entyrixApiKey:
        type: string
        title: Entyrix API key
        description: Bearer token from https://entyrix.com (dashboard → API keys)
      entyrixBaseUrl:
        type: string
        title: Base URL
        default: https://entyrix.com
        description: Override for staging / self-hosted Entyrix
  commandFunction: |
    (config) => ({
      command: "npx",
      args: ["-y", "entyrix-mcp"],
      env: {
        ENTYRIX_API_KEY: config.entyrixApiKey,
        ...(config.entyrixBaseUrl ? { ENTYRIX_BASE_URL: config.entyrixBaseUrl } : {})
      }
    })
```

---

## 2. Anthropic / official MCP directory

Two related targets:

**(a) `modelcontextprotocol/servers` community list** — PR to
https://github.com/modelcontextprotocol/servers adding a row under
"Third-Party / Community Servers" in the README:

```markdown
- **[Entyrix](https://github.com/juliusgerman/entyrix-mcp)** — European
  business-registry (KYB) data: company search, registry-ID lookup, financials,
  AML/sanctions compliance, supplier contracts and shared-officer network graphs
  across 16+ EU jurisdictions.
```

**(b) MCP Registry (`registry.modelcontextprotocol.io`)** — publish via the
`mcp-publisher` CLI with a `server.json` in the repo root:

```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-07-09/server.schema.json",
  "name": "io.github.juliusgerman/entyrix-mcp",
  "description": "MCP server for the Entyrix European business-registry (KYB) API — search, lookup, financials, compliance and network graphs across 16+ EU jurisdictions.",
  "repository": {
    "url": "https://github.com/juliusgerman/entyrix-mcp",
    "source": "github"
  },
  "version": "0.1.0",
  "packages": [
    {
      "registryType": "npm",
      "identifier": "entyrix-mcp",
      "version": "0.1.0",
      "transport": { "type": "stdio" },
      "environmentVariables": [
        {
          "name": "ENTYRIX_API_KEY",
          "description": "Bearer token from https://entyrix.com",
          "isRequired": true,
          "isSecret": true
        },
        {
          "name": "ENTYRIX_BASE_URL",
          "description": "Override base URL (default https://entyrix.com)",
          "isRequired": false
        }
      ]
    }
  ]
}
```

Publish flow (Julius runs — needs GitHub auth for the `io.github.*` namespace):

```bash
# one-time: install the publisher CLI
brew install mcp-publisher   # or: go install github.com/modelcontextprotocol/registry/cmd/mcp-publisher@latest
mcp-publisher login github
mcp-publisher publish
```

> Anthropic's in-product "Directory" / connector catalog currently curates from
> the MCP Registry + the `modelcontextprotocol/servers` repo, so (a)+(b) cover it.

---

## 3. GitHub repo — `entyrix-mcp`

**Repo name:** `entyrix-mcp`
**Owner:** juliusgerman
**Visibility:** public

**About / description (GitHub repo "About" field, ≤ 350 chars):**
> MCP server for the Entyrix European business-registry (KYB) API. 10 stdio
> tools — company search, registry-ID lookup, financials, AML/sanctions
> compliance, supplier contracts and shared-officer network graphs across 16+
> EU jurisdictions. Bring your own Entyrix API key.

**Website field:** https://entyrix.com

**Topics:** `mcp`, `model-context-protocol`, `kyb`, `company-data`,
`business-intelligence`, `eu`, `business-registry`, `compliance`, `financials`,
`claude`, `llm-tools`

**Create + first push (Julius runs):**

```bash
gh repo create entyrix-mcp --public \
  --description "MCP server for the Entyrix European business-registry (KYB) API — 10 tools across 16+ EU jurisdictions." \
  --homepage "https://entyrix.com" --source . --remote origin --push
gh repo edit --add-topic mcp,model-context-protocol,kyb,company-data,business-intelligence,eu,business-registry,compliance,financials,claude,llm-tools
```

---

## Submission order

1. `npm publish` (see main report) → package live on npm.
2. `gh repo create` + push → public GitHub repo.
3. Add `smithery.yaml` + `server.json` to repo, commit, push.
4. Submit to Smithery (connect repo).
5. `mcp-publisher publish` → MCP Registry.
6. PR to `modelcontextprotocol/servers` README.
