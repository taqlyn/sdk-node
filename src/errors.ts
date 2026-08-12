/** API error body (`ErrorResponse` in OpenAPI). */
export interface ApiErrorBody {
  error?: string;
  message?: string;
}

export class TaqlynApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    const parsed = (body ?? {}) as ApiErrorBody;
    const code = typeof parsed.error === "string" ? parsed.error : "api.error";
    const message =
      typeof parsed.message === "string"
        ? parsed.message
        : `HTTP ${status}`;
    super(`${code}: ${message}`);
    this.name = "TaqlynApiError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}
