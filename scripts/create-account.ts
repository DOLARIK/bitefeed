#!/usr/bin/env tsx
/**
 * CLI helper to bootstrap an account + API key (there's no signup UI in v1).
 *
 *   npx tsx scripts/create-account.ts you@example.com
 */
import { createAccount, issueApiKey } from "../src/services/accounts.js";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npx tsx scripts/create-account.ts <email>");
    process.exit(1);
  }

  const account = await createAccount(email);
  const apiKey = await issueApiKey(account.id);

  console.log(`Account created: ${account.id} (${account.email})`);
  console.log(`\nAPI key (shown once, store it now):\n${apiKey}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
