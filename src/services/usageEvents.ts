import { db } from "../db/client.js";
import { usageEvents } from "../db/schema.js";

export type UsageEventType = "submit_validation" | "get_certificate" | "connect_repo" | "drift_detected";

export interface LogUsageEventInput {
  // Null for the unauthenticated get_certificate path.
  accountId: string | null;
  eventType: UsageEventType;
  certificateId?: string | null;
  // Never put source code or bundle contents here — see PRD non-negotiables.
  metadata?: Record<string, unknown>;
}

export async function logUsageEvent(input: LogUsageEventInput): Promise<void> {
  await db.insert(usageEvents).values({
    accountId: input.accountId,
    eventType: input.eventType,
    certificateId: input.certificateId ?? null,
    metadata: input.metadata ?? null,
  });
}
