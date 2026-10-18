/**
 * Dependency-free HTTP layer built on the global `fetch` API.
 *
 * Responsibilities:
 *   - URL/query/header/body construction
 *   - Bearer-token auth plus optional CSRF header
 *   - request timeouts via `AbortController`
 *   - one-shot JWT refresh + retry on `401`
 *   - parsing JSON / text / empty responses
 *   - throwing typed `StellarMarketPayError`s
 */
import { normaliseErrorBody, StellarMarketPayError } from "./errors";

/** Minimal fetch signature so tests can inject their own implementation. */
export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

/** Options accepted by `new HttpClient(...)` / `new StellarMarketPayClient(...)`. */
export interface HttpClientOptions {
  /** API origin. Defaults to `https://api.stellarmarketpay.com`. */
  baseURL?: string;
  /** Request timeout in milliseconds. Defaults to `30000`. */
  timeout?: number;
  /** Extra headers merged into every request. */
  headers?: Record<string, string>;
  /** Initial JWT access token. */
  token?: string;
  /** Refresh token, used when cookies are not available (e.g. Node scripts). */
  refreshToken?: string;
  /** Initial CSRF token for cookie-authenticated browser requests. */
  csrfToken?: string;
  /** Value passed to `fetch`'s `credentials` option. Use `"include"` for cookies. */
  credentials?: RequestCredentials;
  /** Custom fetch implementation (defaults to `globalThis.fetch`). */
  fetch?: FetchLike;
  /** Automatically refresh the access token and retry once on `401`. Default `true`. */
  autoRefresh?: boolean;
  /** Called whenever a new access token is obtained via refresh. */
  onTokenRefresh?: (session: { token: string; csrfToken?: string }) => void;
}

/** Per-request options. */
export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Record<string, unknown>;
  body?: unknown;
  headers?: Record<string, string>;
  /** Attach the bearer token (default `true`). */
  auth?: boolean;
  /** Disable the automatic 401 refresh for this request. */
  skipAuthRefresh?: boolean;
  /** External abort signal. */
  signal?: AbortSignal;
}

const DEFAULT_BASE_URL = "https://api.stellarmarketpay.com";
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export class HttpClient {
  readonly baseURL: string;

  private readonly timeout: number;
  private readonly defaultHeaders: Record<string, string>;
  private readonly fetchImpl: FetchLike;
  private readonly credentials?: RequestCredentials;
  private readonly autoRefresh: boolean;
  private readonly onTokenRefresh?: HttpClientOptions["onTokenRefresh"];

  private token?: string;
  private refreshToken?: string;
  private csrfToken?: string;

  constructor(options: HttpClientOptions = {}) {
    this.baseURL = (options.baseURL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeout = options.timeout ?? 30_000;
    this.defaultHeaders = { ...options.headers };
    this.credentials = options.credentials;
    this.autoRefresh = options.autoRefresh ?? true;
    this.onTokenRefresh = options.onTokenRefresh;
    this.token = options.token;
    this.refreshToken = options.refreshToken;
    this.csrfToken = options.csrfToken;
    this.fetchImpl =
      options.fetch ?? ((input, init) => globalThis.fetch(input, init));
  }

  get accessToken(): string | undefined {
    return this.token;
  }

  get currentCsrfToken(): string | undefined {
    return this.csrfToken;
  }

  setAccessToken(token?: string): void {
    this.token = token;
  }

  setRefreshToken(token?: string): void {
    this.refreshToken = token;
  }

  setCsrfToken(token?: string): void {
    this.csrfToken = token;
  }

  /** Execute a request and return the parsed response body. */
  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.execute<T>(path, options, true);
  }

  /**
   * Exchange the refresh token for a new access token.
   *
   * Returns `undefined` when the refresh attempt fails. In browsers with
   * `credentials: "include"` the httpOnly refresh cookie is sent
   * automatically; in Node the configured `refreshToken` is forwarded as a
   * cookie header.
   */
  async refreshAccessToken(): Promise<
    { token: string; csrfToken?: string } | undefined
  > {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (this.refreshToken) {
      headers.Cookie = `refreshToken=${this.refreshToken}`;
    }

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseURL}/api/auth/refresh`, {
        method: "POST",
        headers,
        credentials: this.credentials,
      });
    } catch {
      return undefined;
    }

    const parsed = (await this.parse(response)) as
      | { token?: unknown; csrfToken?: unknown; refreshToken?: unknown }
      | undefined;

    if (!response.ok || !parsed || typeof parsed.token !== "string") {
      return undefined;
    }

    this.token = parsed.token;
    if (typeof parsed.csrfToken === "string") {
      this.csrfToken = parsed.csrfToken;
    }
    if (typeof parsed.refreshToken === "string") {
      this.refreshToken = parsed.refreshToken;
    }

    const session = { token: this.token, csrfToken: this.csrfToken };
    this.onTokenRefresh?.(session);
    return session;
  }

  private async execute<T>(
    path: string,
    options: RequestOptions,
    allowRefresh: boolean,
  ): Promise<T> {
    const { url, init } = this.build(path, options);

    const controller = new AbortController();
    const signal = options.signal ?? controller.signal;
    const timeoutId =
      options.signal === undefined
        ? setTimeout(() => controller.abort(), this.timeout)
        : undefined;

    let response: Response;
    try {
      response = await this.fetchImpl(url, { ...init, signal });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new StellarMarketPayError(
          `Request to ${path} timed out after ${this.timeout}ms`,
          0,
        );
      }
      throw error;
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    }

    const parsed = await this.parse(response);

    if (!response.ok) {
      if (
        response.status === 401 &&
        allowRefresh &&
        this.autoRefresh &&
        !options.skipAuthRefresh &&
        !this.isAuthEndpoint(path)
      ) {
        const refreshed = await this.refreshAccessToken().catch(
          () => undefined,
        );
        if (refreshed) {
          return this.execute<T>(path, options, false);
        }
      }

      const fallback = `Request to ${path} failed with status ${response.status}`;
      const { message, code } = normaliseErrorBody(parsed, fallback);
      throw new StellarMarketPayError(message, response.status, parsed, code);
    }

    return parsed as T;
  }

  private build(
    path: string,
    options: RequestOptions,
  ): { url: string; init: RequestInit } {
    const url = new URL(`${this.baseURL}${path}`);
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value === undefined || value === null || value === "") continue;
        url.searchParams.set(key, String(value));
      }
    }

    const method = options.method ?? "GET";
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...this.defaultHeaders,
      ...options.headers,
    };

    const useAuth = options.auth ?? true;
    if (useAuth && this.token && !headers.Authorization) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    let body: string | undefined;
    if (options.body !== undefined) {
      if (!headers["Content-Type"])
        headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }

    if (
      this.csrfToken &&
      MUTATING_METHODS.has(method) &&
      !headers["X-CSRF-Token"]
    ) {
      headers["X-CSRF-Token"] = this.csrfToken;
    }

    return {
      url: url.toString(),
      init: { method, headers, body, credentials: this.credentials },
    };
  }

  private async parse(response: Response): Promise<unknown> {
    if (response.status === 204) return undefined;

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const text = await response.text();
      if (!text) return undefined;
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }

    return response.text();
  }

  private isAuthEndpoint(path: string): boolean {
    return path.startsWith("/api/auth");
  }
}
