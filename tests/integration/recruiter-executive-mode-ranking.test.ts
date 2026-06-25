// Phase 5 (Part N) — surface mode re-prioritizes the live overview. After running
// a recruiting workflow and an executive workflow, the SAME governed items rank
// differently between recruiter and executive mode: recruiting work is boosted for
// recruiters; executive work is boosted for executives.

import { test } from "node:test";
import assert from "node:assert/strict";
import { bootstrap, DEMO_TENANT_ID } from "@/lib/lawrence-core/bootstrap";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import {
  getCommandCenterOverview,
  type OverviewOptions,
} from "@/lib/domains/command-center/command-center-service";
import { runCandidateFitWorkflow } from "@/lib/domains/recruiting/recruiting-workflow-service";
import { runAccountRiskWorkflow } from "@/lib/domains/executive/executive-workflow-service";
import type {
  CommandCenterItem,
  CommandDomain,
} from "@/lib/domains/command-center/command-center-types";

async function idByExternalKey(
  ctx: ReturnType<typeof systemActor>,
  type: string,
  key: string,
): Promise<string> {
  const obj = (await listObjects(ctx, type)).find((o) => o.externalKey === key);
  assert.ok(obj, `seed object missing: ${type}/${key}`);
  return obj.id;
}

function allItems(o: Awaited<ReturnType<typeof getCommandCenterOverview>>): CommandCenterItem[] {
  return [...o.actionQueue, ...o.reviewQueue, ...o.riskQueue, ...o.recommendationQueue];
}

function scoreForDomain(
  o: Awaited<ReturnType<typeof getCommandCenterOverview>>,
  domain: CommandDomain,
): number {
  const item = allItems(o).find((i) => i.domain === domain);
  assert.ok(item, `expected a ${domain} item in the overview`);
  return item.priorityScore;
}

test("surface mode re-ranks recruiting vs executive work", async () => {
  await bootstrap();
  const ctx = systemActor(DEMO_TENANT_ID);

  const marcus = await idByExternalKey(ctx, "Candidate", "cand-marcus");
  const job = await idByExternalKey(ctx, "Job", "job-powerbi");
  await runCandidateFitWorkflow(ctx, { candidateId: marcus, jobId: job });

  const accountId = await idByExternalKey(ctx, "Account", "acct-meridian");
  await runAccountRiskWorkflow(ctx, { accountId });

  const recruiterView = await getCommandCenterOverview(ctx, { mode: "recruiter" } satisfies OverviewOptions);
  const executiveView = await getCommandCenterOverview(ctx, { mode: "executive" } satisfies OverviewOptions);

  const recruitingInRecruiter = scoreForDomain(recruiterView, "recruiting");
  const recruitingInExecutive = scoreForDomain(executiveView, "recruiting");
  assert.ok(
    recruitingInRecruiter > recruitingInExecutive,
    "recruiting work ranks higher in recruiter mode",
  );

  const executiveInExecutive = scoreForDomain(executiveView, "executive");
  const executiveInRecruiter = scoreForDomain(recruiterView, "executive");
  assert.ok(
    executiveInExecutive > executiveInRecruiter,
    "executive work ranks higher in executive mode",
  );
});
