/**
 * Jobs resource (`backend/src/routes/jobs.js`).
 */
import type { HttpClient } from "./http";
import type {
  ApiResponse,
  Job,
  JobCreateParams,
  JobListParams,
  JobUpdateParams,
  MutationResponse,
  PaginatedResponse,
} from "./types";

export class JobsResource {
  constructor(private readonly http: HttpClient) {}

  /** List jobs with optional filters and cursor pagination. */
  list(params: JobListParams = {}): Promise<PaginatedResponse<Job>> {
    return this.http.request<PaginatedResponse<Job>>("/api/jobs", {
      query: params as Record<string, unknown>,
    });
  }

  /** Fetch a single job, optionally as a specific viewer. */
  get(id: string, viewerAddress?: string): Promise<ApiResponse<Job>> {
    return this.http.request<ApiResponse<Job>>(
      `/api/jobs/${encodeURIComponent(id)}`,
      {
        query: viewerAddress ? { viewerAddress } : undefined,
      },
    );
  }

  /** Create a new job. Requires authentication. */
  create(body: JobCreateParams): Promise<ApiResponse<Job>> {
    return this.http.request<ApiResponse<Job>>("/api/jobs", {
      method: "POST",
      body,
    });
  }

  /** Update an existing job. Requires authentication. */
  update(id: string, body: JobUpdateParams): Promise<ApiResponse<Job>> {
    return this.http.request<ApiResponse<Job>>(
      `/api/jobs/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body,
      },
    );
  }

  /** Delete a job. Requires authentication. */
  delete(id: string): Promise<MutationResponse> {
    return this.http.request<MutationResponse>(
      `/api/jobs/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
      },
    );
  }
}
