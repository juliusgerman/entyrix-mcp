# entyrix-mcp — directory submission kit

Drafted metadata + copy for each MCP directory / registry. Copy-paste per target.
Publish `@entyrix/mcp` to npm first (that is the canonical distribution the directories reference).

---

## Shared facts (single source of truth)

- **Package name:** `@entyrix/mcp` (npm, org-owned; the binary it installs is still `entyrix-mcp`)
- **Version at first submit:** `0.1.1`
- **Transport:** stdio (local, spawned via `npx -y @entyrix/mcp`)
- **Runtime:** Node.js ≥ 18
- **Auth:** `ENTYRIX_API_KEY` env var (Bearer token from https://entyrix.com)
- **License:** MIT
- **Homepage:** https://entyrix.com
- **Repo:** https://github.com/juliusgerman/entyrix-mcp
- **Tool count:** 10
- **Tools:** `search_companies`, `lookup_company`, `get_company_details`,
  `get_company_network`, `get_company_relations`, `advanced_search`,
  `check_compliance`, `get_financials`, `find_suppliers`, `list_rankings`
- **Coverage:** 23 live markets: FR, GB, RO, SK, UA, GR, CZ, BE, NO, IE, FI, CH, PL, AT, CY, LT, LV, EE, SI, ES, IT, NL, HR
- **Category:** Data / Business intelligence / KYB (Know Your Business)

### One-liner (≤ 120 chars)
> MCP server for the Entyrix European business-registry (KYB) API — search, KYB, financials, compliance & network graphs.

### Short description (≤ 300 chars)
> Query 23 European business registries through one MCP server. Ten tools cover
> typo-tolerant company search, registry-ID lookup, full company profiles,
> financials, AML/sanctions compliance, public-sector supplier contracts,
> shared-officer network graphs and pre-computed rankings. Bring your own
> Entyrix API key.

### Long description
> Entyrix MCP exposes the Entyrix European business-data API to any MCP client
> (Claude Desktop, Claude Code, Cursor, ChatGPT via Actions). It backs KYB,
> due-diligence, sales-intelligence and compliance workflows: fuzzy company
> search, country-aware registry-ID resolution, full company
> profiles (financials, tech stack, security posture, NIS2, sanctions, credit
> grade), 57-key advanced filtering, multi-year financial statements,
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
- **Qualified name / slug:** `entyrix-mcp` (the GitHub repo name; the npm coordinate is `@entyrix/mcp`)
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
      args: ["-y", "@entyrix/mcp"],
      env: {
        ENTYRIX_API_KEY: config.entyrixApiKey,
        ...(config.entyrixBaseUrl ? { ENTYRIX_BASE_URL: config.entyrixBaseUrl } : {})
      }
    })
```

---

## 2. Anthropic / official MCP directory

Two related targets:

**(a) `modelcontextprotocol/servers` community list — RETIRED, do not submit.**
Checked 2026-08-11 against that repo's CONTRIBUTING.md: *"The README no longer
contains a list of third-party MCP servers — that list has been retired in
favor of the MCP Server Registry"*, and under what they don't accept: *"New
server implementations"*. A PR adding a row would be closed. Discovery now runs
entirely through (b).

**(b) MCP Registry (`registry.modelcontextprotocol.io`)** — publish via the
`mcp-publisher` CLI with a `server.json` in the repo root:

```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "io.github.juliusgerman/entyrix-mcp",
  "description": "MCP server for the Entyrix European business-registry (KYB) API — search, lookup, financials, compliance and network graphs across 23 live European markets.",
  "repository": {
    "url": "https://github.com/juliusgerman/entyrix-mcp",
    "source": "github"
  },
  "version": "0.1.1",
  "packages": [
    {
      "registryType": "npm",
      "identifier": "@entyrix/mcp",
      "version": "0.1.1",
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
brew install mcp-publisher   # 1.8.1 as of 2026-08-11
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
> compliance, supplier contracts and shared-officer network graphs across 23
> live European markets. Bring your own Entyrix API key.

**Website field:** https://entyrix.com

**Topics:** `mcp`, `model-context-protocol`, `kyb`, `company-data`,
`business-intelligence`, `eu`, `business-registry`, `compliance`, `financials`,
`claude`, `llm-tools`

**Create + first push (Julius runs):**

```bash
gh repo create entyrix-mcp --public \
  --description "MCP server for the Entyrix European business-registry (KYB) API — 10 tools across 23 live European markets." \
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

---

## Stav submitov — namerané 2026-08-11 (nie odhad)

| Cieľ | Stav | Mechanizmus |
|---|---|---|
| **Oficiálny MCP Registry** | ✅ **HOTOVO** | `mcp-publisher publish` → `io.github.juliusgerman/entyrix-mcp@0.1.1`, overené spätným dotazom na `registry.modelcontextprotocol.io/v0/servers?search=entyrix` |
| **PulseMCP** | ⏳ **automaticky** | Ich `/submit` hovorí: *„We ingest entries from the Official MCP Registry daily and process them weekly."* Netreba nič. Kontrola: `api.pulsemcp.com/v0beta/servers?query=entyrix` (2026-08-11: ešte 0 — týždenný cyklus) |
| **`modelcontextprotocol/servers` README** | ❌ **zrušené** | Zoznam retired, CONTRIBUTING vyslovene neprijíma nové servery. PR by bol zavretý. |
| **Smithery** | 🔒 **účet** | Už NEindexuje z GitHub repa so `smithery.yaml`, ako tvrdilo staršie znenie tohto dokumentu. Chce **účet** + publish **MCPB bundle** (`smithery mcp publish ./server.mcpb -n <ns>/<name>` alebo upload na `smithery.ai/new`). |
| **mcp.so** | 🔒 **účet** | `/submit` redirectuje (307) na prihlásenie. |

**Poradie hodnoty:** registry je ten, na ktorom záleží — Anthropic aj PulseMCP z neho čerpajú.
Smithery a mcp.so sú doplnkové a stoja jeden login každý.

**Pri ďalšom release** stačí bumpnúť `version` v `package.json` + `server.json`, `npm publish`
a `mcp-publisher publish`. Login do registry drží token, netreba ho opakovať.

**Limit, na ktorý sa dá naraziť:** `server.json.description` musí byť **≤ 100 znakov** — registry
inak vráti 422. Strážené testom (`src/lib/__tests__/version.test.ts`).
