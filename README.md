# Playable Certification Platform

The hosted half of the playable-certification system described in
[issues/0001-playable-cert-platform-prd.md](issues/0001-playable-cert-platform-prd.md). A local coding-agent skill
(`playable-demo-extractor`, not part of this repo) extracts a playable ad bundle from a real app's source and calls
out to this service to get it validated, certified, and watched for drift.

This service:
1. Exposes an MCP server (`submit_for_validation`, `get_certificate`, `get_playable_specs`, `connect_repo`) that the
   extractor skill calls.
2. Re-runs packaging + manifest-consistency checks server-side and, on pass, issues an Ed25519-signed certificate
   tied to the commit hash from the manifest.
3. Serves each certificate at a public, unauthenticated URL: `GET /cert/:id`.
4. Watches connected GitHub repos via a GitHub App webhook and flips a certificate to `stale` when the watched
   branch moves past the certified commit.

## Network calls this service makes or receives

Per the PRD's non-negotiables, every network call is listed here in plain language:

- **Receives** `POST /mcp` — MCP tool calls from a user's coding agent (`submit_for_validation`, `get_certificate`,
  `get_playable_specs`, `connect_repo`). `submit_for_validation` sends the finished bundle (`index.html` content) and
  `manifest.json` — **never a source repo or file tree**.
- **Receives** `POST /webhooks/github` — GitHub App push-event webhooks for watched repos. These deliver commit SHAs
  and branch refs only, never diffs or file contents.
- **Serves** `GET /cert/:id` and `GET /api/certificates/:id` — public, unauthenticated certificate lookups.
- **Serves** `GET /.well-known/certification-signing-key` — the service's public Ed25519 key, so certificate
  signatures can be verified offline by anyone, without calling back into this service.
- **Makes no other outbound calls.** This service does not call Meta, Google, or GitHub's REST API in v1 — GitHub
  interaction is limited to receiving webhook deliveries it already registered for.

## Non-negotiables (carried from the PRD)

- Never ingest or store a full source repo — only the finished bundle + manifest, and (for drift detection) commit
  SHAs via webhook, never file contents.
- A certificate that goes stale must fail loudly at its public URL — see the "stale" banner in
  [src/http/certPage.ts](src/http/certPage.ts).
- Validation logic (`src/validation/`) is the trust boundary the certificate attests to, independent of whatever the
  extractor skill checked locally first.

## Setup

```bash
npm install
cp .env.example .env
npm run generate-signing-keys   # paste the output into .env
```

For local Postgres, `docker compose up -d` starts one on `localhost:5432` matching the `DATABASE_URL` in
`.env.example`.

Fill in `.env`:
- `DATABASE_URL` — a Postgres connection string (Supabase/Neon in production; any local Postgres for dev).
- `CERT_SIGNING_PRIVATE_KEY` / `CERT_SIGNING_PUBLIC_KEY` — from `npm run generate-signing-keys`.
- `GITHUB_WEBHOOK_SECRET` / `GITHUB_APP_SLUG` — optional; only needed for `connect_repo` drift monitoring. Without
  them, certification still works, but the webhook endpoint refuses deliveries and `connect_repo` returns a note
  saying so instead of an install link.

Then run migrations and start the server:

```bash
npm run db:migrate
npm run dev
```

Bootstrap an account + API key (there's no signup UI yet):

```bash
npm run create-account -- you@example.com
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Runs the server with hot reload (`tsx watch`). |
| `npm run build` / `npm start` | Compiles to `dist/` and runs the compiled server. |
| `npm test` | Runs the unit test suite (`vitest`) — validation logic and certificate signing, no DB required. |
| `npm run db:generate` | Generates a new SQL migration from `src/db/schema.ts` after a schema change. |
| `npm run db:migrate` | Applies pending migrations to `DATABASE_URL`. |
| `npm run db:studio` | Opens Drizzle Studio against `DATABASE_URL`. |
| `npm run create-account -- <email>` | Creates an account and prints a fresh API key. |
| `npm run generate-signing-keys` | Generates a new Ed25519 keypair for certificate signing. |

## Architecture

```
src/
  env.ts                 zod-validated environment config
  index.ts               entry point — builds the Express app and listens
  db/                     Drizzle schema + Postgres client
  auth/                   API key generation/hashing + AsyncLocalStorage request-auth context
  services/               DB access: accounts, certificates, watched_repos, usage_events
  validation/             server-side packaging + manifest-consistency checks (the trust boundary)
  specs/                  Meta/Google playable spec constants, shared by validation and get_playable_specs
  certificates/           Ed25519 signing of certificate issuance facts
  mcp/                    MCP server + the four tool handlers
  http/                   Express app: /mcp, /cert/:id, /webhooks/github, /.well-known/...
scripts/                  one-off setup CLIs (signing keys, account bootstrap)
```

### Why an AsyncLocalStorage auth context instead of MCP `extra`

`get_certificate` must work without an API key (that's the point of a public certificate), while the other three
tools require one. Rather than threading optional auth state through the MCP SDK's per-tool `extra` argument, an
Express middleware resolves the `Authorization: Bearer <api_key>` header once per HTTP request and stores the result
in `node:async_hooks` `AsyncLocalStorage`. Each tool handler calls `requireAccount()` (throws if absent) or
`getRequestAccount()` (returns null if absent) as appropriate — see [src/auth/context.ts](src/auth/context.ts).

### Certificate signing

A certificate's signature commits to its *issuance facts* (`certificate_id`, `account_id`, `commit_hash`, `network`,
a hash of the manifest, `issued_at`) — deliberately excluding the mutable `status` field. That way a certificate
flipping from `valid` to `stale` doesn't invalidate the original signature; the signature proves what was true at
issuance, and `status` is live, separately-tracked drift state. See
[src/certificates/signing.ts](src/certificates/signing.ts).

### MCP transport

The MCP endpoint (`POST /mcp`) runs in stateless mode: a fresh `McpServer` + `StreamableHTTPServerTransport` per
request. This service has no need for session-scoped MCP state across calls, and it avoids any cross-request state
leaking through a shared server instance.

## Deploying (Render + Neon)

1. **Postgres (Neon):** sign up at [neon.tech](https://neon.tech) (free, no card required), create a project, and
   copy its connection string (the "Pooled connection" string is fine).
2. **App (Render):** sign up at [render.com](https://render.com) (free, no card required), click **New > Blueprint**,
   and point it at this GitHub repo. Render reads [render.yaml](render.yaml) and creates the web service
   automatically — it'll prompt you for the env vars marked `sync: false`:
   - `DATABASE_URL` — the Neon connection string from step 1.
   - `PUBLIC_BASE_URL` — `https://<the-service-name-render-gives-you>.onrender.com`.
   - `CERT_SIGNING_PRIVATE_KEY` / `CERT_SIGNING_PUBLIC_KEY` — generate a **fresh production keypair** (don't reuse a
     dev one) by running `npm run generate-signing-keys` locally and pasting the output in.
   - `GITHUB_WEBHOOK_SECRET` / `GITHUB_APP_SLUG` — leave blank until you set up drift monitoring; the service
     degrades gracefully without them (see [src/mcp/tools/connectRepo.ts](src/mcp/tools/connectRepo.ts)).
3. Render's build step (`npm run build && npm run db:migrate`) applies migrations against Neon automatically on
   every deploy — no separate migration step needed.
4. Once deployed, bootstrap an account against the live service by running the create-account script locally with
   `DATABASE_URL` pointed at Neon: `DATABASE_URL=<neon-url> npm run create-account -- you@example.com`.

Free-tier caveat: Render's free web service sleeps after ~15 minutes of inactivity and takes 30-60s to wake on the
next request — fine for an MCP server called on demand, not for something expecting instant cold-start latency.

## Not yet built (see PRD §14 open questions)

- Stale-certificate notifications (email/webhook) — currently only visible on the public cert page.
- Rate limiting for a free tier.
- The actual GitHub App registration and its install callback flow (`connect_repo` returns an install URL once
  `GITHUB_APP_SLUG` is set, but nothing here creates the GitHub App itself — that's a one-time manual step on
  GitHub).
