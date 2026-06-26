// Phase 10 — the secret scanner raises a masked high-severity finding for an
// inline credential, and never stores the raw value.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase, db } from "@/lib/lawrence-core/db";
import { resetClock, now } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { scanTenantForSecrets } from "@/lib/security/secret-scanner-service";

test("inline secret in object properties becomes a masked secret_exposure finding", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  await db.ontologyObjects.insert({
    id: "obj_secret",
    tenantId: "tnt_test",
    objectType: "Note",
    externalKey: null,
    title: "leak",
    status: "active",
    properties: { body: "deploy key sk-ant-ABCDEFGHIJKLMNOPQRSTUV here" },
    createdAt: now(),
    updatedAt: now(),
  });

  const result = await scanTenantForSecrets(ctx);
  assert.ok(result.secretsFound >= 1);
  const finding = result.findings[0];
  assert.ok(finding);
  assert.equal(finding.findingType, "secret_exposure");
  assert.equal(finding.severity, "high");
  // Evidence is masked — the raw secret must not be stored anywhere on the finding.
  assert.ok(!JSON.stringify(finding).includes("sk-ant-ABCDEFGHIJKLMNOPQRSTUV"));
});

test("clean tenant yields no findings", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  const result = await scanTenantForSecrets(ctx);
  assert.equal(result.secretsFound, 0);
});
