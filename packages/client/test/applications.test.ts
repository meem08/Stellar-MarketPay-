import { describe, expect, it } from "vitest";
import { StellarMarketPayClient } from "../src/client";
import { createMockFetch, jsonResponse, queryOf } from "./helpers";

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

describe("applications resource", () => {
  it("listByJob fetches applications for a job", async () => {
    const { fetch, calls } = createMockFetch(() =>
      jsonResponse({
        success: true,
        data: [{ id: "a1", jobId: "j1" }],
        nextCursor: null,
      }),
    );
    const c = makeClient(fetch);

    const result = await c.applications.listByJob("j1", { limit: 10 });

    expect(result.data[0]!.id).toBe("a1");
    expect(calls[0]!.url).toContain("/api/applications/job/j1");
    expect(queryOf(calls[0]!.url)).toEqual({ limit: "10" });
  });

  it("create submits a proposal", async () => {
    const { fetch, calls } = createMockFetch(() =>
      jsonResponse({ success: true, data: { id: "a1" } }, 201),
    );
    const c = makeClient(fetch);

    await c.applications.create({
      jobId: "j1",
      freelancerId: "GFREE",
      proposal: "I can do this",
      bidAmount: 800,
      estimatedDuration: "2 weeks",
    });

    expect(calls[0]!.method).toBe("POST");
    expect(calls[0]!.url).toBe(`${BASE}/api/applications`);
    expect(calls[0]!.body).toMatchObject({ jobId: "j1", bidAmount: 800 });
  });

  it("accept posts the client address to the accept endpoint", async () => {
    const { fetch, calls } = createMockFetch(() =>
      jsonResponse({ success: true, data: { id: "a1", status: "accepted" } }),
    );
    const c = makeClient(fetch);

    const result = await c.applications.accept("a1", {
      clientAddress: "GCLIENT",
    });

    expect(result.data.status).toBe("accepted");
    expect(calls[0]!.url.endsWith("/api/applications/a1/accept")).toBe(true);
    expect(calls[0]!.body).toEqual({ clientAddress: "GCLIENT" });
  });

  it("withdraw sends a DELETE with the freelancer address", async () => {
    const { fetch, calls } = createMockFetch(() =>
      jsonResponse({ success: true, data: {} }),
    );
    const c = makeClient(fetch);

    await c.applications.withdraw("a1", { freelancerAddress: "GFREE" });

    expect(calls[0]!.method).toBe("DELETE");
    expect(calls[0]!.body).toEqual({ freelancerAddress: "GFREE" });
  });
});
