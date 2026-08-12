import {
  createHash,
  createPrivateKey,
  sign as cryptoSign,
  type KeyObject,
} from "node:crypto";

import type { SignedRequestHeaders } from "./types.js";

/**
 * Canonical request message signed by Ed25519 private keys.
 *
 * Format (newline-separated, no trailing newline):
 * ```
 * taqlyn-v1
 * {METHOD}          // uppercased
 * {PATH}            // e.g. /v1/short-links (no query)
 * {unixTimestamp}   // decimal unix seconds
 * {clientID}        // app_test_* / app_live_*
 * {hex(sha256(body))}
 * ```
 *
 * Matches `modules/credentials.CanonicalRequestMessage` and OpenAPI `TaqlynEd25519`.
 */
export function canonicalRequestMessage(
  method: string,
  path: string,
  unixTimestamp: number,
  clientId: string,
  body: Uint8Array | string,
): string {
  const bytes =
    typeof body === "string" ? Buffer.from(body, "utf8") : Buffer.from(body);
  const hash = createHash("sha256").update(bytes).digest("hex");
  return [
    "taqlyn-v1",
    method.toUpperCase(),
    path,
    String(unixTimestamp),
    clientId,
    hash,
  ].join("\n");
}

/** Normalize PEM that may contain literal `\n` from env vars. */
export function normalizePem(pem: string): string {
  let s = pem.trim();
  if (s.includes("\\n") && !s.includes("\n")) {
    s = s.replace(/\\n/g, "\n");
  }
  return s;
}

function isPem(s: string): boolean {
  return s.includes("-----BEGIN") && s.includes("PRIVATE KEY");
}

function decodeRawKeyString(raw: string): Buffer {
  const trimmed = raw.trim();
  // hex seed (32) or full key (64)
  if (/^[0-9a-fA-F]+$/.test(trimmed) && (trimmed.length === 64 || trimmed.length === 128)) {
    return Buffer.from(trimmed, "hex");
  }
  // standard or url-safe base64
  const b64 = trimmed.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? b64 : b64 + "=".repeat(4 - (b64.length % 4));
  const buf = Buffer.from(pad, "base64");
  if (buf.length === 32 || buf.length === 64) {
    return buf;
  }
  throw new Error(
    "privateKey: expected PKCS#8 PEM, or raw 32-byte seed / 64-byte Ed25519 key (hex or base64)",
  );
}

/** PKCS#8 DER wrapper for a 32-byte Ed25519 seed (matches Go x509.MarshalPKCS8PrivateKey). */
function pkcs8FromSeed(seed: Buffer): Buffer {
  if (seed.length !== 32) {
    throw new Error("Ed25519 seed must be 32 bytes");
  }
  return Buffer.concat([
    Buffer.from("302e020100300506032b657004220420", "hex"),
    seed,
  ]);
}

function keyFromRawSeedOrExpanded(buf: Buffer): KeyObject {
  const seed = buf.length === 64 ? buf.subarray(0, 32) : buf;
  return createPrivateKey({
    key: pkcs8FromSeed(Buffer.from(seed)),
    format: "der",
    type: "pkcs8",
  });
}

/**
 * Load an Ed25519 private key from PKCS#8 PEM or raw bytes.
 * The `sk_test_*` / `sk_live_*` handle alone is not sufficient — pass the PEM
 * issued once by Keys.issue / Keys.rotate.
 */
export function loadPrivateKey(privateKey: string | Buffer | Uint8Array): KeyObject {
  if (typeof privateKey === "string") {
    const s = normalizePem(privateKey);
    if (isPem(s)) {
      return createPrivateKey(s);
    }
    if (s.startsWith("sk_test_") || s.startsWith("sk_live_")) {
      throw new Error(
        "privateKey: sk_* is a UX handle only; pass the PKCS#8 PEM returned at key issue",
      );
    }
    return keyFromRawSeedOrExpanded(decodeRawKeyString(s));
  }

  const buf = Buffer.from(privateKey);
  if (buf.length === 32 || buf.length === 64) {
    return keyFromRawSeedOrExpanded(buf);
  }

  // Assume PKCS#8 DER
  return createPrivateKey({ key: buf, format: "der", type: "pkcs8" });
}

export interface SignRequestInput {
  privateKey: KeyObject;
  method: string;
  path: string;
  unixTimestamp: number;
  clientId: string;
  body: Uint8Array | string;
}

/** Sign a canonical request; returns standard base64 of the 64-byte signature. */
export function signRequest(input: SignRequestInput): string {
  const msg = canonicalRequestMessage(
    input.method,
    input.path,
    input.unixTimestamp,
    input.clientId,
    input.body,
  );
  const sig = cryptoSign(null, Buffer.from(msg, "utf8"), input.privateKey);
  return sig.toString("base64");
}

/** Build the three Taqlyn signing headers for a privileged REST call. */
export function signedHeaders(opts: {
  privateKey: KeyObject;
  clientId: string;
  method: string;
  path: string;
  body: Uint8Array | string;
  unixTimestamp: number;
}): SignedRequestHeaders {
  const signature = signRequest({
    privateKey: opts.privateKey,
    method: opts.method,
    path: opts.path,
    unixTimestamp: opts.unixTimestamp,
    clientId: opts.clientId,
    body: opts.body,
  });
  return {
    "X-Taqlyn-Client-Id": opts.clientId,
    "X-Taqlyn-Timestamp": String(opts.unixTimestamp),
    "X-Taqlyn-Signature": signature,
  };
}
