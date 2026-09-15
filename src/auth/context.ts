import { AsyncLocalStorage } from "node:async_hooks";
import type { AuthenticatedAccount } from "../services/accounts.js";

interface RequestAuthState {
  account: AuthenticatedAccount | null;
}

const storage = new AsyncLocalStorage<RequestAuthState>();

/** Runs `fn` with the resolved (possibly null) account attached to the current async context. */
export function runWithAuth<T>(account: AuthenticatedAccount | null, fn: () => T): T {
  return storage.run({ account }, fn);
}

/** Reads the account resolved for the in-flight request. Null if unauthenticated or absent. */
export function getRequestAccount(): AuthenticatedAccount | null {
  return storage.getStore()?.account ?? null;
}

/** Throws if no authenticated account is attached to the current request. */
export function requireAccount(): AuthenticatedAccount {
  const account = getRequestAccount();
  if (!account) {
    throw new Error("Unauthorized: missing or invalid API key. Pass Authorization: Bearer <api_key>.");
  }
  return account;
}
