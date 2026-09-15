import { z } from "zod";
import { requireAccount } from "../../auth/context.js";
import { validateSubmission } from "../../validation/index.js";
import { issueCertificate } from "../../services/certificates.js";
import { logUsageEvent } from "../../services/usageEvents.js";
import { toolResult, toolError } from "../toolResult.js";

export const submitForValidationInputShape = {
  bundle_html: z.string().min(1, "bundle_html must not be empty"),
  manifest: z.record(z.string(), z.unknown()),
  network: z.enum(["meta", "google", "both"]),
};

export async function submitForValidationHandler(args: {
  bundle_html: string;
  manifest: Record<string, unknown>;
  network: "meta" | "google" | "both";
}) {
  let account;
  try {
    account = requireAccount();
  } catch (error) {
    return toolError((error as Error).message);
  }

  const result = validateSubmission(args.bundle_html, args.manifest, args.network);

  let certificateId: string | null = null;
  if (result.passed && result.manifest) {
    const certificate = await issueCertificate({
      accountId: account.id,
      network: args.network,
      manifest: result.manifest,
    });
    certificateId = certificate.id;
  }

  await logUsageEvent({
    accountId: account.id,
    eventType: "submit_validation",
    certificateId,
    metadata: {
      network: args.network,
      passed: result.passed,
      bundleBytes: Buffer.byteLength(args.bundle_html, "utf8"),
      issueCount: result.issues.length,
    },
  });

  return toolResult({ passed: result.passed, certificate_id: certificateId, issues: result.issues });
}
