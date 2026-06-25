// Phase 4 — ONBOARDING live workflow pack integration tests.
// Proves: readiness function detects blockers; the workflow escalates them into
// notifications; a critical blocker opens a critical review case; audit events
// are emitted; the seed is idempotent; and tenants are isolated.

import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase, db } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { runFunction } from "@/lib/aiops/functions/function-runner";
import { executeAction } from "@/lib/mission-control/actions/action-service";
import { seedDomainPack } from "@/lib/domains/domain-seed-runner";
import { listAudit } from "@/lib/lawrence-core/audit/audit-service";
import { onboardingSeedPack } from "@/lib/domains/onboarding/onboarding-seed-pack";
import { runOnboardingReadinessWorkflow } from "@/lib/domains/onboarding/onboarding-workflow-service";
import type { ReadinessSummaryOutput } from "@/lib/domains/onboarding/onboarding-functions";

async function caseIdFor(ctx: ReturnType<typeof systemActor>, externalKey: string): Promise<string> {
  const cases = await listObjects(ctx, "OnboardingCase");
  const found = cases.find((c) => c.externalKey === externalKey);
  assert.ok(found, `expected seeded OnboardingCase ${externalKey}`);
  return found.id;
}

test("readiness function detects blockers on the seeded case", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_onboarding");
  await seedDomainPack(ctx, onboardingSeedPack);

  const caseId = await caseIdFor(ctx, "case-hali");
  const run = await runFunction(ctx, "onboarding.readiness_summary", {
    onboardingCaseId: caseId,
  });
  assert.equal(run.status, "completed");

  const out = run.output as unknown as ReadinessSummaryOutput;
  assert.ok(out.blockers.length > 0, "expected detected blockers");
  assert.equal(out.ready, false);
  assert.ok(out.readinessScore > 0 && out.readinessScore < 1, "partial readiness");
  // The seed has an overdue task, a missing-owner task, and a missing doc.
  assert.ok(out.blockers.some((b) => b.severity === "high"));
  assert.ok(out.blockers.some((b) => b.reason.includes("missing owner")));
  assert.ok(out.blockers.some((b) => b.reason.includes("signed_offer")));
});

test("fail-closed when the onboarding case is missing", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_onboarding");
  await seedDomainPack(ctx, onboardingSeedPack);

  const run = await runFunction(ctx, "onboarding.readiness_summary", {
    onboardingCaseId: "obj_does_not_exist",
  });
  assert.equal(run.status, "failed");
  assert.ok((run.error ?? "").includes("not found"));
});

test("workflow escalates blockers into notifications", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_onboarding");
  await seedDomainPack(ctx, onboardingSeedPack);

  const caseId = await caseIdFor(ctx, "case-hali");
  const result = await runOnboardingReadinessWorkflow(ctx, {
    onboardingCaseId: caseId,
    recipientUserId: "usr_owner",
  });

  assert.equal(result.domain, "onboarding");
  assert.ok(result.actionExecutionIds.length > 0, "expected action executions");
  assert.ok(result.notificationIds.length > 0, "expected notifications");
});

test("workflow returns early with no escalations when ready", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_onboarding");
  await seedDomainPack(ctx, onboardingSeedPack);

  // A fully-ready case: no missing docs, no tasks (and we add a done task).
  const ready = await db.ontologyObjects.insert({
    id: "obj_ready",
    tenantId: ctx.tenantId,
    objectType: "OnboardingCase",
    externalKey: "case-ready",
    title: "Ready Case",
    status: "in_progress",
    properties: { startDate: "2020-01-04T00:00:00.000Z", missingDocs: [] },
    createdAt: "1970-01-01T00:00:01.000Z",
    updatedAt: "1970-01-01T00:00:01.000Z",
  });
  await db.ontologyObjects.insert({
    id: "obj_ready_task",
    tenantId: ctx.tenantId,
    objectType: "OnboardingTask",
    externalKey: "task-ready",
    title: "Ready Task",
    status: "done",
    properties: { caseId: ready.id, ownerUserId: "usr_x", status: "done" },
    createdAt: "1970-01-01T00:00:01.000Z",
    updatedAt: "1970-01-01T00:00:01.000Z",
  });

  const result = await runOnboardingReadinessWorkflow(ctx, {
    onboardingCaseId: ready.id,
  });
  assert.equal(result.notificationIds.length, 0);
  assert.equal(result.actionExecutionIds.length, 0);
  assert.equal((result.output?.ready as boolean | undefined), true);
});

test("a critical blocker opens a critical review case", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_onboarding");
  await seedDomainPack(ctx, onboardingSeedPack);

  const exec = await executeAction(ctx, {
    actionKey: "onboarding.notify_owner",
    input: {
      ownerUserId: "usr_owner",
      message: "Critical blocker: I-9 verification failed",
      severity: "critical",
    },
    approvalExempt: true,
  });
  assert.equal(exec.status, "completed");
  const reviewCaseId = (exec.result as Record<string, unknown> | null)?.reviewCaseId;
  assert.ok(reviewCaseId, "expected a review case id in the action result");

  const reviewCases = await db.reviewCases.list(
    ctx.tenantId,
    (c) => c.caseType === "onboarding.case.critical",
  );
  assert.equal(reviewCases.length, 1);
  assert.equal(reviewCases[0]?.severity, "critical");
});

test("audit events are emitted during the workflow", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_onboarding");
  await seedDomainPack(ctx, onboardingSeedPack);

  const caseId = await caseIdFor(ctx, "case-hali");
  await runOnboardingReadinessWorkflow(ctx, { onboardingCaseId: caseId });

  const audit = await listAudit(ctx.tenantId);
  assert.ok(audit.some((a) => a.action === "aiops.function.run"));
  assert.ok(audit.some((a) => a.action === "action.completed"));
  assert.ok(audit.some((a) => a.action === "notifications.deliver"));
});

test("seeding the pack twice is idempotent", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_onboarding");
  await seedDomainPack(ctx, onboardingSeedPack);
  await seedDomainPack(ctx, onboardingSeedPack);

  const cases = await listObjects(ctx, "OnboardingCase");
  const tasks = await listObjects(ctx, "OnboardingTask");
  assert.equal(cases.filter((c) => c.externalKey === "case-hali").length, 1);
  assert.equal(tasks.filter((t) => t.externalKey === "task-equip").length, 1);
});

test("tenants are isolated", async () => {
  await resetDatabase();
  resetClock();
  const ctxA = systemActor("tnt_a");
  const ctxB = systemActor("tnt_b");
  await seedDomainPack(ctxA, onboardingSeedPack);

  const casesA = await listObjects(ctxA, "OnboardingCase");
  const casesB = await listObjects(ctxB, "OnboardingCase");
  assert.ok(casesA.length > 0);
  assert.equal(casesB.length, 0, "tenant B sees none of tenant A's onboarding data");
});
