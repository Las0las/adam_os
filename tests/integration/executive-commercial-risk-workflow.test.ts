// Phase 4 EXECUTIVE / COMMERCIAL OPS — end-to-end workflow integration test.
// Seeds the pack, runs the account-risk function and the account-risk workflow,
// asserts the decision memo is written to the ontology, high risk opens a review
// case, a notification is queued, audit fires, and seed is idempotent + isolated.

import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase, db } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { runFunction } from "@/lib/aiops/functions/function-runner";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { seedDomainPack } from "@/lib/domains/domain-seed-runner";
import { runAccountRiskWorkflow } from "@/lib/domains/executive/executive-workflow-service";
import { executiveSeedPack } from "@/lib/domains/executive/executive-seed-pack";
import "@/lib/domains/executive/executive-seed-pack";
import type { AccountRiskBriefOutput } from "@/lib/domains/executive/executive-functions";

test("executive account-risk workflow runs end-to-end", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  await seedDomainPack(ctx, executiveSeedPack);

  const accounts = await listObjects(ctx, "Account");
  const meridian = accounts.find((a) => a.externalKey === "acct-meridian");
  assert.ok(meridian, "expected seeded account");

  // 1) Account-risk function returns riskScore + topRisks + recommendedActions.
  const fnRun = await runFunction(ctx, "executive.account_risk_brief", {
    accountId: meridian.id,
  });
  assert.equal(fnRun.status, "completed");
  const out = fnRun.output as unknown as AccountRiskBriefOutput;
  assert.equal(typeof out.riskScore, "number");
  assert.ok(Array.isArray(out.topRisks), "expected topRisks array");
  assert.ok(out.topRisks.length > 0, "expected at least one top risk from high/critical signals");
  assert.ok(Array.isArray(out.recommendedActions) && out.recommendedActions.length > 0, "expected recommended actions");
  assert.equal(out.recommendedActions[0]!.actionKey, "executive.create_decision_memo");
  assert.ok((fnRun.citations ?? []).length >= 1, "expected at least one citation");

  // 2) Workflow: decision-memo action creates a DecisionMemo ontology object.
  const result = await runAccountRiskWorkflow(ctx, {
    accountId: meridian.id,
    recipientUserId: "usr_exec",
  });
  assert.ok(result.actionExecutionIds.length > 0, "expected an action execution");
  const memos = await listObjects(ctx, "DecisionMemo");
  assert.ok(memos.length > 0, "expected a DecisionMemo object after the workflow");

  // 3) High risk creates a review case.
  assert.ok(out.riskScore >= 0.75, "seeded account should be high risk");
  assert.ok(result.reviewCaseIds.length > 0, "expected a high-risk review case");
  const reviewCases = await db.reviewCases.list(
    ctx.tenantId,
    (c) => c.caseType === "executive.risk.high",
  );
  assert.ok(reviewCases.length > 0, "expected an executive.risk.high review case in the queue");

  // 4) Notification queued.
  assert.ok(result.notificationIds.length > 0, "expected a notification");

  // 5) Audit emitted.
  const audits = await db.auditEvents.list(ctx.tenantId);
  assert.ok(audits.length > 0, "expected audit events");
});

test("seeding the executive pack is idempotent", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");

  await seedDomainPack(ctx, executiveSeedPack);
  const before = (await listObjects(ctx, "Account")).length;
  await seedDomainPack(ctx, executiveSeedPack);
  const after = (await listObjects(ctx, "Account")).length;
  assert.equal(after, before, "account count should be unchanged on re-seed");
});

test("executive objects are tenant-isolated", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  await seedDomainPack(ctx, executiveSeedPack);

  const other = systemActor("tnt_other");
  const otherAccounts = await listObjects(other, "Account");
  assert.equal(otherAccounts.length, 0, "other tenant should see no accounts");
});
