// Thin HTTP client around the Entyrix REST API.
// - Bearer auth via ENTYRIX_API_KEY
// - Normalized error envelope: throws EntyrixApiError with status + code
// - JSON-only (every wrapped endpoint returns JSON)

export interface EntyrixClientConfig {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export class EntyrixApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "EntyrixApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class EntyrixClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: EntyrixClientConfig) {
    if (!config.apiKey) {
      throw new Error("EntyrixClient: apiKey is required (set ENTYRIX_API_KEY)");
    }
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? "https://entyrix.com").replace(/\/+$/, "");
    this.timeoutMs = config.timeoutMs ?? 30000;
  }

  /**
   * GET request against /api/v1/<path>. `query` values are URL-encoded; undefined/null are skipped.
   * Returns parsed JSON body. Throws EntyrixApiError for non-2xx responses.
   */
  async get<T = unknown>(
    path: string,
    query?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    const url = this.buildUrl(path, query);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "application/json",
          "User-Agent": "entyrix-mcp/0.1.0",
        },
        signal: controller.signal,
      });
      const text = await res.text();
      let body: unknown = undefined;
      if (text.length > 0) {
        try {
          body = JSON.parse(text);
        } catch {
          // Non-JSON response — surface raw text in the error.
          if (!res.ok) {
            throw new EntyrixApiError(res.status, "NON_JSON_RESPONSE", text.slice(0, 500));
          }
          throw new EntyrixApiError(
            res.status,
            "NON_JSON_RESPONSE",
            "Expected JSON response",
            text.slice(0, 500)
          );
        }
      }
      if (!res.ok) {
        const envelope = (body ?? {}) as {
          error?: { code?: string; message?: string };
          meta?: unknown;
        };
        throw new EntyrixApiError(
          res.status,
          envelope.error?.code ?? `HTTP_${res.status}`,
          envelope.error?.message ?? res.statusText,
          envelope
        );
      }
      return body as T;
    } catch (err) {
      if (err instanceof EntyrixApiError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new EntyrixApiError(
          0,
          "TIMEOUT",
          `Request to ${url} timed out after ${this.timeoutMs}ms`
        );
      }
      const msg = err instanceof Error ? err.message : String(err);
      throw new EntyrixApiError(0, "NETWORK_ERROR", msg);
    } finally {
      clearTimeout(timer);
    }
  }

  private buildUrl(
    path: string,
    query?: Record<string, string | number | boolean | undefined>
  ): string {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const full = `${this.baseUrl}/api/v1${cleanPath}`;
    if (!query) return full;
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      params.set(k, String(v));
    }
    const qs = params.toString();
    return qs ? `${full}?${qs}` : full;
  }
}

/**
 * Build an EntyrixClient from process.env. Throws if ENTYRIX_API_KEY is missing.
 */
export function clientFromEnv(): EntyrixClient {
  const apiKey = process.env.ENTYRIX_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ENTYRIX_API_KEY is not set. Get a key from https://entyrix.com and export ENTYRIX_API_KEY=<your-key>."
    );
  }
  const baseUrl = process.env.ENTYRIX_BASE_URL;
  const timeoutMs = process.env.ENTYRIX_TIMEOUT_MS
    ? parseInt(process.env.ENTYRIX_TIMEOUT_MS, 10)
    : undefined;
  return new EntyrixClient({ apiKey, baseUrl, timeoutMs });
}
