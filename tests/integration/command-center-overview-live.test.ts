// Phase 5 (Part N) — live Command Center overview integration test. Boots the
// demo tenant, runs a claims + executive workflow to generate governed work, then
// asserts the executive-mode overview surfaces ranked review/recommendation
// queues and stays tenant-scoped.

import { test } from "node:test";
import assert from "node:assert/strict";
import { bootstrap, DEMO_TENANT_ID } from "@/lib/lawrence-core/bootstrap";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { getCommandCenterOverview } from "@/lib/domains/command-center/command-center-service";
import { runClaimValidationWorkflow } from "@/lib/domains/claims/claims-workflow-service";
import { runAccountRiskWorkflow } from "@/lib/domains/executive/executive-workflow-service";

async function idByExternalKey(
  ctx: ReturnType<typeof systemActor>,
  type: string,
  key: string,
): Promise<string> {
  const obj = (await listObjects(ctx, type)).find((o) => o.externalKey === key);
  assert.ok(obj, `seed object missing: ${type}/${key}`);
  return obj.id;
}

function isSortedDesc(scores: number[]): boolean {
  for (let i = 1; i < scores.length; i += 1) {
    if (scores[i - 1]! < scores[i]!) return false;
  }
  return true;
}

test("Command Center executive overview surfaces ranked live work", async () => {
  await bootstrap();
  const ctx = systemActor(DEMO_TENANT_ID);

  const claimId = await idByExternalKey(ctx, "ValidationCase", "clm-001");
  await runClaimValidationWorkflow(ctx, { validationCaseId: claimId });

  const accountId = await idByExternalKey(ctx, "Account", "acct-meridian");
  await runAccountRiskWorkflow(ctx, { accountId });

  const overview = await getCommandCenterOverview(ctx, { mode: "executive" });

  assert.ok(overview.reviewQueue.length > 0, "review queue populated");
  assert.ok(overview.recommendationQueue.length > 0, "recommendation queue populated");
  assert.ok(overview.metrics.openReviews > 0, "openReviews metric > 0");

  assert.ok(
    isSortedDesc(overview.reviewQueue.map((i) => i.priorityScore)),
    "review queue sorted by priorityScore desc",
  );
  assert.ok(
    isSortedDesc(overview.recommendationQueue.map((i) => i.priorityScore)),
    "recommendation queue sorted by priorityScore desc",
  );
});

test("Command Center overview is tenant-scoped", async () => {
  await bootstrap();
  const other = systemActor("tnt_empty");
  const overview = await getCommandCenterOverview(other, { mode: "executive" });

  assert.equal(overview.reviewQueue.length, 0);
  assert.equal(overview.recommendationQueue.length, 0);
  assert.equal(overview.riskQueue.length, 0);
  assert.equal(overview.metrics.openReviews, 0);
});
