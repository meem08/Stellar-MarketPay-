/**
 * Error thrown for any non-2xx response from the Stellar MarketPay API.
 *
 * The backend can return errors in two shapes:
 *   - `{ "error": "Missing account parameter" }`
 *   - `{ "error": { "code": "JOB_NOT_FOUND", "message": "Job not found" } }`
 *
 * Both are normalised into `message` / `code` so callers never have to care.
 */
export class StellarMarketPayError extends Error {
  /** HTTP status code returned by the API. */
  readonly statusCode: number;
  /** Parsed response body (JSON when possible, otherwise raw text). */
  readonly response: unknown;
  /** Machine-readable error code when the API supplies one. */
  readonly code?: string;

  constructor(
    message: string,
    statusCode: number,
    response?: unknown,
    code?: string,
  ) {
    super(message);
    this.name = "StellarMarketPayError";
    this.statusCode = statusCode;
    this.response = response;
    this.code = code;
    // Restore the prototype chain when compiled down to ES5/ES2015 targets.
    Object.setPrototypeOf(this, StellarMarketPayError.prototype);
  }
}

/** Type guard that narrows an unknown value to a `StellarMarketPayError`. */
export function isStellarMarketPayError(
  value: unknown,
): value is StellarMarketPayError {
  return value instanceof StellarMarketPayError;
}

/** Normalise an arbitrary API error body into `{ message, code }`. */
export function normaliseErrorBody(
  body: unknown,
  fallback: string,
): { message: string; code?: string } {
  if (body && typeof body === "object" && "error" in body) {
    const rawError = (body as { error: unknown }).error;
    if (typeof rawError === "string") {
      return { message: rawError };
    }
    if (rawError && typeof rawError === "object") {
      const { message, code } = rawError as {
        message?: unknown;
        code?: unknown;
      };
      return {
        message: typeof message === "string" ? message : fallback,
        code: typeof code === "string" ? code : undefined,
      };
    }
  }
  if (body && typeof body === "object" && "message" in body) {
    const message = (body as { message: unknown }).message;
    if (typeof message === "string") return { message };
  }
  if (typeof body === "string" && body.trim()) {
    return { message: body };
  }
  return { message: fallback };
}
