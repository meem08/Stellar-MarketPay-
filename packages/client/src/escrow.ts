/**
 * Escrow resource (`backend/src/routes/escrow.js`).
 *
 * Only the core lifecycle actions are wrapped here. The escrow routes are not
 * yet annotated with `@swagger`, so these methods use locally declared types
 * rather than the generated `schema.ts` types.
 */
import type { HttpClient } from "./http";
import type {
  ApiResponse,
  Escrow,
  EscrowCreateParams,
  EscrowReleaseParams,
  EscrowReleaseResponse,
  MutationResponse,
} from "./types";

export class EscrowResource {
  constructor(private readonly http: HttpClient) {}

  /** Create (fund) an escrow for a job. */
  create(body: EscrowCreateParams): Promise<MutationResponse> {
    return this.http.request<MutationResponse>("/api/escrow/create", {
      method: "POST",
      body,
    });
  }

  /** Fetch the escrow record for a job. */
  get(jobId: string): Promise<ApiResponse<Escrow>> {
    return this.http.request<ApiResponse<Escrow>>(
      `/api/escrow/${encodeURIComponent(jobId)}`,
    );
  }

  /**
   * Release escrow to the freelancer. The authenticated wallet from the JWT is
   * the only identity trusted by the backend — `clientAddress` is not sent.
   */
  release(
    jobId: string,
    body: EscrowReleaseParams = {},
  ): Promise<EscrowReleaseResponse> {
    return this.http.request<EscrowReleaseResponse>(
      `/api/escrow/${encodeURIComponent(jobId)}/release`,
      { method: "POST", body },
    );
  }
}
