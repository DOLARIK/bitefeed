import type { CertificateRecord } from "../services/certificates.js";
import { getPublicSigningKeyBase64 } from "../certificates/signing.js";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      default: return "&#39;";
    }
  });
}

const STATUS_LABEL: Record<string, string> = {
  valid: "✅ Valid",
  stale: "⚠️ Stale — source has drifted since certification",
  failed: "❌ Failed",
};

/** Renders the public, unauthenticated certificate page. Shows nothing about the underlying source. */
export function renderCertificatePage(certificate: CertificateRecord): string {
  const statusLabel = STATUS_LABEL[certificate.status] ?? certificate.status;
  const signature = certificate.signature;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Certificate ${escapeHtml(certificate.id)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 640px; margin: 3rem auto; padding: 0 1rem; color: #1a1a1a; }
    h1 { font-size: 1.25rem; }
    .status { font-size: 1.5rem; margin: 1rem 0; }
    .stale { color: #a15c00; }
    .valid { color: #0a7a2e; }
    .failed { color: #b3261e; }
    dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.4rem 1rem; }
    dt { font-weight: 600; color: #555; }
    dd { margin: 0; font-family: ui-monospace, SFMono-Regular, monospace; word-break: break-all; }
    .footer { margin-top: 2rem; font-size: 0.8rem; color: #777; }
  </style>
</head>
<body>
  <h1>Playable Ad Certificate</h1>
  <div class="status ${escapeHtml(certificate.status)}">${escapeHtml(statusLabel)}</div>
  <dl>
    <dt>Certificate ID</dt><dd>${escapeHtml(certificate.id)}</dd>
    <dt>Commit hash</dt><dd>${escapeHtml(certificate.commitHash)}</dd>
    <dt>Target network</dt><dd>${escapeHtml(certificate.network)}</dd>
    <dt>Issued at</dt><dd>${escapeHtml(certificate.issuedAt.toISOString())}</dd>
    <dt>Last checked</dt><dd>${escapeHtml(certificate.lastCheckedAt.toISOString())}</dd>
    <dt>Signature (Ed25519)</dt><dd>${escapeHtml(signature)}</dd>
  </dl>
  <p class="footer">
    Verify this signature offline against the service's public signing key at
    <a href="/.well-known/certification-signing-key">/.well-known/certification-signing-key</a>.
    No source code or repository contents are ever exposed on this page.
  </p>
</body>
</html>`;
}

export function renderNotFoundPage(certificateId: string): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><title>Certificate not found</title></head>
<body>
  <h1>No certificate found</h1>
  <p>No certificate exists with id <code>${escapeHtml(certificateId)}</code>.</p>
</body>
</html>`;
}

export function publicSigningKeyResponse() {
  return { algorithm: "ed25519", publicKeySpkiBase64: getPublicSigningKeyBase64() };
}
