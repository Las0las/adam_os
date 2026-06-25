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

test("Command Center aggregates work across domains", async () => {
  await bootstrap();
  const ctx = systemActor(DEMO_TENANT_ID);

  // Drive two domain workflows to generate cross-domain work.
  const claimId = await idByExternalKey(ctx, "ValidationCase", "clm-001");
  const claimResult = await runClaimValidationWorkflow(ctx, { validationCaseId: claimId });
  assert.ok(claimResult.actionExecutionIds.length > 0, "claims workflow created findings");

  const accountId = await idByExternalKey(ctx, "Account", "acct-meridian");
  const execResult = await runAccountRiskWorkflow(ctx, { accountId });
  assert.ok(execResult.actionExecutionIds.length > 0, "executive workflow created a memo");

  const overview = await getCommandCenterOverview(ctx);

  // Raw aggregates are populated.
  assert.ok(overview.recommendations.length > 0, "recommendations present");
  assert.ok(overview.recentAuditEvents.length > 0, "audit present");
  assert.ok(overview.items.length > 0, "flattened items present");

  // Items span more than one domain and carry the required annotations.
  const domains = new Set(overview.items.map((i) => i.domain));
  assert.ok(domains.size >= 2, "items span multiple domains");
  for (const item of overview.items) {
    assert.ok(item.domain, "item has domain");
    assert.ok(item.kind, "item has kind");
    assert.ok(item.title, "item has title");
    assert.ok("nextAction" in item, "item has nextAction");
  }
});

test("Command Center overview is tenant-scoped", async () => {
  await bootstrap();
  const other = systemActor("tnt_empty");
  const overview = await getCommandCenterOverview(other);
  assert.equal(overview.items.length, 0);
  assert.equal(overview.reviewQueue.length, 0);
  assert.equal(overview.recommendations.length, 0);
});
