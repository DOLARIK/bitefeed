# PRD: Playable Certification Platform

**Status:** Draft — ready for build
**Doc owner:** Divyanshu
**Last updated:** 2026-09-15

---

## 1. Summary

A hosted service that certifies whether an HTML5 "playable" ad bundle — extracted from a real app's actual source code, not hand-designed — meets Meta/Google technical specs, and keeps that certification honest over time by detecting when the source app has drifted from what was certified.

The extraction itself (turning a repo into a playable bundle) happens locally, inside the developer's own coding agent, guided by the `playable-demo-extractor` skill (already built — see `/skills/playable-demo-extractor/` if migrating it into this repo). This PRD covers the **hosted half**: the service that skill calls out to for spec validation, certification, and ongoing drift monitoring. The hosted half is what turns a one-shot local skill into a real, trackable, defensible product.

## 2. Problem

1. Playable ads built by hand or by AI-template tools aren't provably tied to the real app — there's no way for a media buyer, a boss, or an ad network partner to verify "this demo reflects what the app actually does."
2. Even a correctly-built playable goes stale silently. The real app ships changes; nobody re-checks whether the certified demo still matches.
3. A skill distributed as a plain text file has no way to report back usage, so there's no way to demonstrate adoption or learn from usage patterns across customers.

## 3. Goals (v1)

- G1: Any playable bundle can be submitted for automated spec validation and receive a signed, publicly verifiable certificate.
- G2: Certificates are tied to a specific commit of the source repo, so staleness is a detectable, not assumed, condition.
- G3: Every certification run is logged against an authenticated account, giving real (not inferred) usage data.
- G4: A connected GitHub repo can be monitored so the account is notified when the certified commit falls behind the current one.

## 4. Non-goals (v1 — explicitly deferred)

- NG1: A public marketplace for browsing other companies' certified playables.
- NG2: Direct submission to Meta/Google Ads Manager via their ad-buying APIs.
- NG3: Cross-customer benchmarking / aggregate performance insights (needs volume this version won't have yet).
- NG4: Pulling real ad performance data (CTR, playtime) back from ad networks.
- NG5: Ingesting or storing full customer source trees. The service only ever receives the *finished bundle* + a manifest — never the raw repo contents (see §7, Non-negotiables).

These are the logical next phases (see §11) but are out of scope for the first build so the certification loop can actually ship and get real usage.

## 5. Users

- **Primary:** a developer or growth engineer at a company shipping a playable ad, using the `playable-demo-extractor` skill inside their own coding agent (e.g. Claude Code), who needs their output validated and provably tied to real source.
- **Secondary (later phase):** whoever the certificate gets shown to — a media buyer, a manager, an ad-network partner program — who needs to trust the certificate without re-deriving it themselves.

## 6. Core user flow (v1)

1. User runs the `playable-demo-extractor` skill locally against their repo. It produces `index.html` + `manifest.json` as before.
2. Instead of running `scripts/validate_playable.py` purely locally, the skill's final step calls this service's MCP tool `submit_for_validation`, sending the bundle + manifest (not the source repo).
3. Service runs the same packaging checks (file size, no external calls, CTA hook present — logic ported from the existing `validate_playable.py`) plus a manifest-consistency check (does every `components_used` entry have a plausible source path and no suspicious placeholders).
4. On pass: service issues a certificate — a signed record with a unique ID, tied to the git commit hash recorded in the manifest.
5. Service returns `{ passed, certificate_id, issues[] }` to the skill, which reports it to the user.
6. Certificate is resolvable at a public URL: `https://<domain>/cert/<certificate_id>` — shows pass status, commit hash, timestamp, target network, nothing about the underlying source.
7. (Optional at submit time) user connects the GitHub repo via a lightweight GitHub App install. Service then watches for new commits on the relevant branch.
8. If the certified commit falls behind HEAD, the service flips the certificate's public status to "stale" and notifies the account (email/webhook) — it does not re-run extraction itself; that still requires the user's local skill run.

## 7. Non-negotiables (carried over from the skill's own constraints)

- The service never receives raw source code or a full repo checkout in v1 — only the finished `index.html`/`manifest.json` bundle, and (for drift detection) commit metadata via GitHub webhooks, not file contents.
- Every network call the service makes or receives must be disclosed in the README in plain language — no silent telemetry. This matters more here than usual because the parent skill processes real customer codebases; trust in the hosted half protects adoption of the local half.
- A "stale" certificate must fail loudly (visibly flagged at the public cert URL), never silently keep showing "valid."

## 8. System design

```
┌─────────────────────────┐        MCP tool calls         ┌──────────────────────┐
│  User's coding agent      │ ─────────────────────────────▶│  Certification MCP    │
│  running the               │        (auth: API key)        │  server                │
│  playable-demo-extractor  │ ◀───────────────────────────── │                        │
│  skill locally             │      { passed, cert_id }      └──────────┬─────────────┘
└─────────────────────────┘                                           │
                                                                        ▼
                                                              ┌──────────────────────┐
                                                              │  Postgres              │
                                                              │  - accounts/api_keys   │
                                                              │  - certificates        │
                                                              │  - watched_repos       │
                                                              │  - usage_events        │
                                                              └──────────┬─────────────┘
                                                                        ▲
                                                              ┌──────────┴─────────────┐
                                                              │  GitHub App webhook    │
                                                              │  handler (drift check) │
                                                              └────────────────────────┘

Public read path: GET /cert/:id → renders certificate status (no auth required to view)
```

## 9. MCP tools exposed

```
submit_for_validation(bundle_html: string, manifest: json, network: "meta" | "google" | "both")
  → { passed: bool, certificate_id: string | null, issues: string[] }

get_certificate(certificate_id: string)
  → { status: "valid" | "stale" | "failed", commit_hash, network, issued_at, checked_at }

get_playable_specs(network: "meta" | "google")
  → the same content as references/playable-specs.md, served live so the skill
    always has current numbers even if the network changes limits later

connect_repo(certificate_id: string, github_repo: string, branch: string)
  → { watch_id: string }   # triggers GitHub App install flow if not already installed
```

Auth: every tool above except `get_certificate` (public reads are unauthenticated by design — that's the point of a certificate) requires an `Authorization: Bearer <api_key>` header. See §10.

## 10. Data model (v1)

```
accounts
  id, email, created_at, plan (free|paid)

api_keys
  id, account_id, key_hash, created_at, revoked_at

certificates
  id, account_id, commit_hash, network, status (valid|stale|failed),
  manifest_snapshot (jsonb), issued_at, last_checked_at

watched_repos
  id, certificate_id, github_repo, branch, github_app_install_id

usage_events
  id, account_id, event_type (submit_validation|get_certificate|connect_repo|drift_detected),
  certificate_id (nullable), created_at, metadata (jsonb — no source code, ever)
```

`usage_events` is what answers "how many people used this" honestly — distinct `account_id`s with ≥1 `submit_validation` event where `passed = true`, over time, is the real adoption number (per the earlier discussion: certified builds, not raw calls).

## 11. Later phases (not v1, listed so scope stays intentional)

- **Phase 2:** Ad network performance loop — once a certified playable is actually running as an ad, pull CTR/playtime back from Meta/Google reporting APIs and attach it to the certificate.
- **Phase 3:** Cross-account benchmarking once there's enough certificate volume to anonymize meaningfully.
- **Phase 4:** Direct submission to ad platforms via their buying APIs (bigger OAuth/trust surface — earn this after certification alone is trusted).
- **Phase 5 (maybe never):** Public marketplace browsing.

## 12. Success metrics (v1)

- Primary: distinct accounts with at least one **passing** certificate per month.
- Secondary: % of certificates that transition to "stale" within 30 days (tells you how fast real apps drift — also just an interesting number).
- Secondary: time from `submit_for_validation` call to certificate issuance (should be near-instant; this is a thin validation pass, not a rebuild).

## 13. Suggested stack (starting point, not mandate — Claude Code should feel free to push back)

- MCP server: TypeScript SDK or FastMCP (Python) — pick whichever matches the extraction skill's own language for easiest code-sharing of the validation logic in `validate_playable.py`.
- DB: Postgres (Supabase or Neon for zero-ops hosting at this stage).
- GitHub App: Octokit + webhook handler for push events on watched branches — only needs commit SHAs, not diffs or file contents.
- Hosting: Fly.io or Render for the MCP server + webhook handler.
- Auth: simple API-key issuance to start; defer OAuth until there's a reason (e.g. multi-seat accounts).

## 14. Open questions

- Where does the "stale" notification go — email, a webhook the user configures, or only visible on the public cert page? (Affects whether we need an email-sending dependency in v1.)
- Should `submit_for_validation` re-run the exact packaging checks from `validate_playable.py` server-side (duplicating logic) or should the skill still run it locally first and only send the bundle if it already passed locally (server re-checks as the trust boundary, not the first check)? Leaning toward the latter — faster local iteration loop for the user, server check is what the certificate actually attests to.
- Rate limits for the free tier — needed before this is public, not needed for a first working build against your own test repos.
