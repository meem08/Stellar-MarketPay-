import { describe, expect, it } from "vitest";
import { StellarMarketPayClient } from "../src/client";
import { createMockFetch, jsonResponse } from "./helpers";

const BASE = "https://api.example.test";

function makeClient(
  fetchImpl: NonNullable<
    ConstructorParameters<typeof StellarMarketPayClient>[0]
  >["fetch"],
) {
  return new StellarMarketPayClient({
    baseURL: BASE,
    token: "jwt",
    fetch: fetchImpl,
  });
}

describe("escrow resource", () => {
  it("create posts the amount", async () => {
    const { fetch, calls } = createMockFetch(() =>
      jsonResponse({ success: true, message: "Escrow created successfully" }),
    );
    const c = makeClient(fetch);

    const result = await c.escrow.create({ amount: 100 });

    expect(result.success).toBe(true);
    expect(calls[0]!.url).toBe(`${BASE}/api/escrow/create`);
    expect(calls[0]!.body).toEqual({ amount: 100 });
  });

  it("get returns the escrow record for a job", async () => {
    const { fetch, calls } = createMockFetch(() =>
      jsonResponse({
        success: true,
        data: { id: "e1", jobId: "j1", amountXlm: 100 },
      }),
    );
    const c = makeClient(fetch);

    const result = await c.escrow.get("j1");

    expect(result.data.amountXlm).toBe(100);
    expect(calls[0]!.url.endsWith("/api/escrow/j1")).toBe(true);
  });

  it("release posts to the release endpoint with the auth header", async () => {
    const { fetch, calls } = createMockFetch(() =>
      jsonResponse({
        success: true,
        message: "Escrow released and job completed",
        referralBonus: { referrer: "GREF", bonusXlm: 5 },
      }),
    );
    const c = makeClient(fetch);

    const result = await c.escrow.release("j1", { contractTxHash: "tx-1" });

    expect(result.referralBonus?.bonusXlm).toBe(5);
    expect(calls[0]!.url.endsWith("/api/escrow/j1/release")).toBe(true);
    expect(calls[0]!.headers.Authorization).toBe("Bearer jwt");
    expect(calls[0]!.body).toEqual({ contractTxHash: "tx-1" });
  });
});
