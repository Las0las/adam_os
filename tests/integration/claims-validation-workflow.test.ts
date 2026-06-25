// Phase 4 CLAIMS — end-to-end workflow integration test. Seeds the pack, runs
// the evidence-summary function (citations grounded), drives the validation
// workflow so findings are created THROUGH the action engine as ValidationFinding
// objects, asserts a review case + validator notification + audit, and checks
// idempotent seeding and tenant isolation.

import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase, db } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { runFunction } from "@/lib/aiops/functions/function-runner";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { seedDomainPack } from "@/lib/domains/domain-seed-runner";
import { runClaimValidationWorkflow } from "@/lib/domains/claims/claims-workflow-service";
import { claimsSeedPack } from "@/lib/domains/claims/claims-seed-pack";
import "@/lib/domains/claims/claims-seed-pack";
import type { EvidenceSummaryOutput } from "@/lib/domains/claims/claims-functions";

async function seededCaseId(tenant: string): Promise<string> {
  const ctx = systemActor(tenant);
  const cases = await listObjects(ctx, "ValidationCase");
  const clm = cases.find((c) => c.externalKey === "clm-001");
  assert.ok(clm, "expected seeded validation case");
  return clm.id;
}

test("claims validation workflow runs end-to-end through the action engine", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  await seedDomainPack(ctx, claimsSeedPack);

  const validationCaseId = await seededCaseId("tnt_test");

  // 1) Function retrieves evidence (>=1 citation) and returns findings.
  const fnRun = await runFunction(ctx, "claims.validation_case_evidence_summary", {
    validationCaseId,
  });
  assert.equal(fnRun.status, "completed");
  assert.ok((fnRun.citations ?? []).length >= 1, "expected at least one citation");
  const out = fnRun.output as unknown as EvidenceSummaryOutput;
  assert.ok(Array.isArray(out.findings) && out.findings.length >= 1, "expected findings");
  // Seeded evidence has 5000 vs 4200 and no signature -> a high-severity finding.
  assert.ok(
    out.findings.some((f) => f.severity === "high" || f.severity === "critical"),
    "expected an escalating finding from conflicting amounts",
  );

  // 2) Workflow: findings are created THROUGH the action engine -> objects exist.
  const result = await runClaimValidationWorkflow(ctx, {
    validationCaseId,
    recipientUserId: "usr_validator",
  });
  assert.ok(result.actionExecutionIds.length >= 1, "expected action executions");

  const findingObjects = await listObjects(ctx, "ValidationFinding");
  assert.ok(findingObjects.length >= 1, "expected ValidationFinding objects after the workflow");
  // The deterministic finding-record was persisted into ontology properties.
  const first = findingObjects[0];
  assert.ok(first, "expected a finding object");
  assert.equal(first.properties.validationCaseId, validationCaseId);
  assert.ok(typeof first.properties.findingType === "string");

  // 3) A high/critical finding creates a review case.
  assert.ok(result.reviewCaseIds.length >= 1, "expected a review case for escalation");
  const reviewCases = await db.reviewCases.list(
    ctx.tenantId,
    (c) => c.caseType === "claims.case.needs_review",
  );
  assert.ok(reviewCases.length >= 1, "expected a claims.case.needs_review review case");

  // 4) Validator notification queued.
  assert.ok(result.notificationIds.length >= 1, "expected a validator notification");
  const notifications = await db.notifications.list(ctx.tenantId);
  assert.ok(notifications.length >= 1, "expected notifications persisted");

  // 5) Audit emitted.
  const audits = await db.auditEvents.list(ctx.tenantId);
  assert.ok(audits.length > 0, "expected audit events");
});

test("seeding the claims pack is idempotent", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");

  await seedDomainPack(ctx, claimsSeedPack);
  const before = (await listObjects(ctx, "ValidationCase")).length;
  await seedDomainPack(ctx, claimsSeedPack);
  const after = (await listObjects(ctx, "ValidationCase")).length;
  assert.equal(after, before, "validation case count should be unchanged on re-seed");
});

test("claims objects are tenant-isolated", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  await seedDomainPack(ctx, claimsSeedPack);

  const other = systemActor("tnt_other");
  const otherCases = await listObjects(other, "ValidationCase");
  assert.equal(otherCases.length, 0, "other tenant should see no validation cases");
});
