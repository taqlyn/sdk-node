import { describe, expect, test } from "bun:test";

import { TaqlynClient } from "./client.js";
import { TaqlynApiError } from "./errors.js";

const GOLDEN_PEM = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8g
-----END PRIVATE KEY-----
`;

describe("TaqlynClient.createShortLink", () => {
  test("sends signed POST /v1/short-links and returns body", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const client = new TaqlynClient({
      baseUrl: "http://api.test/",
      clientId: "app_test_abc",
      privateKey: GOLDEN_PEM,
      now: () => 1_700_000_000,
      fetch: (async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        return new Response(
          JSON.stringify({
            id: "sl_1",
            code: "Ab12Cd",
            shortUrl: "https://go.localhost/Ab12Cd",
            host: "go.localhost",
            mode: "web_only",
            destinationWeb: "https://example.com/offer",
            env: "sandbox",
            orgId: "org_1",
            appId: "app_1",
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        );
      }) as typeof fetch,
    });

    const link = await client.createShortLink({
      destinationWeb: "https://example.com/offer",
      mode: "web_only",
    });

    expect(link.shortUrl).toBe("https://go.localhost/Ab12Cd");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("http://api.test/v1/short-links");
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers["X-Taqlyn-Client-Id"]).toBe("app_test_abc");
    expect(headers["X-Taqlyn-Timestamp"]).toBe("1700000000");
    expect(headers["X-Taqlyn-Signature"]).toBe(
      "zTe0VimeWAe6dzpPxAIn+DDR46E58G63ypiSTkXd1jT1o3oxYJ4jzAof05lf3s/8sbZ7l46VjDh8ohtB+NISAA==",
    );
    expect(calls[0]!.init.body).toBe(
      '{"destinationWeb":"https://example.com/offer","mode":"web_only"}',
    );
  });

  test("throws TaqlynApiError on 401", async () => {
    const client = new TaqlynClient({
      baseUrl: "http://api.test",
      clientId: "app_test_abc",
      privateKey: GOLDEN_PEM,
      fetch: (async () =>
        new Response(
          JSON.stringify({
            error: "auth.unauthorized",
            message: "invalid signature",
          }),
          { status: 401 },
        )) as typeof fetch,
    });

    try {
      await client.createShortLink({ destinationWeb: "https://example.com" });
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(TaqlynApiError);
      expect((e as TaqlynApiError).status).toBe(401);
      expect((e as TaqlynApiError).code).toBe("auth.unauthorized");
    }
  });
});
