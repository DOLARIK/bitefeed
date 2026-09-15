# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

This repository is **pre-build**: it currently contains only planning docs under `issues/` and no source code, no package manifest, and no git history (not yet a git repo). There are no build, lint, or test commands to run yet — do not invent any. When the first implementation lands, update this file with the real commands and architecture.

## What this repo is for

[issues/0001-playable-cert-platform-prd.md](issues/0001-playable-cert-platform-prd.md) is the PRD for the **Playable Certification Platform** — the hosted half of a two-part system:

- **Local half (not in this repo, referenced only):** the `playable-demo-extractor` skill, run inside a developer's own coding agent, which turns a real app's source code into an HTML5 "playable" ad bundle (`index.html` + `manifest.json`). If it gets migrated into this repo, it will live at `/skills/playable-demo-extractor/`.
- **Hosted half (what this repo builds):** an MCP server + Postgres backend that the extractor skill calls out to at its final step, to validate a submitted bundle against Meta/Google spec, issue a signed certificate tied to a git commit hash, and later detect when the source app has drifted from what was certified.

Read the full PRD before starting implementation — it's short and defines exact tool signatures, data model, and non-negotiables. Key points to hold onto while working:

### Core loop
1. Skill calls MCP tool `submit_for_validation(bundle_html, manifest, network)` — sends the finished bundle only, never the source repo.
2. Server re-runs packaging checks (ported from the skill's local `validate_playable.py`: file size, no external calls, CTA hook present) plus a manifest-consistency check.
3. On pass, server issues a certificate: signed, unique ID, tied to the commit hash from the manifest.
4. Certificate is publicly readable (no auth) at `GET /cert/:certificate_id` — shows pass status, commit hash, timestamp, network. Never exposes source.
5. Optional: user connects a GitHub repo via GitHub App install; server watches pushes to the branch and flips the certificate to `"stale"` if the certified commit falls behind HEAD — it never re-runs extraction itself.

### MCP tools (see PRD §9 for full signatures)
- `submit_for_validation` — auth required
- `get_certificate` — **public, unauthenticated** (that's the point of a certificate)
- `get_playable_specs` — auth required; serves the same content as the extractor skill's `references/playable-specs.md`, live, so numbers stay current without redistributing the skill
- `connect_repo` — auth required; triggers GitHub App install flow

### Data model (Postgres, see PRD §10)
`accounts`, `api_keys`, `certificates`, `watched_repos`, `usage_events`. `usage_events` is the source of truth for adoption metrics — never log source code into it, even in `metadata`.

### Non-negotiables (do not violate these when implementing)
- Never ingest or store a full source repo/checkout — only the finished bundle + manifest, and for drift detection, commit SHAs via GitHub webhooks (not diffs or file contents).
- Every network call the service makes or receives must be disclosed in the README in plain language — no silent telemetry.
- A "stale" certificate must fail loudly at the public cert URL — never silently keep reporting "valid."
- Validation logic should be ported/shared from the extractor skill's `validate_playable.py`, not reimplemented from scratch, per PRD §14 — the server-side check is the trust boundary; the skill's local check is just for fast iteration.

### Suggested stack (PRD §13 — a starting point, not a mandate)
- MCP server: TypeScript SDK or FastMCP (Python) — match whichever language the extraction skill uses, for validation-logic code sharing.
- DB: Postgres (Supabase or Neon).
- GitHub App: Octokit + webhook handler, push events only, commit SHAs only.
- Hosting: Fly.io or Render.
- Auth: API keys to start; defer OAuth.

### Explicitly out of scope for v1 (PRD §4)
No public marketplace, no direct submission to ad platforms' buying APIs, no cross-customer benchmarking, no pulling real ad performance data back from networks, no ingesting full source trees.
