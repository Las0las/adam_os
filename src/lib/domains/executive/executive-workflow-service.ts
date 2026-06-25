// Phase 4 EXECUTIVE / COMMERCIAL OPS — account-risk workflow orchestrator. Runs
// the risk-brief function, drafts a decision memo via the approval-exempt action,
// escalates high-risk accounts, and notifies the recipient. Does not rely on the
// generic agent condition evaluator.

import { runFunction } from "@/lib/aiops/functions/function-runner";
import { executeAction } from "@/lib/mission-control/actions/action-service";
import { emitEvent } from "@/lib/mission-control/notifications/notification-service";
import { listReviewCases } from "@/lib/mission-control/review-queue/review-service";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import type { ActorContext } from "@/types/platform";
import type { DomainWorkflowResult } from "@/lib/domains/domain-workflow-types";
import type { AccountRiskBriefOutput } from "./executive-functions";

interface RunAccountRiskInput {
  accountId: string;
  recipientUserId?: string;
}

export async function runAccountRiskWorkflow(
  ctx: ActorContext,
  input: RunAccountRiskInput,
): Promise<DomainWorkflowResult> {
  const { accountId } = input;
  const recipient = input.recipientUserId ?? "system";

  const accounts = await listObjects(ctx, "Account");
  const account = accounts.find((a) => a.id === accountId);
  const accountTitle = account?.title ?? accountId;

  const fnRun = await runFunction(ctx, "executive.account_risk_brief", { accountId });
  const out = (fnRun.output ?? {}) as AccountRiskBriefOutput;

  const reviewCaseIds: string[] = [];
  const notificationIds: string[] = [];
  const actionExecutionIds: string[] = [];

  const exec = await executeAction(ctx, {
    actionKey: "executive.create_decision_memo",
    input: {
      accountId,
      title: `Risk brief: ${accountTitle}`,
      summary: out.summary,
      recommendedActions: out.recommendedActions,
      evidenceRefs: [],
      riskScore: out.riskScore,
    },
    object: { type: "Account", id: accountId },
    approvalExempt: true,
  });
  actionExecutionIds.push(exec.id);

  if ((out.riskScore ?? 0) >= 0.75) {
    const notes = await emitEvent(ctx, "executive.risk.high", recipient, {
      summary: `High commercial risk on account ${accountTitle}`,
      subjectId: accountId,
    });
    for (const n of notes) notificationIds.push(n.id);
  }

  // Read back high-risk review cases opened during the action run.
  const highRiskCases = (await listReviewCases(ctx)).filter(
    (c) => c.caseType === "executive.risk.high" && c.subjectObjectId === accountId,
  );
  for (const rc of highRiskCases) reviewCaseIds.push(rc.id);

  const memoNotes = await emitEvent(ctx, "executive.decision_memo.created", recipient, {
    summary: `Decision memo created for account ${accountTitle}`,
    subjectId: accountId,
  });
  for (const n of memoNotes) notificationIds.push(n.id);

  return {
    domain: "executive",
    functionRunId: fnRun.id,
    output: out as unknown as Record<string, unknown>,
    reviewCaseIds,
    notificationIds,
    actionExecutionIds,
  };
}
