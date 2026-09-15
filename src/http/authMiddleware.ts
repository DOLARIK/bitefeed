import type { Request, Response, NextFunction } from "express";
import { extractBearerToken } from "../auth/apiKeys.js";
import { findAccountByApiKey } from "../services/accounts.js";
import { runWithAuth } from "../auth/context.js";

/**
 * Resolves the caller's API key (if any) into an account and attaches it to
 * the async context for the rest of the request. Deliberately does NOT
 * reject missing/invalid keys here — some tools (get_certificate) are
 * intentionally public. Each tool handler enforces its own auth requirement
 * via requireAccount().
 */
export function authMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const rawKey = extractBearerToken(req.header("authorization"));
    const account = rawKey ? await findAccountByApiKey(rawKey) : null;
    runWithAuth(account, () => next());
  };
}
