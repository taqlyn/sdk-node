import { createPublicKey, verify } from "node:crypto";
import { describe, expect, test } from "bun:test";

import {
  canonicalRequestMessage,
  loadPrivateKey,
  normalizePem,
  signRequest,
  signedHeaders,
} from "./signer.js";

/** Deterministic seed 01..20 — same vector as Go PKCS#8 marshal. */
const GOLDEN_PEM = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8g
-----END PRIVATE KEY-----
`;

const GOLDEN_BODY =
  '{"destinationWeb":"https://example.com/offer","mode":"web_only"}';
const GOLDEN_TS = 1_700_000_000;
const GOLDEN_CLIENT = "app_test_abc";
const GOLDEN_PATH = "/v1/short-links";
const GOLDEN_HASH =
  "45b1df36051aec5657b955f266811307e521e19fad0baa2dd052f2ed4a8bd6c7";
const GOLDEN_SIG_B64 =
  "zTe0VimeWAe6dzpPxAIn+DDR46E58G63ypiSTkXd1jT1o3oxYJ4jzAof05lf3s/8sbZ7l46VjDh8ohtB+NISAA==";

describe("canonicalRequestMessage", () => {
  test("matches Go credentials.CanonicalRequestMessage format", () => {
    const msg = canonicalRequestMessage(
      "post",
      GOLDEN_PATH,
      GOLDEN_TS,
      GOLDEN_CLIENT,
      GOLDEN_BODY,
    );
    expect(msg).toBe(
      [
        "taqlyn-v1",
        "POST",
        GOLDEN_PATH,
        String(GOLDEN_TS),
        GOLDEN_CLIENT,
        GOLDEN_HASH,
      ].join("\n"),
    );
    expect(msg.split("\n")).toHaveLength(6);
  });

  test("empty body hashes sha256 of empty bytes", () => {
    const msg = canonicalRequestMessage("GET", "/v1/short-links/sl_x", 1, "app_test_x", "");
    expect(msg.endsWith(
      "\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    )).toBe(true);
  });
});

describe("signRequest", () => {
  test("golden PEM signature matches Go credentials.SignRequest", () => {
    const key = loadPrivateKey(GOLDEN_PEM);
    const sig = signRequest({
      privateKey: key,
      method: "POST",
      path: GOLDEN_PATH,
      unixTimestamp: GOLDEN_TS,
      clientId: GOLDEN_CLIENT,
      body: GOLDEN_BODY,
    });
    expect(sig).toBe(GOLDEN_SIG_B64);

    const pub = createPublicKey(key);
    const msg = canonicalRequestMessage(
      "POST",
      GOLDEN_PATH,
      GOLDEN_TS,
      GOLDEN_CLIENT,
      GOLDEN_BODY,
    );
    expect(
      verify(null, Buffer.from(msg, "utf8"), pub, Buffer.from(sig, "base64")),
    ).toBe(true);
  });

  test("raw 32-byte seed produces the same signature as PEM", () => {
    const seed = Buffer.from(
      "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20",
      "hex",
    );
    const key = loadPrivateKey(seed);
    const sig = signRequest({
      privateKey: key,
      method: "POST",
      path: GOLDEN_PATH,
      unixTimestamp: GOLDEN_TS,
      clientId: GOLDEN_CLIENT,
      body: GOLDEN_BODY,
    });
    expect(sig).toBe(GOLDEN_SIG_B64);
  });

  test("signedHeaders sets X-Taqlyn-* names used by apps/api auth.go", () => {
    const headers = signedHeaders({
      privateKey: loadPrivateKey(GOLDEN_PEM),
      clientId: GOLDEN_CLIENT,
      method: "POST",
      path: GOLDEN_PATH,
      body: GOLDEN_BODY,
      unixTimestamp: GOLDEN_TS,
    });
    expect(headers["X-Taqlyn-Client-Id"]).toBe(GOLDEN_CLIENT);
    expect(headers["X-Taqlyn-Timestamp"]).toBe(String(GOLDEN_TS));
    expect(headers["X-Taqlyn-Signature"]).toBe(GOLDEN_SIG_B64);
  });
});

describe("loadPrivateKey", () => {
  test("normalizes escaped newlines from env", () => {
    const escaped = GOLDEN_PEM.trim().replace(/\n/g, "\\n");
    const key = loadPrivateKey(normalizePem(escaped));
    expect(
      signRequest({
        privateKey: key,
        method: "POST",
        path: GOLDEN_PATH,
        unixTimestamp: GOLDEN_TS,
        clientId: GOLDEN_CLIENT,
        body: GOLDEN_BODY,
      }),
    ).toBe(GOLDEN_SIG_B64);
  });

  test("rejects sk_* handle without PEM", () => {
    expect(() => loadPrivateKey("sk_test_deadbeef")).toThrow(/sk_\*/);
  });
});
