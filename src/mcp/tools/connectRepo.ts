import { z } from "zod";
import { requireAccount } from "../../auth/context.js";
import { getCertificateById } from "../../services/certificates.js";
import { createWatchedRepo } from "../../services/watchedRepos.js";
import { logUsageEvent } from "../../services/usageEvents.js";
import { toolResult, toolError } from "../toolResult.js";
import { env } from "../../env.js";

export const connectRepoInputShape = {
  certificate_id: z.string().uuid(),
  github_repo: z.string().regex(/^[^/\s]+\/[^/\s]+$/, 'github_repo must look like "owner/repo"'),
  branch: z.string().min(1),
};

export async function connectRepoHandler(args: { certificate_id: string; github_repo: string; branch: string }) {
  let account;
  try {
    account = requireAccount();
  } catch (error) {
    return toolError((error as Error).message);
  }

  const certificate = await getCertificateById(args.certificate_id);
  if (!certificate) {
    return toolError(`No certificate found with id ${args.certificate_id}`);
  }
  if (certificate.accountId !== account.id) {
    return toolError("This certificate does not belong to the authenticated account.");
  }

  const watched = await createWatchedRepo({
    certificateId: certificate.id,
    githubRepo: args.github_repo,
    branch: args.branch,
  });

  await logUsageEvent({
    accountId: account.id,
    eventType: "connect_repo",
    certificateId: certificate.id,
    metadata: { githubRepo: args.github_repo, branch: args.branch },
  });

  const installUrl = env.GITHUB_APP_SLUG
    ? `https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new`
    : null;

  return toolResult({
    watch_id: watched.id,
    ...(installUrl
      ? { install_url: installUrl, note: "Install the GitHub App on this repo to start drift detection." }
      : { note: "GITHUB_APP_SLUG is not configured on this server; drift detection webhooks won't fire yet." }),
  });
}
