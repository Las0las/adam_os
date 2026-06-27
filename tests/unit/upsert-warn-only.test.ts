// ONT-001 §C — upsertObject runs the canonical schema check in WARN-ONLY mode:
// violations are surfaced as an `ontology.schema.warning` audit event but never
// block, reject, or alter the write. Proves valid objects pass silently, invalid
// objects still persist while emitting a warning, and undeclared extra properties
// pass through. In-memory DB backend.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { upsertObject } from "@/lib/dataops/ontology/object-service";
import { listAudit } from "@/lib/lawrence-core/audit/audit-service";

interface SchemaWarningMeta {
  violations: Array<{ path: string; code: string; message: string }>;
}

async function schemaWarnings(tenantId: string) {
  return (await listAudit(tenantId)).filter((e) => e.action === "ontology.schema.warning");
}

test("valid canonical object upserts with no schema warning", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_warn");
  const obj = await upsertObject(ctx, {
    objectType: "Candidate",
    externalKey: "c1",
    title: "Ada Lovelace",
    status: "new",
    properties: { fullName: "Ada Lovelace", email: "ada@example.com" },
  });
  assert.equal(obj.objectType, "Candidate");
  assert.equal(obj.status, "new");
  assert.equal((await schemaWarnings(ctx.tenantId)).length, 0);
});

test("invalid canonical object still upserts but emits a warning", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_warn");
  // Missing required fullName|email AND an out-of-domain status.
  const obj = await upsertObject(ctx, {
    objectType: "Candidate",
    externalKey: "c2",
    title: "placeholder",
    status: "bogus",
    properties: {},
  });

  // The write SUCCEEDED unchanged — warn-only is non-blocking and non-mutating.
  assert.ok(obj.id, "object was created despite violations");
  assert.equal(obj.status, "bogus", "status persisted verbatim (not rejected/coerced)");

  const warnings = await schemaWarnings(ctx.tenantId);
  assert.equal(warnings.length, 1, "exactly one schema warning emitted");
  const warning = warnings[0];
  assert.ok(warning);
  const meta = warning.metadata as unknown as SchemaWarningMeta;
  assert.ok(meta.violations.length >= 1);
  assert.ok(meta.violations.some((v) => v.code === "invalid_status"));
  assert.ok(meta.violations.some((v) => v.path === "properties.fullName"));
});

test("extra undeclared properties produce no warning (passthrough)", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_warn");
  await upsertObject(ctx, {
    objectType: "Job",
    externalKey: "j1",
    title: "Senior Engineer",
    status: "open",
    properties: { location: "Remote", customField: 42, nested: { a: 1 } },
  });
  assert.equal((await schemaWarnings(ctx.tenantId)).length, 0);
});
