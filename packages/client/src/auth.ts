/**
 * SEP-10 authentication resource.
 *
 * Implements the challenge-response handshake in
 * `backend/src/routes/auth.js`:
 *   1. `getChallenge({ account })` — `GET /api/auth`
 *   2. sign the transaction with the user's Stellar wallet (client side)
 *   3. `authenticate({ transaction })` — `POST /api/auth`
 *   4. subsequent requests carry the JWT automatically
 */
import { StellarMarketPayError } from "./errors";
import type { HttpClient } from "./http";
import type {
  AuthChallenge,
  AuthChallengeParams,
  AuthSession,
  AuthVerifyParams,
  CsrfTokenResponse,
  MutationResponse,
} from "./types";

export class AuthResource {
  constructor(private readonly http: HttpClient) {}

  /** Fetch a SEP-10 challenge transaction to sign with the wallet. */
  getChallenge(params: AuthChallengeParams): Promise<AuthChallenge> {
    return this.http.request<AuthChallenge>("/api/auth", {
      query: params as unknown as Record<string, unknown>,
      auth: false,
    });
  }

  /**
   * Exchange a signed challenge transaction for an access token.
   * On success the client stores the token (and any CSRF token) for
   * subsequent requests.
   */
  async authenticate(params: AuthVerifyParams): Promise<AuthSession> {
    const session = await this.http.request<AuthSession>("/api/auth", {
      method: "POST",
      body: params,
      auth: false,
    });
    if (session?.token) this.http.setAccessToken(session.token);
    if (session?.csrfToken) this.http.setCsrfToken(session.csrfToken);
    return session;
  }

  /** Rotate the refresh token for a fresh access token. */
  async refresh(): Promise<AuthSession> {
    const session = await this.http.refreshAccessToken();
    if (!session) {
      throw new StellarMarketPayError(
        "Unable to refresh access token: refresh token is missing, expired or revoked",
        401,
      );
    }
    return {
      success: true,
      token: session.token,
      csrfToken: session.csrfToken,
    };
  }

  /** Fetch a CSRF token for cookie-authenticated browser requests. */
  getCsrfToken(): Promise<CsrfTokenResponse> {
    return this.http.request<CsrfTokenResponse>("/api/auth/csrf-token", {
      auth: false,
    });
  }

  /** Revoke the current refresh token and clear the session. */
  logout(): Promise<MutationResponse> {
    return this.http.request<MutationResponse>("/api/auth/logout", {
      method: "POST",
      auth: false,
    });
  }
}
