// Lightweight test harness:
//   - Captures the callback that each tool registers with the MCP server,
//     so tests can invoke the handler in isolation without spinning up stdio.
//   - Wires Node's native fetch (undici) to a MockAgent so we can stub the
//     Entyrix REST API without real network access.
//
// `McpServer.registerTool(name, def, handler)` is the only surface we need.

import {
  MockAgent,
  setGlobalDispatcher,
  getGlobalDispatcher,
  Dispatcher,
  fetch as undiciFetch,
} from "undici";

type ToolHandler = (args: any) => Promise<{ content: Array<{ type: string; text: string }> }>;

export interface CapturedTool {
  name: string;
  title?: string;
  description: string;
  handler: ToolHandler;
}

export function createCaptureServer(): { server: any; tools: Map<string, CapturedTool> } {
  const tools = new Map<string, CapturedTool>();
  const server = {
    registerTool(
      name: string,
      def: { title?: string; description: string; inputSchema: unknown },
      handler: ToolHandler
    ) {
      tools.set(name, {
        name,
        title: def.title,
        description: def.description,
        handler,
      });
    },
  };
  return { server, tools };
}

// ─── HTTP mocking ────────────────────────────────────────────────────────
// We stub the Entyrix base URL via undici's MockAgent; Node's global fetch
// uses this dispatcher transparently.

export const TEST_BASE_URL = "https://entyrix.test";

let originalDispatcher: Dispatcher | null = null;
let originalFetch: typeof globalThis.fetch | null = null;
let agent: MockAgent | null = null;

export function setupMockAgent(): MockAgent {
  originalDispatcher = getGlobalDispatcher();
  agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  // Node ships its OWN copy of undici, and `globalThis.fetch` reads that
  // copy's global dispatcher — not the one the userland `undici` package just
  // set. From Node 26 the two no longer coincide, so every mock silently
  // stopped intercepting and every test in this directory failed with
  // `fetch failed` (a real DNS lookup for entyrix.test). `disableNetConnect`
  // could not save it either, for the same reason. Point `fetch` at the copy
  // whose dispatcher we actually control, for the duration of the mock.
  originalFetch = globalThis.fetch;
  globalThis.fetch = undiciFetch as unknown as typeof globalThis.fetch;
  return agent;
}

export async function teardownMockAgent(): Promise<void> {
  if (agent) {
    await agent.close();
    agent = null;
  }
  if (originalFetch) {
    globalThis.fetch = originalFetch;
    originalFetch = null;
  }
  if (originalDispatcher) {
    setGlobalDispatcher(originalDispatcher);
    originalDispatcher = null;
  }
}

export function getMockPool(baseUrl: string = TEST_BASE_URL) {
  if (!agent) {
    throw new Error("Mock agent not initialized — call setupMockAgent() in beforeAll.");
  }
  return agent.get(baseUrl);
}
