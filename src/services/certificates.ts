import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { certificates } from "../db/schema.js";
import type { Manifest } from "../validation/manifest.js";
import { hashManifest, signCertificate } from "../certificates/signing.js";

export type CertificateStatus = "valid" | "stale" | "failed";

export interface CertificateRecord {
  id: string;
  accountId: string;
  commitHash: string;
  network: string;
  status: CertificateStatus;
  manifestSnapshot: unknown;
  issuedAt: Date;
  lastCheckedAt: Date;
}

export interface IssueCertificateInput {
  accountId: string;
  network: string;
  manifest: Manifest;
}

export interface IssuedCertificate {
  certificate: CertificateRecord;
  signature: string;
}

/** Persists a new certificate row and signs its issuance facts. */
export async function issueCertificate(input: IssueCertificateInput): Promise<IssuedCertificate> {
  const [row] = await db
    .insert(certificates)
    .values({
      accountId: input.accountId,
      commitHash: input.manifest.commit_hash,
      network: input.network,
      status: "valid",
      manifestSnapshot: input.manifest,
    })
    .returning();

  const certificate = toRecord(row);

  const signature = signCertificate({
    certificateId: certificate.id,
    accountId: certificate.accountId,
    commitHash: certificate.commitHash,
    network: certificate.network,
    manifestHash: hashManifest(certificate.manifestSnapshot),
    issuedAt: certificate.issuedAt.toISOString(),
  });

  return { certificate, signature };
}

export async function getCertificateById(id: string): Promise<CertificateRecord | null> {
  const [row] = await db.select().from(certificates).where(eq(certificates.id, id)).limit(1);
  return row ? toRecord(row) : null;
}

export async function markCertificateStale(id: string): Promise<void> {
  await db.update(certificates).set({ status: "stale", lastCheckedAt: new Date() }).where(eq(certificates.id, id));
}

export async function touchCertificateChecked(id: string): Promise<void> {
  await db.update(certificates).set({ lastCheckedAt: new Date() }).where(eq(certificates.id, id));
}

/** Recomputes the signature for an already-issued certificate's facts, for public verification. */
export function signatureForCertificate(certificate: CertificateRecord): string {
  return signCertificate({
    certificateId: certificate.id,
    accountId: certificate.accountId,
    commitHash: certificate.commitHash,
    network: certificate.network,
    manifestHash: hashManifest(certificate.manifestSnapshot),
    issuedAt: certificate.issuedAt.toISOString(),
  });
}

function toRecord(row: typeof certificates.$inferSelect): CertificateRecord {
  return {
    id: row.id,
    accountId: row.accountId,
    commitHash: row.commitHash,
    network: row.network,
    status: row.status as CertificateStatus,
    manifestSnapshot: row.manifestSnapshot,
    issuedAt: row.issuedAt,
    lastCheckedAt: row.lastCheckedAt,
  };
}
