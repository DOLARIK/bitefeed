import { createHash, createPrivateKey, createPublicKey, sign as edSign, verify as edVerify } from "node:crypto";
import { env } from "../env.js";

/**
 * What gets cryptographically signed at issuance time. Deliberately excludes
 * mutable fields like `status` — a certificate flipping to "stale" later must
 * not invalidate the original signature, since the signature only attests to
 * what was true when the check ran, not to the current drift state.
 */
export interface SignedCertificateFacts {
  certificateId: string;
  accountId: string;
  commitHash: string;
  network: string;
  manifestHash: string;
  issuedAt: string; // ISO 8601
}

function canonicalize(facts: SignedCertificateFacts): string {
  // Fixed key order so the same facts always serialize identically.
  return JSON.stringify({
    certificate_id: facts.certificateId,
    account_id: facts.accountId,
    commit_hash: facts.commitHash,
    network: facts.network,
    manifest_hash: facts.manifestHash,
    issued_at: facts.issuedAt,
  });
}

function loadPrivateKey() {
  const der = Buffer.from(env.CERT_SIGNING_PRIVATE_KEY, "base64");
  return createPrivateKey({ key: der, format: "der", type: "pkcs8" });
}

function loadPublicKey() {
  const der = Buffer.from(env.CERT_SIGNING_PUBLIC_KEY, "base64");
  return createPublicKey({ key: der, format: "der", type: "spki" });
}

export function hashManifest(manifest: unknown): string {
  return createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
}

/** Signs the given facts with the service's Ed25519 key. Returns a base64url signature. */
export function signCertificate(facts: SignedCertificateFacts): string {
  const privateKey = loadPrivateKey();
  const payload = Buffer.from(canonicalize(facts), "utf8");
  // Ed25519 does its own hashing internally, so no digest algorithm is passed.
  const signature = edSign(null, payload, privateKey);
  return signature.toString("base64url");
}

/** Verifies a signature against the given facts. Anyone can call this with the public key alone. */
export function verifyCertificateSignature(facts: SignedCertificateFacts, signatureBase64url: string): boolean {
  const publicKey = loadPublicKey();
  const payload = Buffer.from(canonicalize(facts), "utf8");
  const signature = Buffer.from(signatureBase64url, "base64url");
  return edVerify(null, payload, publicKey, signature);
}

export function getPublicSigningKeyBase64(): string {
  return env.CERT_SIGNING_PUBLIC_KEY;
}
