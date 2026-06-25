// Phase 4 RECRUITING — end-to-end workflow integration test. Seeds the pack,
// runs the fit function and the candidate-fit workflow, exercises a recruiter
// note writeback, and asserts audit + idempotency + tenant isolation.

import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase, db } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { runFunction } from "@/lib/aiops/functions/function-runner";
import { executeAction } from "@/lib/mission-control/actions/action-service";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { seedDomainPack } from "@/lib/domains/domain-seed-runner";
import { runCandidateFitWorkflow } from "@/lib/domains/recruiting/recruiting-workflow-service";
import { recruitingSeedPack } from "@/lib/domains/recruiting/recruiting-seed-pack";
import "@/lib/domains/recruiting/recruiting-seed-pack";
import type { CandidateFitOutput } from "@/lib/domains/recruiting/recruiting-functions";

test("recruiting candidate-fit workflow runs end-to-end", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  await seedDomainPack(ctx, recruitingSeedPack);

  const candidates = await listObjects(ctx, "Candidate");
  const jobs = await listObjects(ctx, "Job");
  const marcus = candidates.find((c) => c.externalKey === "cand-marcus");
  const powerbi = jobs.find((j) => j.externalKey === "job-powerbi");
  assert.ok(marcus, "expected seeded candidate");
  assert.ok(powerbi, "expected seeded job");

  // 1) Fit function: completes, grounded output, citations.
  const fnRun = await runFunction(ctx, "recruiting.candidate_fit_summary", {
    candidateId: marcus.id,
    jobId: powerbi.id,
  });
  assert.equal(fnRun.status, "completed");
  const out = fnRun.output as unknown as CandidateFitOutput;
  assert.equal(typeof out.matchScore, "number");
  assert.equal(typeof out.summary, "string");
  assert.ok((fnRun.citations ?? []).length >= 1, "expected at least one citation");

  // 2) Workflow: produces an action execution OR a review case, plus a notification.
  const result = await runCandidateFitWorkflow(ctx, {
    candidateId: marcus.id,
    jobId: powerbi.id,
    recipientUserId: "usr_recruiter",
  });
  assert.ok(
    result.actionExecutionIds.length > 0 || result.reviewCaseIds.length > 0,
    "expected either an action execution or a review case",
  );
  assert.ok(result.notificationIds.length > 0, "expected a notification");

  // 3) Recruiter-note writeback via the exempt action -> ontology object exists.
  const noteExec = await executeAction(ctx, {
    actionKey: "recruiting.create_recruiter_note",
    input: { note: "Strong Power BI background", candidateId: marcus.id, jobId: powerbi.id },
    approvalExempt: true,
  });
  assert.equal(noteExec.status, "completed");
  const notes = await listObjects(ctx, "RecruiterNote");
  const submissions = await listObjects(ctx, "Submission");
  assert.ok(
    notes.length > 0 || submissions.length > 0,
    "expected a RecruiterNote or Submission after the writeback",
  );

  // 4) Audit events exist.
  const audits = await db.auditEvents.list(ctx.tenantId);
  assert.ok(audits.length > 0, "expected audit events");
});

test("seeding the recruiting pack is idempotent", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");

  await seedDomainPack(ctx, recruitingSeedPack);
  const before = (await listObjects(ctx, "Candidate")).length;
  await seedDomainPack(ctx, recruitingSeedPack);
  const after = (await listObjects(ctx, "Candidate")).length;
  assert.equal(after, before, "candidate count should be unchanged on re-seed");
});

test("recruiting objects are tenant-isolated", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  await seedDomainPack(ctx, recruitingSeedPack);

  const other = systemActor("tnt_other");
  const otherCandidates = await listObjects(other, "Candidate");
  assert.equal(otherCandidates.length, 0, "other tenant should see no candidates");
});
