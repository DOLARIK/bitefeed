import type { Request, Response } from "express";
import { verify } from "@octokit/webhooks-methods";
import { env } from "../env.js";
import { findWatchedReposByRepoAndBranch } from "../services/watchedRepos.js";
import { getCertificateById, markCertificateStale, touchCertificateChecked } from "../services/certificates.js";
import { logUsageEvent } from "../services/usageEvents.js";

interface GitHubPushPayload {
  ref: string;
  after: string;
  repository: { full_name: string };
  installation?: { id: number };
}

function commitsMatch(certified: string, incoming: string): boolean {
  const shorter = Math.min(certified.length, incoming.length);
  return certified.slice(0, shorter).toLowerCase() === incoming.slice(0, shorter).toLowerCase();
}

/**
 * Handles GitHub App webhook deliveries for watched repos. Only ever reads
 * commit SHAs off the push event payload — never fetches diffs or file
 * contents, per the PRD's non-negotiables (§7).
 */
export async function handleGithubWebhook(req: Request, res: Response) {
  const signature = req.header("x-hub-signature-256");
  const event = req.header("x-github-event");
  const rawBody = (req as Request & { rawBody?: string }).rawBody ?? "";

  if (!env.GITHUB_WEBHOOK_SECRET) {
    res.status(503).json({ error: "GITHUB_WEBHOOK_SECRET is not configured on this server." });
    return;
  }

  if (!signature || !(await verify(env.GITHUB_WEBHOOK_SECRET, rawBody, signature))) {
    res.status(401).json({ error: "Invalid webhook signature." });
    return;
  }

  if (event !== "push") {
    res.status(202).json({ ignored: true, reason: `event type "${event}" is not handled` });
    return;
  }

  let payload: GitHubPushPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    res.status(400).json({ error: "Invalid JSON payload." });
    return;
  }

  const branch = payload.ref.replace(/^refs\/heads\//, "");
  const watchedRepos = await findWatchedReposByRepoAndBranch(payload.repository.full_name, branch);

  for (const watched of watchedRepos) {
    const certificate = await getCertificateById(watched.certificateId);
    if (!certificate) continue;

    if (commitsMatch(certificate.commitHash, payload.after)) {
      await touchCertificateChecked(certificate.id);
      continue;
    }

    if (certificate.status !== "stale") {
      await markCertificateStale(certificate.id);
      await logUsageEvent({
        accountId: certificate.accountId,
        eventType: "drift_detected",
        certificateId: certificate.id,
        metadata: { githubRepo: payload.repository.full_name, branch, newHeadShaPrefix: payload.after.slice(0, 12) },
      });
    } else {
      await touchCertificateChecked(certificate.id);
    }
  }

  res.status(200).json({ processed: watchedRepos.length });
}
