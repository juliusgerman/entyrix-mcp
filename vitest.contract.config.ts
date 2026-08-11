/**
 * The contract suite runs against the LIVE published spec, so it is kept out
 * of `npm test` — the unit suite must stay offline and instant, and a network
 * dependency in the pre-commit path teaches people to bypass it.
 *
 * Kept as its own file rather than an env-gated skip inside the main config:
 * a suite that skips itself when a variable is unset is indistinguishable from
 * a suite that passed.
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["src/**/*.contract.ts"],
    testTimeout: 60000,
  },
});
