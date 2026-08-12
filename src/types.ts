/** OpenAPI CreateShortLinkRequest (`POST /v1/short-links`). */
export type ShortLinkMode = "web_only" | "app_aware" | "deferred_app";

export type ShortLinkEnv = "sandbox" | "production";

export interface CreateShortLinkInput {
  destinationWeb: string;
  mode?: ShortLinkMode;
  destinationPath?: string;
  params?: Record<string, unknown>;
  /** Optional; must match credential env when set. */
  env?: ShortLinkEnv;
}

/** OpenAPI ShortLinkResponse. */
export interface ShortLink {
  id: string;
  code: string;
  shortUrl: string;
  host: string;
  mode: string;
  destinationWeb: string;
  env: ShortLinkEnv | string;
  orgId: string;
  appId: string;
}

export interface TaqlynClientOptions {
  /** API origin, e.g. `https://api.example.com` or `http://localhost:8080`. */
  baseUrl: string;
  /** `app_test_*` (sandbox) or `app_live_*` (production). */
  clientId: string;
  /**
   * Ed25519 private key as PKCS#8 PEM, or raw 32-byte seed / 64-byte key
   * (Buffer, Uint8Array, or base64/hex string). Not the `sk_*` handle alone —
   * use the PEM returned once at key issue.
   */
  privateKey: string | Buffer | Uint8Array;
  /** Override for tests. */
  fetch?: typeof fetch;
  /** Unix seconds; override for deterministic signing tests. */
  now?: () => number;
}

export interface SignedRequestHeaders {
  "X-Taqlyn-Client-Id": string;
  "X-Taqlyn-Timestamp": string;
  "X-Taqlyn-Signature": string;
}
