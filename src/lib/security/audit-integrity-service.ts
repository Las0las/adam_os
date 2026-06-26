// Phase 10 — audit integrity verification. Recomputes the hash chain and
// verifies each link; a break (tampering) records a failed integrity check and
// raises a critical audit_gap security finding. Audit events are append-only.

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { recomputeStoredHash } from "@/lib/lawrence-core/audit/audit-hash-service";
import { requirePermission } from "@/lib/lawrence-core/permissions/permissions";
import { createSecurityFinding } from "./security-finding-service";
import type { ActorContext } from "@/types/platform";
import type { AuditChainResult, AuditIntegrityCheck } from "./audit-integrity-types";

export async function verifyAuditChain(
  ctx: ActorContext,
  opts: { from?: string; to?: string } = {},
): Promise<{ result: AuditChainResult; check: AuditIntegrityCheck }> {
  requirePermission(ctx, "security.audit_verify");

  const events = (await db.auditEvents.list(ctx.tenantId, (e) => {
    if (opts.from && e.createdAt < opts.from) return false;
    if (opts.to && e.createdAt > opts.to) return false;
    return true;
  })).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  let ok = true;
  let failureEventId: string | null = null;
  let reason: string | undefined;
  let previousHash: string | null = null;

  for (const event of events) {
    // Chain linkage: previousHash must equal the prior event's eventHash.
    if ((event.previousHash ?? null) !== previousHash) {
      ok = false;
      failureEventId = event.id;
      reason = "previous_hash chain broken";
      break;
    }
    // Content integrity: recomputed hash must equal the stored hash.
    if (recomputeStoredHash(event) !== (event.eventHash ?? "")) {
      ok = false;
      failureEventId = event.id;
      reason = "event_hash mismatch (tampered payload)";
      break;
    }
    previousHash = event.eventHash ?? null;
  }

  const check = await db.auditIntegrityChecks.insert({
    id: id("audchk"),
    tenantId: ctx.tenantId,
    status: ok ? "passed" : "failed",
    checkedFrom: events[0]?.createdAt ?? null,
    checkedTo: events[events.length - 1]?.createdAt ?? null,
    failureEventId,
    details: { eventsChecked: events.length, reason: reason ?? null },
    createdAt: now(),
  });

  if (!ok) {
    await createSecurityFinding(ctx.tenantId, {
      severity: "critical",
      findingType: "audit_gap",
      title: "Audit chain integrity failure",
      summary: reason ?? "audit chain verification failed",
      evidence: [{ failureEventId, reason }],
    });
  }

  return { result: { ok, eventsChecked: events.length, failureEventId, reason }, check };
}

export async function listIntegrityChecks(tenantId: string): Promise<AuditIntegrityCheck[]> {
  return (await db.auditIntegrityChecks.list(tenantId)).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}
