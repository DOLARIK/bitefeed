import { z } from "zod";
import { getRequestAccount } from "../../auth/context.js";
import { getCertificateById } from "../../services/certificates.js";
import { logUsageEvent } from "../../services/usageEvents.js";
import { toolResult, toolError } from "../toolResult.js";

export const getCertificateInputShape = {
  certificate_id: z.string().uuid(),
};

// Intentionally unauthenticated — the whole point of a certificate is that
// anyone can verify it without needing an API key. See PRD §9.
export async function getCertificateHandler(args: { certificate_id: string }) {
  const certificate = await getCertificateById(args.certificate_id);
  if (!certificate) {
    return toolError(`No certificate found with id ${args.certificate_id}`);
  }

  const account = getRequestAccount();
  await logUsageEvent({
    accountId: account?.id ?? null,
    eventType: "get_certificate",
    certificateId: certificate.id,
  });

  return toolResult({
    status: certificate.status,
    commit_hash: certificate.commitHash,
    network: certificate.network,
    issued_at: certificate.issuedAt.toISOString(),
    checked_at: certificate.lastCheckedAt.toISOString(),
  });
}
