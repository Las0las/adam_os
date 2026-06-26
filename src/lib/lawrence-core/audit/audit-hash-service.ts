// Phase 10 — audit event hashing. Each audit event is chained to the previous
// one via sha256, making the audit log tamper-evident. Pure + deterministic.

import { createHash } from "node:crypto";
import type { AuditEvent } from "@/types/platform";

export interface HashableEvent {
  tenantId: string;
  action: string;
  subjectType?: string | null;
  subjectId?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

/** Compute the chained hash for an event given the previous event's hash. */
export function computeEventHash(event: HashableEvent, previousHash: string | null): string {
  const payload = [
    event.tenantId,
    event.action,
    event.subjectType ?? "",
    event.subjectId ?? "",
    JSON.stringify(event.metadata ?? {}),
    event.createdAt,
    previousHash ?? "",
  ].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

/** Recompute the hash of a stored event for verification. */
export function recomputeStoredHash(event: AuditEvent): string {
  return computeEventHash(
    {
      tenantId: event.tenantId,
      action: event.action,
      subjectType: event.subjectType,
      subjectId: event.subjectId,
      metadata: event.metadata,
      createdAt: event.createdAt,
    },
    event.previousHash ?? null,
  );
}
