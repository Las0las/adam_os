import { test } from "node:test";
import assert from "node:assert/strict";
import { bootstrap, DEMO_TENANT_ID } from "@/lib/lawrence-core/bootstrap";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { getCommandCenterOverview } from "@/lib/domains/command-center/command-center-service";
import { runClaimValidationWorkflow } from "@/lib/domains/claims/claims-workflow-service";
import { runAccountRiskWorkflow } from "@/lib/domains/executive/executive-workflow-service";

async function idByExternalKey(ctx: ReturnType<typeof systemActor>, type: string, key: string): Promise<string> {
  const obj = (await listObjects(ctx, type)).find((o) => o.externalKey === key);
  assert.ok(obj, `seed object missing: ${type}/${key}`);
  return obj.id;
}

test("Command Center aggregates ranked work across domains", async () => {
  await bootstrap();
  const ctx = systemActor(DEMO_TENANT_ID);

  const claimId = await idByExternalKey(ctx, "ValidationCase", "clm-001");
  await runClaimValidationWorkflow(ctx, { validationCaseId: claimId });
  const accountId = await idByExternalKey(ctx, "Account", "acct-meridian");
  await runAccountRiskWorkflow(ctx, { accountId });

  const o = await getCommandCenterOverview(ctx, { mode: "executive" });

  assert.ok(o.reviewQueue.length > 0, "review queue populated");
  assert.ok(o.recommendationQueue.length > 0, "recommendation queue populated");
  assert.ok(o.recentActivity.length > 0, "recent activity populated");

  // Items carry the required annotations and are ranked desc.
  const all = [...o.actionQueue, ...o.reviewQueue, ...o.riskQueue, ...o.recommendationQueue];
  const domains = new Set(all.map((i) => i.domain));
  assert.ok(domains.size >= 2, "work spans multiple domains");
  for (const item of all) {
    assert.ok(item.domain && item.kind && item.title, "item has domain/kind/title");
    assert.ok(typeof item.priorityScore === "number", "item has priorityScore");
  }
  const scores = o.reviewQueue.map((i) => i.priorityScore);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a), "review queue sorted by priority");
});

test("Command Center overview is tenant-scoped", async () => {
  await bootstrap();
  const other = systemActor("tnt_empty");
  const o = await getCommandCenterOverview(other, { mode: "executive" });
  assert.equal(o.reviewQueue.length, 0);
  assert.equal(o.recommendationQueue.length, 0);
  assert.equal(o.riskQueue.length, 0);
});
