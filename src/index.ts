#!/usr/bin/env node
/**
 * @entyrix/mcp — stdio bridge to the remote Entyrix MCP server.
 *
 * Reads newline-delimited JSON-RPC from stdin, forwards each message to
 * https://entyrix.com/mcp/v1 (see `lib/bridge.ts` for why this package no
 * longer implements tools itself), writes replies to stdout.
 *
 * stdout carries protocol frames ONLY; diagnostics go to stderr.
 */
import { createInterface } from "node:readline";
import { Bridge } from "./lib/bridge.js";
import { VERSION } from "./lib/version.js";

const timeout = Number(process.env.ENTYRIX_TIMEOUT_MS ?? "60000");
const bridge = new Bridge({
  apiKey: process.env.ENTYRIX_API_KEY?.trim() || undefined,
  baseUrl: process.env.ENTYRIX_BASE_URL?.trim() || "https://entyrix.com",
  timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : 60000,
  userAgent: `entyrix-mcp/${VERSION} (stdio bridge)`,
});

if (!process.env.ENTYRIX_API_KEY) {
  process.stderr.write(
    "[entyrix-mcp] ENTYRIX_API_KEY is not set — discovery and public tools work, data tools will ask for a key.\n"
  );
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
let pending = 0;
let closing = false;

rl.on("line", (line) => {
  pending++;
  // Requests run concurrently; each reply is one line, written whole.
  bridge
    .handleLine(line)
    .then((out) => {
      for (const l of out) process.stdout.write(`${l}\n`);
    })
    .catch((err) => {
      process.stderr.write(`[entyrix-mcp] ${err instanceof Error ? err.message : String(err)}\n`);
    })
    .finally(() => {
      pending--;
      if (closing && pending === 0) process.exit(0);
    });
});

rl.on("close", () => {
  closing = true;
  if (pending === 0) process.exit(0);
});
