/**
 * Stellar MarketPay TypeScript SDK client.
 *
 * ```ts
 * import { StellarMarketPayClient } from "@stellar-marketpay/client";
 *
 * const client = new StellarMarketPayClient({ baseURL: "http://localhost:4000" });
 * const { transaction } = await client.auth.getChallenge({ account });
 * const signed = await wallet.signTransaction(transaction);
 * await client.auth.authenticate({ transaction: signed });
 *
 * const jobs = await client.jobs.list({ limit: 20 });
 * ```
 */
import { ApplicationsResource } from "./applications";
import { AuthResource } from "./auth";
import { EscrowResource } from "./escrow";
import { HttpClient } from "./http";
import { JobsResource } from "./jobs";
import type { ClientConfig } from "./types";

export class StellarMarketPayClient {
  readonly auth: AuthResource;
  readonly jobs: JobsResource;
  readonly applications: ApplicationsResource;
  readonly escrow: EscrowResource;

  private readonly http: HttpClient;

  constructor(config: ClientConfig = {}) {
    this.http = new HttpClient(config);
    this.auth = new AuthResource(this.http);
    this.jobs = new JobsResource(this.http);
    this.applications = new ApplicationsResource(this.http);
    this.escrow = new EscrowResource(this.http);
  }

  /** The current access token, if any. */
  get token(): string | undefined {
    return this.http.accessToken;
  }

  /** Replace the access token (e.g. after retrieving it from storage). */
  setToken(token?: string): void {
    this.http.setAccessToken(token);
  }

  /** Provide a refresh token for Node/server usage where cookies are absent. */
  setRefreshToken(token?: string): void {
    this.http.setRefreshToken(token);
  }

  /** Provide a CSRF token for cookie-authenticated browser requests. */
  setCsrfToken(token?: string): void {
    this.http.setCsrfToken(token);
  }
}

/** Convenience factory for `new StellarMarketPayClient(config)`. */
export function createClient(
  config: ClientConfig = {},
): StellarMarketPayClient {
  return new StellarMarketPayClient(config);
}
