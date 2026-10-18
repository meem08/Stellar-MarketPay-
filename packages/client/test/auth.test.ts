import { describe, expect, it } from "vitest";
import { StellarMarketPayClient } from "../src/client";
import { createMockFetch, jsonResponse, queryOf } from "./helpers";

const BASE = "https://api.example.test";

describe("auth resource (SEP-10 handshake)", () => {
  it("fetches a challenge transaction with the account query param", async () => {
    const { fetch, calls } = createMockFetch((call) =>
      jsonResponse({ transaction: "AAAA...", network: "testnet" }),
    );
    const client = new StellarMarketPayClient({ baseURL: BASE, fetch });

    const challenge = await client.auth.getChallenge({ account: "GABC" });

    expect(challenge).toEqual({ transaction: "AAAA...", network: "testnet" });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe("GET");
    expect(calls[0]!.url.startsWith(`${BASE}/api/auth`)).toBe(true);
    expect(queryOf(calls[0]!.url)).toEqual({ account: "GABC" });
    // challenge endpoint must not send an Authorization header
    expect(calls[0]!.headers.Authorization).toBeUndefined();
  });

  it("authenticates, stores the token and attaches it to later requests", async () => {
    const { fetch, calls } = createMockFetch((call) => {
      if (call.url.endsWith("/api/auth") && call.method === "POST") {
        return jsonResponse({
          success: true,
          token: "jwt-123",
          csrfToken: "csrf-abc",
        });
      }
      return jsonResponse({ success: true, data: [] });
    });

    const client = new StellarMarketPayClient({ baseURL: BASE, fetch });
    const session = await client.auth.authenticate({
      transaction: "signed-xdr",
    });

    expect(session.token).toBe("jwt-123");
    expect(client.token).toBe("jwt-123");
    expect(calls[0]!.body).toEqual({ transaction: "signed-xdr" });
    expect(calls[0]!.headers.Authorization).toBeUndefined();

    await client.jobs.list();
    const listCall = calls[1]!;
    expect(listCall.headers.Authorization).toBe("Bearer jwt-123");
    // CSRF token from auth is echoed on subsequent mutating requests
    await client.jobs.create({
      title: "t",
      description: "d",
      budget: 1,
      clientId: "GABC",
    });
    expect(calls[2]!.headers["X-CSRF-Token"]).toBe("csrf-abc");
  });

  it("refreshes the access token on a 401 and retries the request once", async () => {
    let protectedCalls = 0;
    const { fetch, calls } = createMockFetch((call) => {
      if (call.url.endsWith("/api/auth/refresh")) {
        return jsonResponse({ success: true, token: "fresh-jwt" });
      }
      if (call.url.includes("/api/jobs")) {
        protectedCalls += 1;
        if (protectedCalls === 1) {
          return jsonResponse(
            { error: { code: "TOKEN_EXPIRED", message: "expired" } },
            401,
          );
        }
        return jsonResponse({ success: true, data: [] });
      }
      return jsonResponse({});
    });

    const client = new StellarMarketPayClient({
      baseURL: BASE,
      token: "stale-jwt",
      refreshToken: "refresh-xyz",
      fetch,
    });

    const jobs = await client.jobs.list();

    expect(jobs).toEqual({ success: true, data: [] });
    expect(client.token).toBe("fresh-jwt");
    // stale attempt, refresh, retry
    expect(protectedCalls).toBe(2);
    const refreshCall = calls.find((c) => c.url.endsWith("/api/auth/refresh"));
    expect(refreshCall?.headers.Cookie).toBe("refreshToken=refresh-xyz");
  });

  it("exposes an explicit refresh() that throws when refresh fails", async () => {
    const { fetch } = createMockFetch(() =>
      jsonResponse({ error: "nope" }, 401),
    );
    const client = new StellarMarketPayClient({
      baseURL: BASE,
      refreshToken: "bad",
      fetch,
    });

    await expect(client.auth.refresh()).rejects.toThrowError(/refresh/i);
  });

  it("supports logout", async () => {
    const { fetch, calls } = createMockFetch(() =>
      jsonResponse({ success: true }),
    );
    const client = new StellarMarketPayClient({ baseURL: BASE, fetch });

    await expect(client.auth.logout()).resolves.toEqual({ success: true });
    expect(calls[0]!.method).toBe("POST");
    expect(calls[0]!.url.endsWith("/api/auth/logout")).toBe(true);
  });
});
