// Phase 10 — retention deletion removes expired customer data AND always leaves
// an audit trail. Customer data is never deleted silently.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase, db } from "@/lib/lawrence-core/db";
import { resetClock, now } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { upsertObject } from "@/lib/dataops/ontology/object-service";
import { createRetentionPolicy, runRetentionJob } from "@/lib/security/retention-service";

test("retention delete removes the object and emits a per-object delete audit", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  const obj = await upsertObject(ctx, { objectType: "Ephemeral", title: "old", properties: {} });

  const policy = await createRetentionPolicy(ctx, {
    key: "ephemeral_delete", name: "Delete ephemeral", objectType: "Ephemeral", retentionDays: 30, action: "delete",
  });

  // asOf far in the future so the 30-day window has elapsed for the object.
  const job = await runRetentionJob(ctx, policy.id, { asOf: "2999-01-01T00:00:00.000Z" });
  assert.equal(job.status, "completed");
  assert.equal(job.affectedCount, 1);

  // Object is gone.
  const gone = await db.ontologyObjects.get("tnt_test", obj.id);
  assert.equal(gone, undefined);

  // A delete audit was emitted for the object.
  const deletes = await db.auditEvents.list("tnt_test", (e) => e.action === "security.retention.delete" && e.subjectId === obj.id);
  assert.equal(deletes.length, 1);
});

test("running an unknown policy is blocked, not a silent no-op", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  const job = await runRetentionJob(ctx, "missing_policy", {});
  assert.equal(job.status, "blocked");
});
