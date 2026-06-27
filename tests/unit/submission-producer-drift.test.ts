// Submission producer-drift reconciliation. The shortlist action and the
// recruiting seed pack now write ONT-001-aligned Submissions
// ({ jobKey, candidateKey, stage } + CandidateStage status), so warn-only
// validation no longer flags them — while legacy candidateId/jobId aliases and
// the "Shortlist Recommendations" dashboard behavior are preserved.
// In-memory DB backend.
import { test } from "node:test";
import assert from "node:assert/strict";
import { db, resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { executeAction } from "@/lib/mission-control/actions/action-service";
import { installDomainPack } from "@/lib/domain-packs/domain-pack-installer";
import { getDomainPackManifest } from "@/lib/domain-packs/domain-pack-registry";
import { getRecruitingDashboard } from "@/lib/domains/recruiting/recruiting-dashboard-service";
import "@/lib/domain-packs/packs";
import "@/lib/domains/recruiting/recruiting-actions"; // registers the shortlist action

interface SchemaWarningMeta {
  objectType: string;
}

async function submissionSchemaWarnings(tenantId: string) {
  return await db.auditEvents.list(
    tenantId,
    (e) =>
      e.action === "ontology.schema.warning" &&
      (e.metadata as unknown as SchemaWarningMeta).objectType === "Submission",
  );
}

test("shortlist action writes a contract-aligned Submission with no schema warning", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_drift");

  const exec = await executeAction(ctx, {
    actionKey: "recruiting.shortlist_candidate",
    input: { candidateId: "cand-1", jobId: "job-1", score: 0.9, rationale: "Strong fit" },
    approvalExempt: true, // bypass the human review gate to exercise the run path
  });
  assert.equal(exec.status, "completed");

  // The normal shortlist flow emits ZERO Submission schema warnings.
  assert.equal((await submissionSchemaWarnings(ctx.tenantId)).length, 0);

  const sub = await db.ontologyObjects.find(
    ctx.tenantId,
    (o) => o.objectType === "Submission" && o.externalKey === "sub-cand-1-job-1",
  );
  assert.ok(sub, "submission created");
  // Canonical ONT-001 shape.
  assert.equal(sub!.status, "submitted");
  assert.equal(sub!.properties.jobKey, "job-1");
  assert.equal(sub!.properties.candidateKey, "cand-1");
  assert.equal(sub!.properties.stage, "submitted");
  // Legacy aliases preserved (backward compatibility).
  assert.equal(sub!.properties.candidateId, "cand-1");
  assert.equal(sub!.properties.jobId, "job-1");

  // Dashboard "Shortlist Recommendations" still surfaces the shortlisted submission.
  const dashboard = await getRecruitingDashboard(ctx);
  const card = dashboard.cards.find((c) => c.key === "shortlist_recommendations");
  assert.ok(card, "shortlist card present");
  assert.equal(card!.count, 1);
  assert.equal(card!.items[0]?.objectId, sub!.id);
});

test("installing the recruiting pack emits no Submission schema warning", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_seed");

  await installDomainPack(ctx, getDomainPackManifest("recruiting")!);

  const subs = await db.ontologyObjects.list(ctx.tenantId, (o) => o.objectType === "Submission");
  assert.ok(subs.length >= 1, "seed pack created at least one Submission");
  assert.equal((await submissionSchemaWarnings(ctx.tenantId)).length, 0);

  // The seed Submission exposes both canonical keys and legacy aliases.
  const seed = subs.find((s) => s.externalKey === "sub-marcus-powerbi");
  assert.ok(seed, "seed submission present");
  assert.equal(seed!.properties.jobKey, "job-powerbi");
  assert.equal(seed!.properties.candidateKey, "cand-marcus");
  assert.equal(seed!.properties.stage, "submitted");
  assert.equal(seed!.properties.candidateId, "cand-marcus");
  assert.equal(seed!.properties.jobId, "job-powerbi");
});
