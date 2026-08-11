/**
 * The package version, in ONE place.
 *
 * Before this file the string "0.1.0" was written out five times — package.json,
 * server.json twice (server + package entry), the MCP server handshake in
 * index.ts, and the outgoing User-Agent in client.ts. A release bump touches
 * five files and the two that nobody sees at runtime (User-Agent, handshake)
 * are exactly the ones a bump forgets: nothing breaks, the wire just starts
 * lying about which build is talking.
 *
 * Kept as a constant rather than a runtime read of package.json so the server
 * does no filesystem work at startup. Drift is caught by
 * `__tests__/version.test.ts`, which asserts this equals package.json and both
 * version fields in server.json — a bump that misses one goes red.
 */
export const VERSION = "0.1.1";
