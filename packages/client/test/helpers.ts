import { vi } from "vitest";
import type { FetchLike } from "../src/http";

export interface MockCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

type Handler = (call: MockCall) => Response | Promise<Response>;

/**
 * Build a mock fetch implementation that records every call and delegates
 * response creation to `handler`. Also exposes the raw `vi.fn` for assertions.
 */
export function createMockFetch(handler: Handler): {
  fetch: FetchLike;
  calls: MockCall[];
  spy: ReturnType<typeof vi.fn>;
} {
  const calls: MockCall[] = [];
  const spy = vi.fn(
    async (input: string, init?: RequestInit): Promise<Response> => {
      const headers: Record<string, string> = {};
      const rawHeaders = init?.headers as Record<string, string> | undefined;
      if (rawHeaders) {
        for (const [key, value] of Object.entries(rawHeaders))
          headers[key] = value;
      }

      const call: MockCall = {
        url: input,
        method: init?.method ?? "GET",
        headers,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      };
      calls.push(call);
      return handler(call);
    },
  );

  return { fetch: spy as unknown as FetchLike, calls, spy };
}

/** Construct a JSON `Response`. */
export function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...extraHeaders },
  });
}

/** Parse the query string of a recorded call into a plain object. */
export function queryOf(url: string): Record<string, string> {
  const parsed = new URL(url);
  return Object.fromEntries(parsed.searchParams.entries());
}
