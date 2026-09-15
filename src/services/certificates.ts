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
  signature: string;
  manifestSnapshot: unknown;
  issuedAt: Date;
  lastCheckedAt: Date;
}

export interface IssueCertificateInput {
  accountId: string;
  network: string;
  manifest: Manifest;
}

/** Persists a new certificate row, signing its issuance facts exactly once. */
export async function issueCertificate(input: IssueCertificateInput): Promise<CertificateRecord> {
  const [inserted] = await db
    .insert(certificates)
    .values({
      accountId: input.accountId,
      commitHash: input.manifest.commit_hash,
      network: input.network,
      status: "valid",
      manifestSnapshot: input.manifest,
    })
    .returning();

  const signature = signCertificate({
    certificateId: inserted.id,
    accountId: inserted.accountId,
    commitHash: inserted.commitHash,
    network: inserted.network,
    manifestHash: hashManifest(inserted.manifestSnapshot),
    issuedAt: inserted.issuedAt.toISOString(),
  });

  const [row] = await db
    .update(certificates)
    .set({ signature })
    .where(eq(certificates.id, inserted.id))
    .returning();

  return toRecord(row);
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

function toRecord(row: typeof certificates.$inferSelect): CertificateRecord {
  return {
    id: row.id,
    accountId: row.accountId,
    commitHash: row.commitHash,
    network: row.network,
    status: row.status as CertificateStatus,
    // Legacy rows issued before the `signature` column existed have none
    // stored; fall back to computing it once here rather than failing.
    signature:
      row.signature ??
      signCertificate({
        certificateId: row.id,
        accountId: row.accountId,
        commitHash: row.commitHash,
        network: row.network,
        manifestHash: hashManifest(row.manifestSnapshot),
        issuedAt: row.issuedAt.toISOString(),
      }),
    manifestSnapshot: row.manifestSnapshot,
    issuedAt: row.issuedAt,
    lastCheckedAt: row.lastCheckedAt,
  };
}
