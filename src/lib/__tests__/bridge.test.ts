/**
 * The stdio bridge — offline, with a fake `fetch` that records what was sent.
 *
 * What matters most is what reaches the remote server: the key, the protocol
 * version, and the mirrored Mcp-Method / Mcp-Name headers. A bridge that loses
 * any of them still "works" against a lenient server and fails against the
 * 2026-07-28 header validation — so the headers are asserted, not inferred.
 */
import { describe, it, expect } from "vitest";
import { Bridge, headerValue } from "../bridge.js";

interface Sent {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

function fakeFetch(
  reply: (body: Record<string, unknown>) => { status: number; body?: unknown; ctype?: string }
) {
  const sent: Sent[] = [];
  const impl = async (url: string, init: RequestInit): Promise<Response> => {
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    sent.push({ url, headers: init.headers as Record<string, string>, body });
    const r = reply(body);
    const text =
      r.body === undefined ? "" : typeof r.body === "string" ? r.body : JSON.stringify(r.body);
    return new Response(r.status === 202 ? null : text, {
      status: r.status,
      headers: { "content-type": r.ctype ?? "application/json" },
    });
  };
  return { sent, impl };
}

const cfg = (apiKey?: string) => ({
  apiKey,
  baseUrl: "https://entyrix.test/",
  timeoutMs: 5000,
  userAgent: "entyrix-mcp/test",
});

describe("Bridge", () => {
  it("forwards to /mcp/v1 with the key, Mcp-Method and Mcp-Name", async () => {
    const f = fakeFetch((b) => ({
      status: 200,
      body: { jsonrpc: "2.0", id: b.id, result: { content: [] } },
    }));
    const br = new Bridge(cfg("sk_live_x"), f.impl);
    const out = await br.handleLine(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "company_brief", arguments: {} },
      })
    );
    expect(f.sent[0]!.url).toBe("https://entyrix.test/mcp/v1");
    expect(f.sent[0]!.headers.authorization).toBe("Bearer sk_live_x");
    expect(f.sent[0]!.headers["mcp-method"]).toBe("tools/call");
    expect(f.sent[0]!.headers["mcp-name"]).toBe("company_brief");
    expect(JSON.parse(out[0]!).id).toBe(1);
  });

  it("remembers the version negotiated in initialize and sends it afterwards", async () => {
    const f = fakeFetch((b) =>
      b.method === "initialize"
        ? {
            status: 200,
            body: { jsonrpc: "2.0", id: b.id, result: { protocolVersion: "2025-06-18" } },
          }
        : { status: 200, body: { jsonrpc: "2.0", id: b.id, result: { tools: [] } } }
    );
    const br = new Bridge(cfg("k"), f.impl);
    await br.handleLine(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-06-18" },
      })
    );
    expect(f.sent[0]!.headers["mcp-protocol-version"]).toBeUndefined();
    await br.handleLine(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }));
    expect(f.sent[1]!.headers["mcp-protocol-version"]).toBe("2025-06-18");
  });

  it("modern clients: the version comes from _meta", async () => {
    const f = fakeFetch((b) => ({ status: 200, body: { jsonrpc: "2.0", id: b.id, result: {} } }));
    const br = new Bridge(cfg("k"), f.impl);
    await br.handleLine(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "server/discover",
        params: { _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28" } },
      })
    );
    expect(f.sent[0]!.headers["mcp-protocol-version"]).toBe("2026-07-28");
  });

  it("notifications produce no output (202)", async () => {
    const f = fakeFetch(() => ({ status: 202 }));
    const br = new Bridge(cfg("k"), f.impl);
    expect(
      await br.handleLine(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }))
    ).toEqual([]);
  });

  it("401 without a key tells the user to set ENTYRIX_API_KEY; with a key, that it was rejected", async () => {
    const f = fakeFetch((b) => ({
      status: 401,
      body: {
        jsonrpc: "2.0",
        id: b.id,
        error: { code: -32001, message: "Authentication required" },
      },
    }));
    const noKey = await new Bridge(cfg(undefined), f.impl).handleLine(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "lookup_company" },
      })
    );
    expect(f.sent[0]!.headers.authorization).toBeUndefined();
    expect(JSON.parse(noKey[0]!).error.message).toMatch(/Set ENTYRIX_API_KEY/);
    const bad = await new Bridge(cfg("sk_bad"), f.impl).handleLine(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "lookup_company" },
      })
    );
    expect(JSON.parse(bad[0]!).error.message).toMatch(/rejected/);
  });

  it("network failure and non-JSON bodies become JSON-RPC errors for requests", async () => {
    const down = new Bridge(cfg("k"), async () => {
      throw new Error("ECONNREFUSED");
    });
    expect(
      JSON.parse(
        (await down.handleLine(JSON.stringify({ jsonrpc: "2.0", id: 9, method: "tools/list" })))[0]!
      ).error.code
    ).toBe(-32603);
    const html = fakeFetch(() => ({
      status: 502,
      body: "<html>bad gateway</html>",
      ctype: "text/html",
    }));
    const out = await new Bridge(cfg("k"), html.impl).handleLine(
      JSON.stringify({ jsonrpc: "2.0", id: 10, method: "tools/list" })
    );
    expect(JSON.parse(out[0]!).error.message).toMatch(/HTTP 502/);
  });

  it("parses SSE responses", async () => {
    const f = fakeFetch((b) => ({
      status: 200,
      ctype: "text/event-stream",
      body: `: keep-alive\n\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: b.id, result: { ok: true } })}\n\n`,
    }));
    const out = await new Bridge(cfg("k"), f.impl).handleLine(
      JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/list" })
    );
    expect(JSON.parse(out[0]!).result.ok).toBe(true);
  });

  it("malformed input and batches are answered locally, never forwarded", async () => {
    const f = fakeFetch(() => ({ status: 200, body: {} }));
    const br = new Bridge(cfg("k"), f.impl);
    expect(JSON.parse((await br.handleLine("{oops"))[0]!).error.code).toBe(-32700);
    expect(JSON.parse((await br.handleLine("[]"))[0]!).error.code).toBe(-32600);
    expect(f.sent).toHaveLength(0);
  });

  it("a cancelled request gets no response", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const br = new Bridge(cfg("k"), async (_u, init) => {
      await new Promise<void>((resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        void gate.then(resolve);
      });
      return new Response("{}", { status: 200 });
    });
    const p = br.handleLine(
      JSON.stringify({ jsonrpc: "2.0", id: 42, method: "tools/call", params: { name: "x" } })
    );
    await br.handleLine(
      JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/cancelled",
        params: { requestId: 42 },
      })
    );
    expect(await p).toEqual([]);
    release();
  });
});

describe("headerValue", () => {
  it("plain ASCII stays, everything else uses the Base64 sentinel", () => {
    expect(headerValue("company_brief")).toBe("company_brief");
    expect(headerValue("entyrix://company/SK/1")).toBe("entyrix://company/SK/1");
    expect(headerValue("Hello, 世界")).toBe(
      `=?base64?${Buffer.from("Hello, 世界").toString("base64")}?=`
    );
    expect(headerValue(" padded ")).toMatch(/^=\?base64\?/);
    expect(headerValue("=?base64?literal?=")).toMatch(/^=\?base64\?PT9i/);
  });
});
