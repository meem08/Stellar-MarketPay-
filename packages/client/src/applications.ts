/**
 * Applications resource (`backend/src/routes/applications.js`).
 */
import type { HttpClient } from "./http";
import type {
  ApiResponse,
  Application,
  ApplicationAcceptParams,
  ApplicationCreateParams,
  ApplicationListParams,
  ApplicationWithdrawParams,
  PaginatedResponse,
} from "./types";

export class ApplicationsResource {
  constructor(private readonly http: HttpClient) {}

  /** List applications submitted to a job (cursor paginated). */
  listByJob(
    jobId: string,
    params: ApplicationListParams = {},
  ): Promise<PaginatedResponse<Application>> {
    return this.http.request<PaginatedResponse<Application>>(
      `/api/applications/job/${encodeURIComponent(jobId)}`,
      { query: params as Record<string, unknown> },
    );
  }

  /** Submit a proposal for a job. */
  create(body: ApplicationCreateParams): Promise<ApiResponse<Application>> {
    return this.http.request<ApiResponse<Application>>("/api/applications", {
      method: "POST",
      body,
    });
  }

  /** Accept an application as the job's client. Requires authentication. */
  accept(
    id: string,
    body: ApplicationAcceptParams,
  ): Promise<ApiResponse<Application>> {
    return this.http.request<ApiResponse<Application>>(
      `/api/applications/${encodeURIComponent(id)}/accept`,
      { method: "POST", body },
    );
  }

  /** Withdraw an application as the freelancer. Requires authentication. */
  withdraw(
    id: string,
    body: ApplicationWithdrawParams,
  ): Promise<ApiResponse<Application>> {
    return this.http.request<ApiResponse<Application>>(
      `/api/applications/${encodeURIComponent(id)}`,
      { method: "DELETE", body },
    );
  }
}
