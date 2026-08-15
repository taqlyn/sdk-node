# @taqlyn/sdk-node

**Full guide:** [Node.js](../../apps/docs/content/server/node.md) on the docs site.

Taqlyn **server** SDK for Node.js / TypeScript. Signs privileged REST with an
Ed25519 **private key** (never send `sk_*` alone — use the PKCS#8 PEM issued
once when credentials are created).

OpenAPI contract: [`packages/openapi/openapi.yaml`](../openapi/openapi.yaml)
(`TaqlynEd25519`, `POST /v1/short-links`).

## Install

```bash
bun add @taqlyn/sdk-node
# or: npm install @taqlyn/sdk-node
```

From this monorepo package:

```bash
cd packages/sdk-node && bun install && bun run build
```

## Quickstart — create a short link

```bash
export TAQLYN_BASE_URL=https://api.rutvik.qzz.io
export TAQLYN_CLIENT_ID=app_test_...          # from Keys.issue (sandbox)
export TAQLYN_PRIVATE_KEY='-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----'
```

```ts
import { TaqlynClient } from "@taqlyn/sdk-node";

const client = new TaqlynClient({
  baseUrl: process.env.TAQLYN_BASE_URL!,
  clientId: process.env.TAQLYN_CLIENT_ID!,
  privateKey: process.env.TAQLYN_PRIVATE_KEY!, // PKCS#8 PEM (not sk_*)
});

const link = await client.createShortLink({
  destinationWeb: "https://example.com/offer",
  mode: "web_only",
  trackUniqueUsers: true, // Starter+ — hashed unique visitors on click
  trackOpens: true, // Starter+ — SDK reports POST /v1/events/open
});

console.log(link.shortUrl); // e.g. https://go.localhost/Ab12Cd
```

### Env notes

| Variable | Meaning |
|----------|---------|
| `TAQLYN_BASE_URL` | API origin (no trailing slash required) |
| `TAQLYN_CLIENT_ID` | `app_test_*` or `app_live_*` |
| `TAQLYN_PRIVATE_KEY` | PKCS#8 PEM (`-----BEGIN PRIVATE KEY-----`). Literal `\n` in the value is OK. |

Do **not** commit private keys. The `sk_test_*` / `sk_live_*` string is only a
UX handle — the API verifies signatures against the stored public key.

## Signing (how it works)

Privileged routes require three headers (see `apps/api` `requireSigned`):

- `X-Taqlyn-Client-Id`
- `X-Taqlyn-Timestamp` — unix seconds (±300s skew)
- `X-Taqlyn-Signature` — standard base64 of a 64-byte Ed25519 signature

Canonical message (no trailing newline):

```text
taqlyn-v1
{METHOD}
{PATH}
{unixTimestamp}
{clientId}
{hex(sha256(body))}
```

Path is the request path only (e.g. `/v1/short-links`), no query. Empty body
hashes as SHA-256 of empty bytes.

## Scripts

```bash
bun test          # signer unit tests (no live API)
bun run typecheck
bun run build
```

## License

MIT — see [LICENSE](./LICENSE).
