#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { clientFromEnv } from "./lib/client.js";
import { registerSearchCompanies } from "./tools/search-companies.js";
import { registerLookupCompany } from "./tools/lookup-company.js";
import { registerGetCompanyDetails } from "./tools/get-company-details.js";
import { registerAdvancedSearch } from "./tools/advanced-search.js";
import { registerCheckCompliance } from "./tools/check-compliance.js";
import { registerGetFinancials } from "./tools/get-financials.js";
import { registerFindSuppliers } from "./tools/find-suppliers.js";
import { registerListRankings } from "./tools/list-rankings.js";

async function main(): Promise<void> {
  const client = clientFromEnv();

  const server = new McpServer({
    name: "entyrix-mcp",
    version: "0.0.1",
  });

  registerSearchCompanies(server, client);
  registerLookupCompany(server, client);
  registerGetCompanyDetails(server, client);
  registerAdvancedSearch(server, client);
  registerCheckCompliance(server, client);
  registerGetFinancials(server, client);
  registerFindSuppliers(server, client);
  registerListRankings(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Server now reads from stdin / writes to stdout for the lifetime of the process.
  // No console.log here — stdout is reserved for the MCP wire protocol.
}

main().catch((err) => {
  // MCP stdio reserves stdout for protocol frames; diagnostics go to stderr.
  process.stderr.write(
    `[entyrix-mcp] fatal: ${err instanceof Error ? err.message : String(err)}\n`
  );
  process.exit(1);
});
