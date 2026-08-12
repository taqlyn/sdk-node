import type { KeyObject } from "node:crypto";

import { TaqlynApiError } from "./errors.js";
import { loadPrivateKey, signedHeaders } from "./signer.js";
import type {
  CreateShortLinkInput,
  ShortLink,
  TaqlynClientOptions,
} from "./types.js";

const SHORT_LINKS_PATH = "/v1/short-links";

/**
 * Taqlyn server SDK — signs privileged REST with Ed25519 (private key).
 *
 * Contract: `packages/openapi/openapi.yaml` (`TaqlynEd25519`, `POST /v1/short-links`).
 */
export class TaqlynClient {
  readonly baseUrl: string;
  readonly clientId: string;
  private readonly privateKey: KeyObject;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;

  constructor(opts: TaqlynClientOptions) {
    if (!opts.baseUrl?.trim()) {
      throw new Error("baseUrl is required");
    }
    if (!opts.clientId?.trim()) {
      throw new Error("clientId is required");
    }
    if (
      !opts.clientId.startsWith("app_test_") &&
      !opts.clientId.startsWith("app_live_")
    ) {
      throw new Error("clientId must start with app_test_ or app_live_");
    }
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.clientId = opts.clientId.trim();
    this.privateKey = loadPrivateKey(opts.privateKey);
    this.fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis);
    this.now = opts.now ?? (() => Math.floor(Date.now() / 1000));
  }

  /**
   * Create a short link (`POST /v1/short-links`).
   * Org/app/env are taken from the verified credential on the server.
   */
  async createShortLink(input: CreateShortLinkInput): Promise<ShortLink> {
    if (!input?.destinationWeb?.trim()) {
      throw new Error("destinationWeb is required");
    }
    const bodyObj: Record<string, unknown> = {
      destinationWeb: input.destinationWeb.trim(),
    };
    if (input.mode !== undefined) bodyObj.mode = input.mode;
    if (input.destinationPath !== undefined) {
      bodyObj.destinationPath = input.destinationPath;
    }
    if (input.params !== undefined) bodyObj.params = input.params;
    if (input.env !== undefined) bodyObj.env = input.env;

    const body = JSON.stringify(bodyObj);
    const ts = this.now();
    const headers = signedHeaders({
      privateKey: this.privateKey,
      clientId: this.clientId,
      method: "POST",
      path: SHORT_LINKS_PATH,
      body,
      unixTimestamp: ts,
    });

    const res = await this.fetchImpl(`${this.baseUrl}${SHORT_LINKS_PATH}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...headers,
      },
      body,
    });

    const text = await res.text();
    let parsed: unknown = undefined;
    if (text) {
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        parsed = { message: text };
      }
    }

    if (!res.ok) {
      throw new TaqlynApiError(res.status, parsed);
    }
    return parsed as ShortLink;
  }
}
