# @stellar-marketpay/client

Typed, dependency-free TypeScript SDK for the [Stellar MarketPay](https://github.com/Emmy123222/Stellar-MarketPay-) REST API. Wraps the SEP-10 authentication handshake, jobs, applications, and escrow endpoints with full request/response types generated from the backend OpenAPI specification.

- **Zero runtime dependencies** — built on the global `fetch` API (Node ≥ 18, Deno, Bun, and browsers).
- **Fully typed** — request params and responses are derived from `backend/docs/openapi.json` via [`openapi-typescript`](https://openapi-ts.dev/).
- **JWT lifecycle handled for you** — tokens are stored on the client, attached as `Authorization: Bearer …`, and automatically refreshed + retried once on `401`.
- **Dual-format build** — ships ESM and CommonJS with bundled `.d.ts` declarations.

## Installation

```bash
npm install @stellar-marketpay/client
# or
yarn add @stellar-marketpay/client
# or
pnpm add @stellar-marketpay/client
```

## Quick start

```typescript
import { StellarMarketPayClient } from "@stellar-marketpay/client";

const client = new StellarMarketPayClient({
  baseURL: "https://api.stellarmarketpay.com", // default
});

// Public endpoints need no token
const jobs = await client.jobs.list({ category: "development", limit: 20 });
console.log(jobs.data); // Job[]
```

## Authentication (SEP-10)

The API uses a SEP-10 challenge-response handshake: fetch a challenge transaction, sign it with the user's Stellar wallet, then exchange it for a JWT.

```typescript
// 1. Get a challenge transaction for the user's Stellar account
const { transaction } = await client.auth.getChallenge({
  account: "GXXXXXX...",
});

// 2. Sign it with the user's wallet
//    Browser (Freighter):
//    const signedXdr = await window.freighterApi.signTransaction(transaction);
//    Server-side:
//    import StellarSdk from "@stellar/stellar-sdk";
//    const keypair = StellarSdk.Keypair.fromSecret("SXXXXXX...");
//    const tx = new StellarSdk.Transaction(transaction, StellarSdk.Networks.TESTNET);
//    tx.sign(keypair);
//    const signedXdr = tx.toXDR();

// 3. Exchange the signed transaction for a JWT
const session = await client.auth.authenticate({ transaction: signedXdr });
console.log(session.token); // JWT — also stored on the client automatically

// All subsequent requests now carry Authorization: Bearer <token>
const myJobs = await client.jobs.list();
```

### Token refresh

When a request fails with `401`, the SDK automatically exchanges the refresh token (httpOnly cookie in browsers with `credentials: "include"`, or an explicit token in Node) for a fresh access token and retries the request **once**. You can also trigger it explicitly:

```typescript
// Node / scripts: provide the refresh token once
client.setRefreshToken("refresh-token-from-cookie-or-storage");

// Explicit refresh (throws StellarMarketPayError on failure)
const { token } = await client.auth.refresh();

// Or manage tokens yourself
client.setToken("jwt-from-storage");
console.log(client.token); // "jwt-from-storage"
```

### CSRF (cookie-authenticated browsers)

When authenticating via cookies (e.g. SSR proxies), fetch a CSRF token and send it on mutating requests:

```typescript
const { csrfToken } = await client.auth.getCsrfToken();
client.setCsrfToken(csrfToken); // X-CSRF-Token is attached to POST/PATCH/PUT/DELETE
```

## Endpoints

### Jobs

```typescript
// List with filters + cursor pagination
const jobs = await client.jobs.list({
  category: "development",
  status: "open",
  limit: 20,
  cursor: "eyJpZCI6…",
});

// Get one (optionally as a specific viewer)
const job = await client.jobs.get("job-id", "GVIEWER...");

// Create
const { data: created } = await client.jobs.create({
  title: "Build a DeFi dashboard",
  description: "React dashboard for Stellar DeFi analytics",
  budget: 1000,
  clientId: "GXXXXXX...",
  category: "development",
  skills: ["React", "TypeScript"],
});

// Update
await client.jobs.update("job-id", { status: "in_progress" });

// Delete
await client.jobs.delete("job-id");
```

### Applications

```typescript
// List applications for a job
const applications = await client.applications.listByJob("job-id", {
  limit: 10,
});

// Submit a proposal
await client.applications.create({
  jobId: "job-id",
  freelancerId: "GXXXXXX...",
  proposal: "I have 5 years of experience with React and Stellar…",
  bidAmount: 800,
  estimatedDuration: "2 weeks",
});

// Accept (as the job's client) / withdraw (as the freelancer)
await client.applications.accept("app-id", { clientAddress: "GXXXXXX..." });
await client.applications.withdraw("app-id", {
  freelancerAddress: "GXXXXXX...",
});
```

### Escrow

```typescript
// Fund an escrow
await client.escrow.create({ amount: 1000 });

// Fetch the escrow record for a job
const { data: escrow } = await client.escrow.get("job-id");

// Release to the freelancer — identity comes from the JWT, not the body
const release = await client.escrow.release("job-id", { contractTxHash: "…" });
console.log(release.referralBonus); // optional side-effect payload
```

## Error handling

Every non-2xx response throws a typed `StellarMarketPayError`:

```typescript
import {
  StellarMarketPayError,
  isStellarMarketPayError,
} from "@stellar-marketpay/client";

try {
  await client.jobs.get("missing-id");
} catch (error) {
  if (isStellarMarketPayError(error)) {
    console.error(error.statusCode); // 404
    console.error(error.message); // "Job not found" (normalised from either error shape)
    console.error(error.code); // "JOB_NOT_FOUND" when the API supplies one
    console.error(error.response); // raw parsed body
  }
}
```

## TypeScript types

All resource types are exported and derived from the generated OpenAPI schema:

```typescript
import type {
  Job,
  Application,
  Escrow,
  JobCreateParams,
  JobListParams,
  PaginatedResponse,
} from "@stellar-marketpay/client";

const jobs: PaginatedResponse<Job> = await client.jobs.list({ limit: 20 });
```

The full generated OpenAPI types (`paths`, `components`, …) are also re-exported from the package root for advanced use.

## Configuration

```typescript
const client = new StellarMarketPayClient({
  baseURL: "https://api.stellarmarketpay.com", // default
  timeout: 30_000, // request timeout in ms (default 30 000)
  headers: { "X-Custom-Header": "value" }, // extra headers on every request
  token: "jwt", // initial access token
  refreshToken: "refresh-token", // for Node where cookies are absent
  csrfToken: "csrf-token", // for cookie-authenticated browsers
  credentials: "include", // fetch credentials mode (cookies)
  autoRefresh: true, // refresh + retry once on 401 (default true)
  onTokenRefresh: ({ token }) => console.log("refreshed", token),
  fetch: myCustomFetch, // inject a custom fetch (tests, proxies, polyfills)
});
```

## Development

```bash
cd packages/client
npm install
npm run typecheck   # tsc --noEmit
npm test            # vitest run
npm run build       # tsup → dist/ (ESM + CJS + .d.ts)
```

To regenerate the OpenAPI-derived types after backend route changes:

```bash
cd backend && npm run generate-openapi
cd ../packages/client && npm run generate
```

## License

MIT
