import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/client.js";
import { accounts, apiKeys } from "../db/schema.js";
import { generateApiKey, hashApiKey, verifyApiKeyHash } from "../auth/apiKeys.js";

export interface AuthenticatedAccount {
  id: string;
  email: string;
  plan: string;
}

/** Looks up the account owning a raw API key, if the key is valid and not revoked. */
export async function findAccountByApiKey(rawKey: string): Promise<AuthenticatedAccount | null> {
  const keyHash = hashApiKey(rawKey);

  const rows = await db
    .select({
      accountId: accounts.id,
      email: accounts.email,
      plan: accounts.plan,
      keyHash: apiKeys.keyHash,
    })
    .from(apiKeys)
    .innerJoin(accounts, eq(apiKeys.accountId, accounts.id))
    .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  // Defense in depth: re-verify with a constant-time comparison even though the
  // lookup above already matched on the hash.
  if (!verifyApiKeyHash(rawKey, row.keyHash)) return null;

  return { id: row.accountId, email: row.email, plan: row.plan };
}

export async function createAccount(email: string): Promise<AuthenticatedAccount> {
  const [account] = await db.insert(accounts).values({ email }).returning();
  return { id: account.id, email: account.email, plan: account.plan };
}

/** Issues a new API key for an account. Returns the raw key — it is never retrievable again. */
export async function issueApiKey(accountId: string): Promise<string> {
  const rawKey = generateApiKey();
  await db.insert(apiKeys).values({ accountId, keyHash: hashApiKey(rawKey) });
  return rawKey;
}
