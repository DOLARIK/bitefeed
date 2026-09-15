import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

const KEY_PREFIX = "pcp_live_";

/** Generates a new raw API key. Only the caller sees this value — only its hash is persisted. */
export function generateApiKey(): string {
  return `${KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey, "utf8").digest("hex");
}

export function verifyApiKeyHash(rawKey: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashApiKey(rawKey), "hex");
  const stored = Buffer.from(storedHash, "hex");
  if (candidate.length !== stored.length) return false;
  return timingSafeEqual(candidate, stored);
}

export function extractBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim());
  return match ? match[1].trim() : null;
}
