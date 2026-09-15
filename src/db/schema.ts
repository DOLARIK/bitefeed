import { pgTable, uuid, text, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";

export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  plan: text("plan").notNull().default("free"), // "free" | "paid"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("accounts_email_idx").on(table.email),
]);

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id").notNull().references(() => accounts.id),
  // sha256 hex digest of the raw key; the raw key is shown to the user exactly once.
  keyHash: text("key_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("api_keys_key_hash_idx").on(table.keyHash),
]);

export const certificates = pgTable("certificates", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id").notNull().references(() => accounts.id),
  commitHash: text("commit_hash").notNull(),
  network: text("network").notNull(), // "meta" | "google" | "both"
  status: text("status").notNull(), // "valid" | "stale" | "failed"
  // Computed once at issuance and stored so it never changes on read, even if
  // the server's signing key is later rotated or a different environment
  // (with a different key) happens to answer the request.
  signature: text("signature"),
  manifestSnapshot: jsonb("manifest_snapshot").notNull(),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }).notNull().defaultNow(),
});

export const watchedRepos = pgTable("watched_repos", {
  id: uuid("id").defaultRandom().primaryKey(),
  certificateId: uuid("certificate_id").notNull().references(() => certificates.id),
  githubRepo: text("github_repo").notNull(), // "owner/repo"
  branch: text("branch").notNull(),
  githubAppInstallId: text("github_app_install_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const usageEvents = pgTable("usage_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Nullable: get_certificate is intentionally unauthenticated (that's the
  // point of a public certificate), so not every event has a caller identity.
  accountId: uuid("account_id").references(() => accounts.id),
  eventType: text("event_type").notNull(), // "submit_validation" | "get_certificate" | "connect_repo" | "drift_detected"
  certificateId: uuid("certificate_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Never store source code or file contents here.
  metadata: jsonb("metadata"),
});
