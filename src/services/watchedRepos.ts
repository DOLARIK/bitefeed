import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { watchedRepos } from "../db/schema.js";

export interface WatchedRepoRecord {
  id: string;
  certificateId: string;
  githubRepo: string;
  branch: string;
  githubAppInstallId: string | null;
}

export async function createWatchedRepo(input: {
  certificateId: string;
  githubRepo: string;
  branch: string;
}): Promise<WatchedRepoRecord> {
  const [row] = await db
    .insert(watchedRepos)
    .values({ certificateId: input.certificateId, githubRepo: input.githubRepo, branch: input.branch })
    .returning();
  return toRecord(row);
}

export async function findWatchedReposByRepoAndBranch(
  githubRepo: string,
  branch: string,
): Promise<WatchedRepoRecord[]> {
  const rows = await db
    .select()
    .from(watchedRepos)
    .where(eq(watchedRepos.githubRepo, githubRepo));
  return rows.filter((row) => row.branch === branch).map(toRecord);
}

function toRecord(row: typeof watchedRepos.$inferSelect): WatchedRepoRecord {
  return {
    id: row.id,
    certificateId: row.certificateId,
    githubRepo: row.githubRepo,
    branch: row.branch,
    githubAppInstallId: row.githubAppInstallId,
  };
}
