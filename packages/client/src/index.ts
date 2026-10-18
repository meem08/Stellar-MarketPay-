/**
 * Public entry point for `@stellar-marketpay/client`.
 */
export { StellarMarketPayClient, createClient } from "./client";
export { AuthResource } from "./auth";
export { JobsResource } from "./jobs";
export { ApplicationsResource } from "./applications";
export { EscrowResource } from "./escrow";
export { HttpClient } from "./http";
export {
  StellarMarketPayError,
  isStellarMarketPayError,
  normaliseErrorBody,
} from "./errors";

export type { FetchLike, HttpClientOptions, RequestOptions } from "./http";

export type {
  ApiErrorBody,
  ApiResponse,
  Application,
  ApplicationAcceptParams,
  ApplicationCreateParams,
  ApplicationListParams,
  ApplicationWithdrawParams,
  AuthChallenge,
  AuthChallengeParams,
  AuthSession,
  AuthVerifyParams,
  ClientConfig,
  CsrfTokenResponse,
  Escrow,
  EscrowCreateParams,
  EscrowReleaseParams,
  EscrowReleaseResponse,
  Job,
  JobCreateParams,
  JobListParams,
  JobUpdateParams,
  MutationResponse,
  PaginatedResponse,
  Profile,
} from "./types";

export type * from "./schema";
