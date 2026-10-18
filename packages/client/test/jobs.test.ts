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

describe("jobs resource", () => {
  it("list sends filters as query params", async () => {
    const { fetch, calls } = createMockFetch(() =>
      jsonResponse({ success: true, data: [{ id: "j1" }], nextCursor: "c2" }),
    );
    const c = makeClient(fetch);

    const result = await c.jobs.list({
      category: "dev",
      status: "open",
      limit: 20,
    });

    expect(result.data).toHaveLength(1);
    expect(result.nextCursor).toBe("c2");
    expect(queryOf(calls[0]!.url)).toEqual({
      category: "dev",
      status: "open",
      limit: "20",
    });
  });

  it("get fetches a single job and forwards viewerAddress", async () => {
    const { fetch, calls } = createMockFetch(() =>
      jsonResponse({ success: true, data: { id: "j1" } }),
    );
    const c = makeClient(fetch);

    const job = await c.jobs.get("j1", "GVIEWER");

    expect(job.data.id).toBe("j1");
    expect(calls[0]!.url).toContain("/api/jobs/j1");
    expect(queryOf(calls[0]!.url)).toEqual({ viewerAddress: "GVIEWER" });
  });

  it("create POSTs the body with the auth header", async () => {
    const { fetch, calls } = createMockFetch(() =>
      jsonResponse({ success: true, data: { id: "new" } }, 201),
    );
    const c = makeClient(fetch);

    await c.jobs.create({
      title: "Build a website",
      description: "Next.js",
      budget: 500,
      clientId: "GABC",
      skills: ["React"],
    });

    expect(calls[0]!.method).toBe("POST");
    expect(calls[0]!.url).toBe(`${BASE}/api/jobs`);
    expect(calls[0]!.headers.Authorization).toBe("Bearer jwt");
    expect(calls[0]!.body).toMatchObject({
      title: "Build a website",
      budget: 500,
    });
  });

  it("update PATCHes and delete DELETEs", async () => {
    const { fetch, calls } = createMockFetch(() =>
      jsonResponse({ success: true, data: {} }),
    );
    const c = makeClient(fetch);

    await c.jobs.update("j1", { status: "in_progress" });
    await c.jobs.delete("j1");

    expect(calls[0]!.method).toBe("PATCH");
    expect(calls[0]!.body).toEqual({ status: "in_progress" });
    expect(calls[1]!.method).toBe("DELETE");
  });
});

describe("error handling", () => {
  it("throws a typed error for nested error bodies", async () => {
    const { fetch } = createMockFetch(() =>
      jsonResponse(
        { error: { code: "JOB_NOT_FOUND", message: "Job not found" } },
        404,
      ),
    );
    const c = makeClient(fetch);

    await expect(c.jobs.get("missing")).rejects.toMatchObject({
      name: "StellarMarketPayError",
      statusCode: 404,
      code: "JOB_NOT_FOUND",
      message: "Job not found",
    });
  });

  it("throws a typed error for string error bodies", async () => {
    const { fetch } = createMockFetch(() =>
      jsonResponse({ error: "Missing account parameter" }, 400),
    );
    const c = makeClient(fetch);

    await expect(c.jobs.list()).rejects.toMatchObject({
      statusCode: 400,
      message: "Missing account parameter",
    });
  });
});
