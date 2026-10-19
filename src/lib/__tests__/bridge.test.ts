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

  const call = (id: number, name = "lookup_company") =>
    JSON.stringify({ jsonrpc: "2.0", id, method: "tools/call", params: { name } });
  const reject = (status: number, error: Record<string, unknown>) =>
    fakeFetch((b) => ({ status, body: { jsonrpc: "2.0", id: b.id, error } }));

  it("401 on a tool call without a key becomes an isError result with the sign-up steps and the server offer", async () => {
    const offer = { get_access: { signup: "https://entyrix.com/login" } };
    const f = reject(401, { code: -32001, message: "Authentication required", data: offer });
    const out = JSON.parse((await new Bridge(cfg(undefined), f.impl).handleLine(call(1)))[0]!);
    expect(f.sent[0]!.headers.authorization).toBeUndefined();
    expect(out.error).toBeUndefined();
    expect(out.result.isError).toBe(true);
    const text = out.result.content.map((c: { text: string }) => c.text).join("\n");
    expect(text).toMatch(/ENTYRIX_API_KEY is not set/);
    expect(text).toContain("https://entyrix.test/login");
    expect(text).toContain("POST https://entyrix.test/api/v1/signup ");
    expect(text).toContain("POST https://entyrix.test/api/v1/signup/verify");
    expect(text).toContain("https://entyrix.test/mcp");
    expect(text).toContain("https://entyrix.test/pricing");
    expect(text).not.toContain("api-signup");
    expect(text).toContain(JSON.stringify(offer));
  });

  it("401 with a rejected key says so; non-tool methods keep a JSON-RPC error", async () => {
    const f = reject(401, { code: -32001, message: "Authentication required" });
    const bad = JSON.parse((await new Bridge(cfg("sk_bad"), f.impl).handleLine(call(2)))[0]!);
    expect(bad.result.isError).toBe(true);
    expect(bad.result.content[0].text).toMatch(/rejected/);
    const list = JSON.parse(
      (
        await new Bridge(cfg(undefined), f.impl).handleLine(
          JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/list" })
        )
      )[0]!
    );
    expect(list.error.message).toMatch(/ENTYRIX_API_KEY is not set/);
  });

  it.each([402, 403, 429])(
    "%i on a tool call repeats message and upgrade offer",
    async (status) => {
      const f = reject(status, {
        code: -32002,
        message: "Plan required",
        data: {
          message: "Upgrade to Pro for this route.",
          upgrade: { pricing: "https://x/pricing" },
        },
      });
      const out = JSON.parse((await new Bridge(cfg("k"), f.impl).handleLine(call(4)))[0]!);
      expect(out.result.isError).toBe(true);
      const text = out.result.content[0].text as string;
      expect(text).toContain("Plan required");
      expect(text).toContain("Upgrade to Pro for this route.");
      expect(text).toContain('"pricing":"https://x/pricing"');
      expect(text).not.toContain("get_access_status");
    }
  );

  it("mentions get_access_status only after tools/list offers it", async () => {
    let listed: string[] = [];
    const f = fakeFetch((b) =>
      b.method === "tools/list"
        ? {
            status: 200,
            body: { jsonrpc: "2.0", id: b.id, result: { tools: listed.map((name) => ({ name })) } },
          }
        : {
            status: 429,
            body: { jsonrpc: "2.0", id: b.id, error: { code: -32003, message: "Quota used" } },
          }
    );
    const br = new Bridge(cfg("k"), f.impl);
    const text = async (id: number) =>
      JSON.parse((await br.handleLine(call(id)))[0]!).result.content[0].text as string;
    expect(await text(5)).not.toContain("get_access_status");
    listed = ["company_brief", "get_access_status"];
    await br.handleLine(JSON.stringify({ jsonrpc: "2.0", id: 6, method: "tools/list" }));
    expect(await text(7)).toContain("get_access_status");
  });

  it("an isError tool result from a 429 passes through untouched when the tool is not offered", async () => {
    const body = (id: unknown) => ({
      jsonrpc: "2.0",
      id,
      result: { isError: true, content: [{ type: "text", text: "Quota. Upgrade: https://x" }] },
    });
    const f = fakeFetch((b) => ({ status: 429, body: body(b.id) }));
    const out = JSON.parse((await new Bridge(cfg("k"), f.impl).handleLine(call(8)))[0]!);
    expect(out).toEqual(body(8));
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
