// Phase 10 — audit integrity: a clean chain verifies, and tampering with a
// stored event is detected and raises a critical audit_gap finding.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase, db } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { upsertObject } from "@/lib/dataops/ontology/object-service";
import { verifyAuditChain } from "@/lib/security/audit-integrity-service";

test("a clean audit chain verifies and a tampered event is detected", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  // Generate a few chained audit events.
  await upsertObject(ctx, { objectType: "Doc", title: "a", properties: {} });
  await upsertObject(ctx, { objectType: "Doc", title: "b", properties: {} });
  await upsertObject(ctx, { objectType: "Doc", title: "c", properties: {} });

  const clean = await verifyAuditChain(ctx, {});
  assert.equal(clean.result.ok, true);
  assert.equal(clean.check.status, "passed");

  // Tamper: rewrite a stored event's metadata so its recomputed hash diverges.
  const events = await db.auditEvents.list("tnt_test");
  const victim = events[1]!;
  await db.auditEvents.update(victim.id, { metadata: { tampered: true } });

  const after = await verifyAuditChain(ctx, {});
  assert.equal(after.result.ok, false);
  assert.equal(after.check.status, "failed");

  // A critical audit_gap finding was raised.
  const findings = await db.securityFindings.list("tnt_test", (f) => f.findingType === "audit_gap");
  assert.ok(findings.length >= 1);
  assert.equal(findings[0]!.severity, "critical");
});
