/**
 * Public types for the Stellar MarketPay SDK.
 *
 * Where the backend OpenAPI spec provides a schema, the type is derived from
 * the generated `schema.ts` so response shapes stay in lockstep with the API.
 * A small number of endpoints (job update/delete and escrow actions) are not
 * yet annotated in the spec; those parameter/response types are declared here
 * and marked accordingly.
 */
import type { components, paths } from "./schema";
import type { HttpClientOptions } from "./http";

/** A marketplace job listing. */
export type Job = components["schemas"]["Job"];
/** A freelancer's application to a job. */
export type Application = components["schemas"]["Application"];
/** A user profile. */
export type Profile = components["schemas"]["Profile"];
/** An escrow record. */
export type Escrow = components["schemas"]["Escrow"];
/** Structured error payload returned by the API. */
export type ApiErrorBody = components["schemas"]["Error"];

/** Query parameters accepted by `jobs.list` (from the OpenAPI spec). */
export type JobListParams = NonNullable<
  paths["/api/jobs"]["get"]["parameters"]["query"]
>;
/**
 * Request body accepted by `jobs.create`.
 *
 * The generated spec lists `description` as required but omits the property
 * from the request body (a gap in the backend `@swagger` annotation), so it is
 * restored here to match the API's actual validation.
 */
export type JobCreateParams =
  paths["/api/jobs"]["post"]["requestBody"]["content"]["application/json"] & {
    description: string;
  };
/**
 * Query parameters accepted by `applications.listByJob`.
 *
 * The backend reads `tier`, `limit` and `cursor` but does not declare them in
 * its `@swagger` annotation, so the generated query type is `never`; the real
 * parameters are declared here.
 */
export interface ApplicationListParams {
  tier?: string;
  limit?: number;
  cursor?: string;
}
/** Request body accepted by `applications.create` (from the OpenAPI spec). */
export type ApplicationCreateParams =
  paths["/api/applications"]["post"]["requestBody"]["content"]["application/json"];
/** Query parameters accepted by `auth.getChallenge` (from the OpenAPI spec). */
export type AuthChallengeParams =
  paths["/api/auth"]["get"]["parameters"]["query"];
/** Request body accepted by `auth.authenticate` (from the OpenAPI spec). */
export type AuthVerifyParams =
  paths["/api/auth"]["post"]["requestBody"]["content"]["application/json"];

/** Standard single-resource envelope used by most endpoints. */
export interface ApiResponse<T> {
  success?: boolean;
  data: T;
  [key: string]: unknown;
}

/** Standard cursor-paginated collection envelope. */
export interface PaginatedResponse<T> {
  success?: boolean;
  data: T[];
  nextCursor?: string | null;
  [key: string]: unknown;
}

/** Envelope returned by state-mutating endpoints that have no payload. */
export interface MutationResponse {
  success: boolean;
  message?: string;
  [key: string]: unknown;
}

/** SEP-10 challenge returned by `GET /api/auth`. */
export interface AuthChallenge {
  transaction: string;
  network?: "testnet" | "mainnet";
}

/** Session issued after a successful `POST /api/auth` or refresh. */
export interface AuthSession {
  success: boolean;
  token: string;
  csrfToken?: string;
}

/** Response from `GET /api/auth/csrf-token`. */
export interface CsrfTokenResponse {
  csrfToken: string;
}

/* -------------------------------------------------------------------------- */
/* Endpoints not yet present in the generated OpenAPI spec                     */
/* -------------------------------------------------------------------------- */

/** Request body accepted by `jobs.update` (`PATCH /api/jobs/:id`). */
export interface JobUpdateParams {
  status?: Job["status"];
  title?: string;
  description?: string;
  budget?: number;
  category?: string;
  skills?: string[];
  visibility?: "public" | "private";
}

/** Request body accepted by `applications.accept` (`POST /api/applications/:id/accept`). */
export interface ApplicationAcceptParams {
  clientAddress: string;
  contractTxHash?: string;
}

/** Request body accepted by `applications.withdraw` (`DELETE /api/applications/:id`). */
export interface ApplicationWithdrawParams {
  freelancerAddress: string;
}

/** Request body accepted by `escrow.create` (`POST /api/escrow/create`). */
export interface EscrowCreateParams {
  amount: number;
}

/** Request body accepted by `escrow.release` (`POST /api/escrow/:jobId/release`). */
export interface EscrowReleaseParams {
  contractTxHash?: string;
}

/** Response returned by `escrow.release`, including optional side effects. */
export interface EscrowReleaseResponse extends MutationResponse {
  referralBonus?: {
    referrer: string;
    bonusXlm: number;
  };
  autoConversion?: {
    id: string;
    status: string;
    sourceAmountXlm: number;
  };
}

/** Configuration accepted by the `StellarMarketPayClient` constructor. */
export type ClientConfig = HttpClientOptions;
