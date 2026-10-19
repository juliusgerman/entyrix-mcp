/**
 * stdio → Streamable HTTP most na vzdialený server Entyrix (`/mcp/v1`).
 *
 * WHY A BRIDGE AND NOT A SECOND SERVER
 * ────────────────────────────────────
 * Until 0.1.x this package carried its own copy of every tool (zod schemas,
 * handlers, a REST client). The remote server at entyrix.com/mcp/v1 carried
 * another. Two catalogues of the same product drift — and they did: the
 * remote server gained tools, schemas, output schemas and annotations that
 * this package never saw. From 0.2.0 the package implements NOTHING itself: it
 * reads newline-delimited JSON-RPC from stdin, forwards each message to the
 * remote server with the API key from the environment, and writes the reply to
 * stdout. One implementation, one catalogue, no drift possible.
 *
 * It also means zero runtime dependencies. A local MCP server runs with the
 * user's privileges; every dependency is supply-chain surface (the
 * `postmark-mcp` rug pull, 2025-09, shipped through exactly this channel).
 *
 * WHAT IT FORWARDS
 *   • `Authorization: Bearer <ENTYRIX_API_KEY>` (omitted when unset — discovery
 *     and the public tools still work, data tools answer with a clear error).
 *   • `MCP-Protocol-Version` — from the request `_meta` (modern clients) or the
 *     version the server answered to `initialize` (legacy clients).
 *   • `Mcp-Method` / `Mcp-Name` mirrored from the body, as the 2026-07-28
 *     transport requires (Base64 sentinel for non-ASCII names).
 */

export interface BridgeConfig {
  apiKey: string | undefined;
  baseUrl: string;
  timeoutMs: number;
  userAgent: string;
}

type Json = Record<string, unknown>;
type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

const NEXT_STEP_STATUSES = new Set([402, 403, 429]);
const ACCESS_STATUS_TOOL = "get_access_status";

/** How to get a key, one text for every "you have no access" message. */
export function accessHelp(base: string): string {
  return [
    "Ways to get access:",
    `1. Sign in at ${base}/login - an account comes with a Free API key. Set it as ENTYRIX_API_KEY.`,
    `2. Without a browser: POST ${base}/api/v1/signup with JSON {"email": "...", "accept_terms": "<current terms version>"} (terms: ${base}/terms; a wrong value is answered with the current version), then POST ${base}/api/v1/signup/verify with {"email": "...", "code": "<code from the e-mail>"}. The response contains api_key, shown once.`,
    `3. Remote MCP server with OAuth, no key in a config file: ${base}/mcp - the client signs you in itself.`,
    `Plans and limits: ${base}/pricing`,
  ].join("\n");
}

const PV_META = "io.modelcontextprotocol/protocolVersion";

function rpcError(id: unknown, code: number, message: string, data?: unknown): Json {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code, message, ...(data !== undefined ? { data } : {}) },
  };
}

/** Header-safe value or the spec's Base64 sentinel (`=?base64?…?=`). */
export function headerValue(v: string): string {
  const plain = /^[\x21-\x7e]([\x20-\x7e]*[\x21-\x7e])?$/.test(v) && !/^=\?base64\?.*\?=$/.test(v);
  return plain ? v : `=?base64?${Buffer.from(v, "utf8").toString("base64")}?=`;
}

/** Parse an SSE body into the JSON-RPC messages carried in its `data:` lines. */
function parseSse(text: string): Json[] {
  const out: Json[] = [];
  for (const block of text.split(/\r?\n\r?\n/)) {
    const data = block
      .split(/\r?\n/)
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trimStart())
      .join("\n");
    if (!data) continue;
    try {
      out.push(JSON.parse(data) as Json);
    } catch {
      /* comment / keep-alive */
    }
  }
  return out;
}

export class Bridge {
  /** Version the server answered to `initialize` (legacy clients). */
  private negotiated: string | undefined;
  /** Tool names from the last `tools/list`, to word hints by what the server really offers. */
  private toolNames = new Set<string>();
  private readonly inflight = new Map<string, AbortController>();
  /** Requests the client cancelled — they get no response at all. */
  private readonly cancelled = new Set<string>();

  constructor(
    private readonly config: BridgeConfig,
    private readonly fetchImpl: FetchLike = fetch
  ) {}

  private endpoint(): string {
    return `${this.config.baseUrl.replace(/\/+$/, "")}/mcp/v1`;
  }

  /**
   * Handle one line from stdin. Returns the lines to write to stdout (zero for
   * notifications, one or more for a request).
   */
  async handleLine(line: string): Promise<string[]> {
    if (line.trim() === "") return [];
    let msg: Json;
    try {
      msg = JSON.parse(line) as Json;
    } catch {
      return [JSON.stringify(rpcError(null, -32700, "Parse error"))];
    }
    if (Array.isArray(msg)) {
      return [JSON.stringify(rpcError(null, -32600, "JSON-RPC batching is not supported"))];
    }
    const method = typeof msg.method === "string" ? msg.method : undefined;
    // A response from the client to a server request — the remote server never
    // sends requests (stateless, MRTR), so there is nothing to route it to.
    if (!method) return [];
    const id = msg.id;
    const isRequest = id !== undefined && id !== null;
    const params = (msg.params && typeof msg.params === "object" ? msg.params : {}) as Json;

    // stdio cancellation: abort the matching in-flight HTTP request. On the HTTP
    // side closing the request IS the cancellation, so nothing is forwarded.
    if (method === "notifications/cancelled") {
      const target = params.requestId;
      if (target !== undefined) {
        const k = JSON.stringify(target);
        const c = this.inflight.get(k);
        if (c) {
          this.cancelled.add(k);
          c.abort();
        }
      }
      return [];
    }

    const meta = (params._meta && typeof params._meta === "object" ? params._meta : {}) as Json;
    const version = typeof meta[PV_META] === "string" ? (meta[PV_META] as string) : this.negotiated;
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "user-agent": this.config.userAgent,
      "mcp-method": method,
    };
    if (this.config.apiKey) headers.authorization = `Bearer ${this.config.apiKey}`;
    if (version) headers["mcp-protocol-version"] = version;
    const name =
      method === "resources/read"
        ? params.uri
        : method === "tools/call" || method === "prompts/get"
          ? params.name
          : undefined;
    if (typeof name === "string") headers["mcp-name"] = headerValue(name);

    const controller = new AbortController();
    const key = isRequest ? JSON.stringify(id) : undefined;
    if (key) this.inflight.set(key, controller);
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    let res: Response;
    let text: string;
    try {
      res = await this.fetchImpl(this.endpoint(), {
        method: "POST",
        headers,
        body: JSON.stringify(msg),
        signal: controller.signal,
      });
      text = await res.text();
    } catch (err) {
      if (!isRequest) return [];
      // A cancelled request gets no response (MCP cancellation rules).
      if (key && this.cancelled.delete(key)) return [];
      return [
        JSON.stringify(
          rpcError(
            id,
            -32603,
            `Entyrix MCP server unreachable: ${err instanceof Error ? err.message : String(err)}`
          )
        ),
      ];
    } finally {
      clearTimeout(timer);
      if (key) this.inflight.delete(key);
    }

    if (!isRequest) return [];
    if (res.status === 202) return [];

    const ctype = res.headers.get("content-type") ?? "";
    const messages: Json[] = ctype.includes("text/event-stream")
      ? parseSse(text)
      : (() => {
          try {
            return [JSON.parse(text) as Json];
          } catch {
            return [];
          }
        })();

    if (messages.length === 0) {
      return [
        JSON.stringify(
          rpcError(id, -32603, `Entyrix returned HTTP ${res.status} without a JSON-RPC body`)
        ),
      ];
    }

    return messages.map((m) => {
      if (method === "initialize" && m.result && typeof m.result === "object") {
        const pv = (m.result as Json).protocolVersion;
        if (typeof pv === "string") this.negotiated = pv;
      }
      if (method === "tools/list" && m.result && typeof m.result === "object") {
        this.rememberTools((m.result as Json).tools);
      }
      if (res.status === 401 && m.error && typeof m.error === "object") {
        const e = m.error as Json;
        e.message = this.authMessage();
        if (method === "tools/call") return JSON.stringify(this.asToolResult(m, e));
      } else if (method === "tools/call" && NEXT_STEP_STATUSES.has(res.status)) {
        const next = this.nextStep(m);
        if (next) return JSON.stringify(next);
      }
      return JSON.stringify(m);
    });
  }

  private rememberTools(tools: unknown): void {
    if (!Array.isArray(tools)) return;
    this.toolNames = new Set(
      tools.flatMap((t) =>
        t && typeof t === "object" && typeof (t as Json).name === "string"
          ? [(t as Json).name as string]
          : []
      )
    );
  }

  private authMessage(): string {
    const base = this.config.baseUrl.replace(/\/+$/, "");
    return this.config.apiKey
      ? `ENTYRIX_API_KEY was rejected (invalid, expired or revoked). Issue a new key after signing in at ${base}/login, or see ${base}/pricing for plans.`
      : `This tool needs an Entyrix API key and ENTYRIX_API_KEY is not set. ${accessHelp(base)}`;
  }

  /** A failed tool call as an MCP tool result (`isError`), which a model reads as the answer. */
  private asToolResult(m: Json, e: Json): Json {
    const content: Array<{ type: "text"; text: string }> = [
      { type: "text", text: String(e.message) },
    ];
    if (e.data !== undefined) {
      content.push({ type: "text", text: `Server access offer: ${JSON.stringify(e.data)}` });
    }
    return { jsonrpc: "2.0", id: m.id ?? null, result: { content, isError: true } };
  }

  /**
   * 402 / 403 / 429: say what to do next. The server's own `message` and
   * `upgrade` offer are repeated verbatim, wherever it put them (JSON-RPC
   * `error.data`, or an `isError` tool result). The pointer to
   * `get_access_status` appears only when the server actually lists that tool.
   */
  private nextStep(m: Json): Json | undefined {
    const lines: string[] = [];
    let result: Json | undefined;
    if (m.error && typeof m.error === "object") {
      const e = m.error as Json;
      if (typeof e.message === "string") lines.push(e.message);
      const d = e.data && typeof e.data === "object" ? (e.data as Json) : undefined;
      if (d) {
        if (typeof d.message === "string" && d.message !== e.message) lines.push(d.message);
        const meta = d.meta && typeof d.meta === "object" ? (d.meta as Json) : undefined;
        const ao =
          meta?.access_offer && typeof meta.access_offer === "object"
            ? (meta.access_offer as Json)
            : undefined;
        const upgrade = d.upgrade ?? ao?.upgrade;
        if (upgrade !== undefined) lines.push(`Upgrade: ${JSON.stringify(upgrade)}`);
      }
    } else if (m.result && typeof m.result === "object") {
      result = m.result as Json;
      if (result.isError !== true) return undefined;
    } else {
      return undefined;
    }
    const hint = this.toolNames.has(ACCESS_STATUS_TOOL)
      ? `Access status and a payment link: tool ${ACCESS_STATUS_TOOL}.`
      : undefined;
    if (result) {
      if (!hint) return undefined;
      const content = Array.isArray(result.content) ? [...result.content] : [];
      content.push({ type: "text", text: hint });
      return { ...m, result: { ...result, content } };
    }
    if (hint) lines.push(hint);
    const content = [{ type: "text", text: lines.join("\n") }];
    return { jsonrpc: "2.0", id: m.id ?? null, result: { content, isError: true } };
  }
}
